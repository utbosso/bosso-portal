import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventCategory } from '@/types/database.types'

const CATEGORIES: EventCategory[] = ['membership', 'professional_education', 'social', 'philanthropy']

// Runs server-side so checking "did this beneficiary already check in to this
// event" can reliably read attendance_records for someone other than the
// submitter - a plain member session isn't something RLS is expected to
// grant broad cross-member read access to, the same reasoning behind every
// other server-side move this session.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to submit a point request.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const termId = typeof body?.termId === 'string' ? body.termId : ''
  const beneficiaryIds: string[] = Array.isArray(body?.beneficiaryIds)
    ? body.beneficiaryIds.filter((id: unknown) => typeof id === 'string')
    : []
  const eventId = typeof body?.eventId === 'string' && body.eventId ? body.eventId : null
  const requestedPoints = Number(body?.requestedPoints)
  const category = body?.category as EventCategory
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!termId || beneficiaryIds.length === 0) {
    return NextResponse.json({ error: 'At least one member and a term are required.' }, { status: 400 })
  }
  if (!Number.isFinite(requestedPoints) || requestedPoints <= 0 || requestedPoints > 1000) {
    return NextResponse.json({ error: 'Requested points must be between 1 and 1,000.' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'A valid category is required.' }, { status: 400 })
  }
  if (note.length < 3) {
    return NextResponse.json({ error: 'Include the event, date, contribution, and any context the reviewer needs.' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (eventId) {
    const { data: alreadyCheckedIn, error: attendanceError } = await admin
      .from('attendance_records')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', beneficiaryIds)
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })

    if (alreadyCheckedIn && alreadyCheckedIn.length > 0) {
      const checkedInIds = new Set(alreadyCheckedIn.map((row) => row.user_id))
      const { data: names } = await admin.from('profiles').select('id, full_name').in('id', Array.from(checkedInIds))
      const nameList = (names || []).map((n) => n.full_name).join(', ') || 'Someone in this request'
      return NextResponse.json(
        {
          error: `${nameList} already checked in to this event with the code - a point request for it would double-award points. Remove them from this request or pick a different event.`,
        },
        { status: 409 }
      )
    }
  }

  const { data: pointRequests, error: insertError } = await admin
    .from('point_requests')
    .insert(
      beneficiaryIds.map((beneficiaryId) => ({
        term_id: termId,
        user_id: beneficiaryId,
        submitted_by: user.id,
        event_id: eventId,
        requested_points: requestedPoints,
        suggested_category: category,
        note,
        status: 'pending',
        final_points: null,
        final_category: null,
        reviewer_note: null,
        reviewed_by: null,
        reviewed_at: null,
      }))
    )
    .select('*')

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ pointRequests: pointRequests || [] })
}
