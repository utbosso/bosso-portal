import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Sign in to renew your membership.' }, { status: 401 })
  if (isPortalAdminUser(user)) {
    return NextResponse.json({ success: true, status: 'admin_exempt' })
  }

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (code.length < 4 || code.length > 80) {
    return NextResponse.json({ error: 'Enter the position code provided by the board.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: term, error: termError } = await admin
    .from('academic_terms')
    .select('id, name')
    .eq('status', 'current')
    .maybeSingle()

  if (termError && ['42P01', 'PGRST205'].includes(termError.code || '')) {
    return NextResponse.json({ success: true, status: 'legacy_pending' })
  }
  if (termError) return NextResponse.json({ error: termError.message }, { status: 500 })
  if (!term) return NextResponse.json({ error: 'The new semester is not open yet.' }, { status: 409 })

  const { data: positionCode, error: codeError } = await admin
    .from('position_codes')
    .select('id, intended_role, max_uses, expires_at, is_active')
    .eq('term_id', term.id)
    .eq('code_hash', hashCode(code))
    .maybeSingle()

  if (codeError) return NextResponse.json({ error: codeError.message }, { status: 500 })
  if (
    !positionCode ||
    !positionCode.is_active ||
    (positionCode.expires_at && new Date(positionCode.expires_at).getTime() < Date.now())
  ) {
    return NextResponse.json({ error: 'That position code is invalid or expired.' }, { status: 400 })
  }

  const { count: priorMembershipCount } = await admin
    .from('member_term_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('term_id', term.id)

  const { data: existingMembership } = await admin
    .from('member_term_memberships')
    .select('id, dues_status, status, position_role')
    .eq('term_id', term.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (
    existingMembership &&
    ['active', 'exempt'].includes(existingMembership.status) &&
    existingMembership.position_role === positionCode.intended_role
  ) {
    return NextResponse.json({ success: true, status: existingMembership.status, termName: term.name })
  }

  if (positionCode.max_uses) {
    const { count } = await admin
      .from('position_code_claims')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', positionCode.id)
      .neq('status', 'declined')

    const { count: existingClaimCount } = await admin
      .from('position_code_claims')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', positionCode.id)
      .eq('user_id', user.id)
      .neq('status', 'declined')

    if ((count || 0) >= positionCode.max_uses && !existingClaimCount) {
      return NextResponse.json({ error: 'That position code has reached its use limit.' }, { status: 400 })
    }
  }

  const { data: existingCoverage } = await (admin as any)
    .from('dues_payment_terms')
    .select('term_id, dues_payments!inner(user_id)')
    .eq('term_id', term.id)
    .eq('dues_payments.user_id', user.id)
    .limit(1)
    .maybeSingle()
  const coveredByPriorPayment = Boolean(existingCoverage)

  // A code claim that changes the member's role (a promotion or demotion)
  // must not silently inherit "paid" from a payment made under the OLD
  // role's price - dues_prices varies by position_role, so a General Member
  // payment does not cover the Analyst rate. Only same-role reclaims and
  // brand-new claims may use the existing/prior payment signal. Admin-granted
  // exemptions are role-independent and always carry over.
  const isRoleChange = Boolean(existingMembership && existingMembership.position_role !== positionCode.intended_role)
  const duesStatus: 'unpaid' | 'paid' | 'exempt' =
    existingMembership?.dues_status === 'exempt'
      ? 'exempt'
      : !isRoleChange && (existingMembership?.dues_status === 'paid' || coveredByPriorPayment)
      ? 'paid'
      : 'unpaid'

  const membershipPayload = {
    term_id: term.id,
    user_id: user.id,
    status: ['paid', 'exempt'].includes(duesStatus) ? 'pending_approval' : 'pending_dues',
    dues_status: duesStatus,
    position_role: positionCode.intended_role,
    is_returning: (priorMembershipCount || 0) > 0,
    claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as const

  const { data: membership, error: membershipError } = await admin
    .from('member_term_memberships')
    .upsert(membershipPayload, { onConflict: 'term_id,user_id' })
    .select('id, status')
    .single()

  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })

  const { error: claimError } = await admin.from('position_code_claims').upsert(
    {
      term_id: term.id,
      membership_id: membership.id,
      code_id: positionCode.id,
      user_id: user.id,
      requested_role: positionCode.intended_role,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    },
    { onConflict: 'term_id,user_id' }
  )

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })

  return NextResponse.json({ success: true, status: membership.status, termName: term.name })
}
