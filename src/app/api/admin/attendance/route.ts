import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { loadCurrentTermMembers } from '@/lib/current-term-recipients'

// The Attendance Management tab queried attendance_records, points_adjustments,
// and member_term_point_summary directly from the browser with no user_id
// filter - the admin table needs every member's rows in one shot, which is
// only correct if row-level security grants this session broad cross-member
// read access. Nothing here confirmed that, and the same pattern has already
// turned out to be silently broken elsewhere in this app (Points Breakdown,
// the retroactive attendance-points sync). Running everything here under the
// service role sidesteps the question rather than assuming the policy is
// permissive enough.
async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isPortalAdminUser(user)) return null
  return user
}

async function getCurrentTermId(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from('academic_terms').select('id').eq('status', 'current').maybeSingle()
  return data?.id as string | undefined
}

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view')
  const termId = await getCurrentTermId(admin)

  if (view === 'members') {
    let context
    try {
      context = await loadCurrentTermMembers(admin)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Members could not be loaded.' }, { status: 500 })
    }
    const eligibleMembers = context.members.filter((member) => member.role !== 'admin')
    const eligibleIds = eligibleMembers.map((member) => member.id)
    if (eligibleIds.length === 0) return NextResponse.json({ memberStats: [] })

    const { data: profileEmails, error: usersError } = await admin.from('profiles').select('id, email').in('id', eligibleIds)
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
    const emailById = new Map((profileEmails || []).map((member: any) => [member.id, member.email]))

    let attendanceQuery = admin.from('attendance_records').select('user_id, points_earned')
    if (termId) attendanceQuery = attendanceQuery.eq('term_id', termId)
    const { data: allAttendance, error: attendanceError } = await attendanceQuery
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })

    let adjustmentsQuery = admin.from('points_adjustments').select('user_id, points')
    if (termId) adjustmentsQuery = adjustmentsQuery.eq('term_id', termId)
    const { data: allAdjustments, error: adjustError } = await adjustmentsQuery
    if (adjustError) return NextResponse.json({ error: adjustError.message }, { status: 500 })

    let trackedEventsQuery = admin.from('events').select('id').eq('track_attendance', true)
    if (termId) trackedEventsQuery = trackedEventsQuery.eq('term_id', termId).is('archived_at', null)
    const { data: events, error: eventsError } = await trackedEventsQuery
    if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })
    const totalEvents = events?.length || 0

    const summaryByUser = new Map<string, number>()
    if (termId) {
      const { data: summaries } = await admin.from('member_term_point_summary').select('user_id, total_points').eq('term_id', termId)
      for (const summary of summaries || []) summaryByUser.set(summary.user_id, Number(summary.total_points || 0))
    }

    const memberStats = eligibleMembers.map((member) => {
      const userAttendance = ((allAttendance || []) as any[]).filter((a) => a.user_id === member.id)
      const userAdjustments = ((allAdjustments || []) as any[]).filter((a) => a.user_id === member.id)
      const attendancePoints = userAttendance.reduce((sum, a) => sum + (a.points_earned || 0), 0)
      const adjustmentPoints = userAdjustments.reduce((sum, a) => sum + a.points, 0)
      const eventsAttended = userAttendance.length

      return {
        user_id: member.id,
        full_name: member.full_name,
        email: emailById.get(member.id) || '',
        role: member.role,
        total_points: summaryByUser.has(member.id) ? summaryByUser.get(member.id)! : attendancePoints + adjustmentPoints,
        events_attended: eventsAttended,
        attendance_rate: totalEvents > 0 ? (eventsAttended / totalEvents) * 100 : 0,
      }
    })

    return NextResponse.json({ memberStats })
  }

  if (view === 'events') {
    let eventsQuery = admin.from('events').select('id, title, start_at, point_value').eq('track_attendance', true)
    if (termId) eventsQuery = eventsQuery.eq('term_id', termId).is('archived_at', null)
    const { data: events, error: eventsError } = await eventsQuery.order('start_at', { ascending: false })
    if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })

    let attendanceQuery = admin.from('attendance_records').select('event_id, user:profiles(full_name)')
    if (termId) attendanceQuery = attendanceQuery.eq('term_id', termId)
    const { data: allAttendance, error: attendanceError } = await attendanceQuery
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })

    const eventStats = (events || []).map((event: any) => {
      const attendees = ((allAttendance || []) as any[]).filter((a) => a.event_id === event.id)
      const attendeeNames = attendees.map((a) => (Array.isArray(a.user) ? a.user[0]?.full_name : a.user?.full_name) || 'Unknown').filter(Boolean)
      return {
        event_id: event.id,
        title: event.title,
        start_at: event.start_at,
        point_value: event.point_value || 0,
        total_attendees: attendees.length,
        attendee_names: attendeeNames,
      }
    })

    return NextResponse.json({ eventStats })
  }

  if (view === 'member-history') {
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 })

    let attendanceQuery = admin
      .from('attendance_records')
      .select('*, event:events(id, title, start_at, point_value)')
      .eq('user_id', userId)
    if (termId) attendanceQuery = attendanceQuery.eq('term_id', termId)
    const { data: attendance, error: attendanceError } = await attendanceQuery.order('checked_in_at', { ascending: false })
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })

    let adjustmentsQuery = admin.from('points_adjustments').select('*').eq('user_id', userId)
    if (termId) adjustmentsQuery = adjustmentsQuery.eq('term_id', termId)
    const { data: adjustments, error: adjustError } = await adjustmentsQuery.order('created_at', { ascending: false })
    if (adjustError) return NextResponse.json({ error: adjustError.message }, { status: 500 })

    return NextResponse.json({ attendance: attendance || [], adjustments: adjustments || [] })
  }

  if (view === 'event-attendees') {
    const eventId = searchParams.get('eventId')
    if (!eventId) return NextResponse.json({ error: 'eventId is required.' }, { status: 400 })

    const { data, error } = await admin
      .from('attendance_records')
      .select('*, user:profiles(id, full_name, email, role)')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ attendees: data || [] })
  }

  return NextResponse.json({ error: 'Unknown view.' }, { status: 400 })
}

export async function DELETE(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')
  if (!id || (type !== 'attendance' && type !== 'adjustment')) {
    return NextResponse.json({ error: 'A valid id and type are required.' }, { status: 400 })
  }

  const table = type === 'attendance' ? 'attendance_records' : 'points_adjustments'
  const { data, error } = await admin.from(table).delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Record not found.' }, { status: 404 })

  return NextResponse.json({ success: true })
}
