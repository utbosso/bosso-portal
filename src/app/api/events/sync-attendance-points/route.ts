import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/database.types'

const MANAGE_ROLES: UserRole[] = ['project_manager', 'board_member', 'admin']

// Runs under the service role rather than the caller's own session. The
// equivalent client-side update (supabase.from('attendance_records').update
// from the browser) silently affected 0 rows in production - row-level
// security does not appear to grant a bulk cross-user update on
// attendance_records from a regular session, and Postgres/PostgREST does not
// treat "0 rows matched by RLS" as an error, so the failure was invisible.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: actorProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!actorProfile?.role || !MANAGE_ROLES.includes(actorProfile.role as UserRole)) {
    return NextResponse.json({ error: 'Not authorized to manage events.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const pointValue = Number(body?.pointValue)
  if (!eventId || !Number.isFinite(pointValue) || pointValue < 0) {
    return NextResponse.json({ error: 'A valid eventId and pointValue are required.' }, { status: 400 })
  }

  const { data: synced, error } = await admin
    .from('attendance_records')
    .update({ points_earned: pointValue })
    .eq('event_id', eventId)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, updatedCount: synced?.length ?? 0 })
}
