import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public, unauthenticated endpoint. Always reports success regardless of
// whether the token matched anything, so a stale/guessed token can't be
// used to probe which tokens are valid.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) return NextResponse.json({ success: true })

  const admin = createAdminClient()
  await admin
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null)

  return NextResponse.json({ success: true })
}
