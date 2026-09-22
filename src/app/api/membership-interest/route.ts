import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public, unauthenticated endpoint for the "interested in joining BOSSO"
// form linked from the external website. No session is expected here, so
// everything is validated server-side rather than trusted from the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })

  // Honeypot: a real visitor never fills in this hidden field. Report
  // success without writing anything so the bot doesn't retry.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ success: true })
  }

  const fullName = clean(body.fullName, 120)
  const email = clean(body.email, 200).toLowerCase()
  const phone = clean(body.phone, 40)
  const eid = clean(body.eid, 20)
  const graduationYear = clean(body.graduationYear, 20)
  const major = clean(body.major, 120)
  const howHeard = clean(body.howHeard, 120)
  const note = clean(body.note, 2000)

  if (fullName.length < 2) return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (phone.length < 7) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })

  const admin = createAdminClient()

  // A double-click or a resubmit within a few minutes shouldn't create a
  // second row for the same person.
  const { data: recent } = await admin
    .from('membership_interest_submissions')
    .select('id')
    .eq('email', email)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle()
  if (recent) return NextResponse.json({ success: true })

  const { error } = await admin.from('membership_interest_submissions').insert({
    full_name: fullName,
    email,
    phone,
    eid: eid || null,
    graduation_year: graduationYear || null,
    major: major || null,
    how_heard: howHeard || null,
    note: note || null,
  })
  if (error) return NextResponse.json({ error: 'Your submission could not be saved. Please try again.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
