import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import type { EventCategory, PointRequestStatus } from '@/types/database.types'

const CATEGORIES: EventCategory[] = ['membership', 'professional_education', 'social', 'philanthropy']
const REVIEW_STATUSES: PointRequestStatus[] = ['approved', 'declined', 'needs_info']

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isPortalAdminUser(user)) {
    return NextResponse.json({ error: 'Only internal@txbosso.com can review point requests.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
  const status = body?.status as PointRequestStatus
  const reviewerNote = typeof body?.reviewerNote === 'string' ? body.reviewerNote.trim().slice(0, 4000) : ''

  if (!requestId || !REVIEW_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'A valid request and review decision are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: pointRequest, error: requestError } = await admin
    .from('point_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 })
  if (!pointRequest) return NextResponse.json({ error: 'Point request not found.' }, { status: 404 })
  if (!['pending', 'needs_info'].includes(pointRequest.status)) {
    return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 })
  }

  let finalPoints: number | null = null
  let finalCategory: EventCategory | null = null

  if (status === 'approved') {
    finalPoints = Number(body?.finalPoints)
    finalCategory = body?.finalCategory as EventCategory
    if (!Number.isFinite(finalPoints) || finalPoints <= 0 || finalPoints > 1000 || !CATEGORIES.includes(finalCategory)) {
      return NextResponse.json({ error: 'Approved points and a final category are required.' }, { status: 400 })
    }

    if (pointRequest.event_id) {
      const { data: checkedIn } = await admin
        .from('attendance_records')
        .select('id, points_earned')
        .eq('event_id', pointRequest.event_id)
        .eq('user_id', pointRequest.user_id)
        .gt('points_earned', 0)
        .limit(1)
        .maybeSingle()
      if (checkedIn) {
        return NextResponse.json(
          { error: 'This member already checked in to this event and earned its points. Decline this request as a duplicate instead.' },
          { status: 409 }
        )
      }
    }

    const { error: ledgerError } = await admin.from('point_ledger').upsert(
      {
        term_id: pointRequest.term_id,
        user_id: pointRequest.user_id,
        category: finalCategory,
        points: finalPoints,
        source_type: 'request',
        source_id: pointRequest.id,
        note: pointRequest.note,
        awarded_by: user!.id,
        occurred_at: new Date().toISOString(),
        voided_at: null,
        voided_by: null,
      },
      { onConflict: 'term_id,user_id,source_type,source_id' }
    )
    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 })

    // A request tied to an event means the member couldn't check in live
    // (forgot, code expired) and is getting credit after the fact - without
    // this, they'd never show up as an attendee anywhere that counts from
    // attendance_records (Attendance Management's per-event/per-member
    // views). points_earned is 0 here deliberately: the point_ledger row
    // above already awarded the real points under source_type='request', and
    // attendance_records has its own trigger that mirrors into point_ledger
    // too - a nonzero value here would double-count them.
    if (pointRequest.event_id) {
      const { data: existingAttendance } = await admin
        .from('attendance_records')
        .select('id')
        .eq('event_id', pointRequest.event_id)
        .eq('user_id', pointRequest.user_id)
        .maybeSingle()

      if (!existingAttendance) {
        const { data: eventRow } = await admin
          .from('events')
          .select('event_category, term_id')
          .eq('id', pointRequest.event_id)
          .maybeSingle()

        const { error: attendanceError } = await admin.from('attendance_records').insert({
          event_id: pointRequest.event_id,
          user_id: pointRequest.user_id,
          points_earned: 0,
          event_category: eventRow?.event_category ?? finalCategory,
          term_id: eventRow?.term_id ?? pointRequest.term_id,
        })
        if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 })
      }
    }
  }

  const { error: updateError } = await admin
    .from('point_requests')
    .update({
      status,
      final_points: finalPoints,
      final_category: finalCategory,
      reviewer_note: reviewerNote || null,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
