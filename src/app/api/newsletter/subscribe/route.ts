import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public, unauthenticated endpoint for the "Subscribe to Newsletter" form,
// called both from the portal's own /newsletter/subscribe page (same
// origin) and embedded directly on txbosso.com (cross-origin, hence the
// CORS headers below). No session is expected here, so everything is
// validated server-side rather than trusted from the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ALLOWED_ORIGINS = ['https://txbosso.com', 'https://www.txbosso.com', 'https://bosso-portal.vercel.app']

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || ''
  if (!ALLOWED_ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request)
  const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers })

  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid submission.' }, 400)

  // Honeypot: a real visitor never fills in this hidden field. Report
  // success without writing anything so the bot doesn't retry.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return json({ success: true })
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200).toLowerCase() : ''
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400)

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('id, unsubscribed_at')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Already subscribed and active - nothing to do.
    if (!existing.unsubscribed_at) return json({ success: true })

    // Previously unsubscribed - welcome them back.
    const { error } = await admin
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: null })
      .eq('id', existing.id)
    if (error) return json({ error: 'Your submission could not be saved. Please try again.' }, 500)
    return json({ success: true })
  }

  const { error } = await admin.from('newsletter_subscribers').insert({ email })
  if (error) return json({ error: 'Your submission could not be saved. Please try again.' }, 500)

  return json({ success: true })
}
