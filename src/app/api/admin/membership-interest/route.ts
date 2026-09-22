import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isPortalAdminUser(user)) return null
  return user
}

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const admin = createAdminClient()
  let query = admin.from('membership_interest_submissions').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissions: data || [] })
}

const STATUSES = ['new', 'contacted', 'dismissed'] as const

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = body?.status as (typeof STATUSES)[number]
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'A valid submission and status are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membership_interest_submissions')
    .update({
      status,
      contacted_by: status === 'contacted' ? user.id : null,
      contacted_at: status === 'contacted' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
