import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'

// Lets the beneficiary or original submitter answer an admin's "needs info"
// note. Runs server-side so ownership (user_id OR submitted_by) and the
// current status can be checked reliably before flipping the request back
// to pending, the same reasoning behind every other cross-user write in
// this feature living in an API route rather than a client-side query.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to respond to this request.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
  const followUp = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!requestId || followUp.length < 3) {
    return NextResponse.json({ error: 'Include the additional information the reviewer asked for.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: pointRequest, error: requestError } = await admin
    .from('point_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 })
  if (!pointRequest) return NextResponse.json({ error: 'Point request not found.' }, { status: 404 })
  if (pointRequest.user_id !== user.id && pointRequest.submitted_by !== user.id) {
    return NextResponse.json({ error: 'You do not have access to this request.' }, { status: 403 })
  }
  if (pointRequest.status !== 'needs_info') {
    return NextResponse.json({ error: 'This request is no longer waiting on more information.' }, { status: 409 })
  }

  const combinedNote = `${pointRequest.note}\n\n— Follow-up (${new Date().toLocaleDateString()}): ${followUp}`.slice(0, 8000)

  const { error: updateError } = await admin
    .from('point_requests')
    .update({
      note: combinedNote,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
