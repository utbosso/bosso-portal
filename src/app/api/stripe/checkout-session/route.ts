import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { getStripeClient } from '@/lib/stripe/server'
import type { DuesPlanLength } from '@/types/database.types'

// Give this route headroom beyond the several sequential DB round-trips and
// the Stripe API call, so a cold serverless start doesn't hit a gateway
// timeout before Stripe responds.
export const maxDuration = 30

const ROLE_LABELS: Record<string, string> = {
  general_member: 'General member',
  analyst: 'Analyst',
  project_manager: 'Project manager',
  board_member: 'Board member',
}

// Checkout offers both card and ACH bank transfer in the same session, but
// each has a different processing cost. When the org passes that cost on to
// the member, gross up using the card rate (the more expensive of the two)
// so the org nets the full dues amount regardless of which method is chosen.
const CARD_PERCENT_FEE = 0.029
const CARD_FIXED_FEE_CENTS = 30

function computeChargeAmountCents(baseAmountCents: number, passFeeToMember: boolean) {
  if (!passFeeToMember) return baseAmountCents
  return Math.ceil((baseAmountCents + CARD_FIXED_FEE_CENTS) / (1 - CARD_PERCENT_FEE))
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Online dues payment is not available yet. Contact the board.' },
      { status: 503 }
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Sign in to pay dues.' }, { status: 401 })
  if (isPortalAdminUser(user)) {
    return NextResponse.json({ error: 'The portal administrator does not pay dues.' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const planLength: DuesPlanLength = body?.planLength === 'annual' ? 'annual' : 'semester'

  const admin = createAdminClient()

  const { data: term, error: termError } = await admin
    .from('academic_terms')
    .select('id, name, academic_year')
    .eq('status', 'current')
    .maybeSingle()
  if (termError) return NextResponse.json({ error: termError.message }, { status: 500 })
  if (!term) return NextResponse.json({ error: 'The current semester is not open yet.' }, { status: 409 })

  // These two only depend on term.id, not on each other - run together
  // instead of back-to-back to cut round-trip latency.
  const [membershipResult, settingsResult] = await Promise.all([
    admin
      .from('member_term_memberships')
      .select('id, dues_status, position_role')
      .eq('term_id', term.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('dues_checkout_settings').select('pass_fee_to_member').maybeSingle(),
  ])
  const { data: membership, error: membershipError } = membershipResult
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })
  if (!membership) {
    return NextResponse.json({ error: 'Enter your position code before paying dues.' }, { status: 409 })
  }
  if (membership.dues_status !== 'unpaid') {
    return NextResponse.json({ error: 'Dues are already recorded for this semester.' }, { status: 409 })
  }

  // These two only depend on membership/term, not on each other.
  const [priceResult, yearTermsResult] = await Promise.all([
    admin
      .from('dues_prices')
      .select('amount_cents')
      .eq('term_id', term.id)
      .eq('position_role', membership.position_role)
      .eq('plan_length', planLength)
      .maybeSingle(),
    // Include every non-archived term in the academic year, not just
    // 'upcoming' ones - a future term often still sits in 'draft' until an
    // admin gets around to preparing it, and an annual payment should still
    // cover it once it exists, not silently miss it because of that timing.
    planLength === 'annual'
      ? admin
          .from('academic_terms')
          .select('id')
          .eq('academic_year', term.academic_year)
          .neq('status', 'archived')
          .neq('id', term.id)
      : Promise.resolve({ data: [], error: null }),
  ])
  const { data: price, error: priceError } = priceResult
  if (priceError) return NextResponse.json({ error: priceError.message }, { status: 500 })
  if (!price) {
    return NextResponse.json(
      { error: "Dues pricing for your position hasn't been set up yet. Contact the board." },
      { status: 409 }
    )
  }
  const { data: yearTerms, error: yearTermsError } = yearTermsResult
  if (yearTermsError) return NextResponse.json({ error: yearTermsError.message }, { status: 500 })

  const termIds = [term.id, ...(yearTerms || []).map((yearTerm) => yearTerm.id)]

  const { data: settings } = settingsResult
  const chargeAmountCents = computeChargeAmountCents(price.amount_cents, settings?.pass_fee_to_member ?? false)
  const roleLabel = ROLE_LABELS[membership.position_role] || membership.position_role

  const origin = new URL(request.url).origin
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'us_bank_account'],
    customer_email: user.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: chargeAmountCents,
          product_data: {
            name: `BOSSO dues — ${roleLabel} (${planLength === 'annual' ? 'full year' : term.name})`,
          },
        },
      },
    ],
    metadata: {
      userId: user.id,
      termIds: termIds.join(','),
      baseAmountCents: String(price.amount_cents),
    },
    success_url: `${origin}/dashboard?dues=success`,
    cancel_url: `${origin}/dashboard?dues=cancelled`,
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout link.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
