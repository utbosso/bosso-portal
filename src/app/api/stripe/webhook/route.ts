import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient } from '@/lib/stripe/server'

export const maxDuration = 30

// ACH bank transfers settle days after checkout, so Stripe marks that session
// completed before the money has actually cleared. Only activate access once
// payment_status is 'paid' - immediately for card, or later via
// checkout.session.async_payment_succeeded for a bank transfer.
async function activateFromSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return

  const userId = session.metadata?.userId
  const termIds = session.metadata?.termIds?.split(',').filter(Boolean)
  const baseAmountCents = Number(session.metadata?.baseAmountCents)
  if (!userId || !termIds?.length || !Number.isFinite(baseAmountCents)) return

  const admin = createAdminClient()
  const { error } = await (admin as any).rpc('mark_dues_paid_and_activate', {
    target_user_id: userId,
    target_term_ids: termIds,
    target_amount_cents: baseAmountCents,
    target_stripe_checkout_session_id: session.id,
  })
  if (error) throw new Error(error.message)
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (verificationError) {
    const message = verificationError instanceof Error ? verificationError.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await activateFromSession(event.data.object as Stripe.Checkout.Session)
    }
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message : 'Could not process the Stripe event'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
