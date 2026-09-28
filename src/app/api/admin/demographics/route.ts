import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { loadCurrentTermMembers } from '@/lib/current-term-recipients'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isPortalAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const context = await loadCurrentTermMembers(admin)
  const memberIds = context.members.map((member) => member.id)
  if (memberIds.length === 0) return NextResponse.json({ members: [] })

  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, full_name, email, demographics_schools, demographics_class_standing, demographics_major, demographics_has_minor, demographics_minor, demographics_completed_at'
    )
    .in('id', memberIds)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data || [] })
}
