import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertStorageRoom, checkStorageUsageAndAlert, StorageFullError } from '@/lib/storage-usage'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

const TARGETS = {
  documents: { bucket: 'documents' },
  resources: { bucket: 'resources' },
} as const
type Target = keyof typeof TARGETS

// Shared upload endpoint for Internal Docs and the Learning Hub - both
// point at real (already-provisioned) Storage buckets rather than only
// accepting a pasted link. Runs server-side so the project-wide storage
// cap can be checked BEFORE writing anything, which a client-side upload
// straight to Storage could not do.
export async function POST(request: Request) {
  try {
    return await handleUpload(request)
  } catch (error) {
    console.error('Error handling storage upload', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The file could not be uploaded.' }, { status: 500 })
  }
}

async function handleUpload(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to upload a file.' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })

  const target = String(formData.get('target') || '')
  if (!Object.prototype.hasOwnProperty.call(TARGETS, target)) {
    return NextResponse.json({ error: 'Invalid upload target.' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file was attached.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 400 })
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'That file type is not supported. Use PDF, Word, PowerPoint, Excel, an image, or plain text.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Member profile not found.' }, { status: 403 })

  // Same permission a person already needs to create the item at all
  // (matches the create-button gate in the client): Board/admin for
  // Internal Docs, any approved member for the Learning Hub.
  const isPortalAdmin = user.email?.trim().toLowerCase() === 'internal@txbosso.com'
  if (target === 'documents' && !(isPortalAdmin || profile.role === 'board_member')) {
    return NextResponse.json({ error: 'Only Board members or the portal admin can upload internal documents.' }, { status: 403 })
  }

  try {
    await assertStorageRoom(admin, file.size)
  } catch (roomError) {
    if (roomError instanceof StorageFullError) return NextResponse.json({ error: roomError.message }, { status: 507 })
    throw roomError
  }

  const bucket = TARGETS[target as Target].bucket
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, arrayBuffer, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })

  // Best-effort usage check for the warn/critical thresholds - doesn't
  // block the response, since it's monitoring, not part of whether this
  // particular upload succeeded.
  void checkStorageUsageAndAlert(admin).catch((alertError) => console.error('Storage usage check failed', alertError))

  return NextResponse.json({
    storagePath,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type,
  })
}
