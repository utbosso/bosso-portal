import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public, unauthenticated endpoint for the "Subscribe to Newsletter" form
// linked from the external website. No session is expected here, so
// everything is validated server-side rather than trusted from the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })

  // Honeypot: a real visitor never fills in this hidden field. Report
  // success without writing anything so the bot doesn't retry.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ success: true })
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200).toLowerCase() : ''
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('id, unsubscribed_at')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Already subscribed and active - nothing to do.
    if (!existing.unsubscribed_at) return NextResponse.json({ success: true })

    // Previously unsubscribed - welcome them back.
    const { error } = await admin
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: null })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: 'Your submission could not be saved. Please try again.' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { error } = await admin.from('newsletter_subscribers').insert({ email })
  if (error) return NextResponse.json({ error: 'Your submission could not be saved. Please try again.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
