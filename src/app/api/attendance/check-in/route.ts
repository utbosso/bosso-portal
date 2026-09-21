import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'

// Runs server-side with the admin client rather than the member's own
// session so the points/due date/assigner on an auto-created deliverable
// task come from the trusted events row, not anything the client could
// shape - a plain member inserting into tasks directly (assigned_by someone
// else, an arbitrary point_value) is not something RLS is expected to allow.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to check in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code) return NextResponse.json({ error: 'Enter a check-in code.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      'id, title, point_value, attendance_code, code_expires_at, event_category, created_by, term_id, deliverable_title, deliverable_description, deliverable_point_value, deliverable_due_at'
    )
    .eq('attendance_code', code)
    .eq('track_attendance', true)
    .maybeSingle()

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })
  if (!event) return NextResponse.json({ error: 'Invalid check-in code. Please try again.' }, { status: 400 })

  if (event.code_expires_at) {
    const expiresAt = new Date(event.code_expires_at)
    if (!Number.isNaN(expiresAt.getTime()) && new Date() > expiresAt) {
      return NextResponse.json({ error: 'This check-in code has expired.' }, { status: 400 })
    }
  }

  const { data: existing } = await admin
    .from('attendance_records')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'You have already checked in to this event.' }, { status: 409 })
  }

  // A member credited for this event through an approved point request has
  // already been awarded its points - checking in as well would pay twice.
  const { data: creditedRequest } = await admin
    .from('point_requests')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()
  if (creditedRequest) {
    return NextResponse.json(
      { error: 'You were already credited for this event through an approved point request, so no check-in is needed.' },
      { status: 409 }
    )
  }

  const { error: attendanceError } = await admin.from('attendance_records').insert({
    event_id: event.id,
    user_id: user.id,
    term_id: event.term_id,
    points_earned: event.point_value || 0,
    event_category: event.event_category,
  })
  if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })

  let deliverableCreated = false
  if (event.deliverable_point_value && event.deliverable_point_value > 0 && event.deliverable_due_at) {
    const { error: taskError } = await admin.from('tasks').insert({
      title: event.deliverable_title?.trim() || `${event.title} - Deliverable`,
      description: event.deliverable_description?.trim() || null,
      status: 'not_started',
      assignee_status: 'not_started',
      due_at: event.deliverable_due_at,
      assigned_to: user.id,
      assigned_by: event.created_by,
      point_value: event.deliverable_point_value,
      points_category: event.event_category,
      // Reviewed and approved like any other task, not auto-awarded on
      // submission - a deliverable still needs someone to check it.
      auto_approve: false,
      points_awarded: false,
      // Every deliverable task from this event shares the event's own id as
      // its group tag, so they're visibly grouped in Tasks even though each
      // one is created individually as people check in over time.
      group_task_id: event.id,
      assigned_to_role: null,
      ...(event.term_id ? { term_id: event.term_id } : {}),
    })
    if (taskError) {
      console.error('Deliverable task creation failed', taskError)
    } else {
      deliverableCreated = true
    }
  }

  return NextResponse.json({ success: true, pointsEarned: event.point_value || 0, deliverableCreated })
}
