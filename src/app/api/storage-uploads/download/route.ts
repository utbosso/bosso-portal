import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { canAccessRoleScope } from '@/lib/role-scope'

const TARGETS = {
  documents: { bucket: 'documents', table: 'documents' },
  resources: { bucket: 'resources', table: 'learning_resources' },
} as const
type Target = keyof typeof TARGETS

// The documents/learning_resources tables predate this project's RLS-based
// tables and have no row-level security of their own - the client fetches
// every row and filters visibility (role_scope, is_restricted +
// document_access) in JS. This route therefore can't lean on "the row came
// back" as proof of access the way other download routes in this app can -
// it re-checks that same visibility logic itself, server-side, using the
// admin client only after that check passes.
export async function GET(request: Request) {
  try {
    return await handleDownload(request)
  } catch (error) {
    console.error('Error handling storage download', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The file could not be opened.' }, { status: 500 })
  }
}

async function handleDownload(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to view this file.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const target = searchParams.get('target') || ''
  const id = searchParams.get('id') || ''
  if (!id || !Object.prototype.hasOwnProperty.call(TARGETS, target)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { bucket, table } = TARGETS[target as Target]

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Member profile not found.' }, { status: 403 })

  const { data: row, error } = await admin.from(table).select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row?.storage_path) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  const isPortalAdmin = isPortalAdminUser(user)
  let allowed = isPortalAdmin

  if (!allowed && target === 'documents') {
    if (row.created_by === user.id) {
      allowed = true
    } else if (row.is_restricted) {
      const { data: accessRow } = await admin
        .from('document_access')
        .select('document_id')
        .eq('document_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      allowed = Boolean(accessRow)
    } else if (canAccessRoleScope(profile.role, row.role_scope, row.role_scope_mode)) {
      allowed = true
    } else {
      const { data: accessRow } = await admin
        .from('document_access')
        .select('document_id')
        .eq('document_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      allowed = Boolean(accessRow)
    }
  }

  if (!allowed && target === 'resources') {
    allowed = canAccessRoleScope(profile.role, row.role_scope, row.role_scope_mode)
  }

  if (!allowed) return NextResponse.json({ error: 'You do not have access to this file.' }, { status: 403 })

  const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUrl(row.storage_path, 900)
  if (signError || !signed) return NextResponse.json({ error: 'The file could not be opened.' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl, fileName: row.file_name })
}
