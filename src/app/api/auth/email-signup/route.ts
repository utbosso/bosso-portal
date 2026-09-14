import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Email/password accounts are created here (service role) instead of via the
// client-side supabase.auth.signUp(), which would trigger Supabase's own
// automatic confirmation email for every signup. Verification is instead a
// manual step an admin does from User Management (send a Gmail draft, mark
// verified once the member replies) - see sendVerificationEmail/
// markEmailVerified in src/app/admin/page.tsx - to avoid unbounded Supabase
// email volume/cost as the org grows. Google sign-in is unaffected; Google
// already verifies the email address itself, no email is ever sent either way.

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!fullName) return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
  if (!email.endsWith('@eid.utexas.edu') && !email.endsWith('@my.utexas.edu')) {
    return NextResponse.json(
      { error: 'Only @eid.utexas.edu and @my.utexas.edu email addresses are allowed for email/password signup.' },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 })
  }
  if (code.length < 4 || code.length > 80) {
    return NextResponse.json({ error: 'Enter the position code provided by the board.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: term, error: termError } = await admin
    .from('academic_terms')
    .select('id')
    .eq('status', 'current')
    .maybeSingle()
  if (termError) return NextResponse.json({ error: termError.message }, { status: 500 })
  if (!term) return NextResponse.json({ error: 'The current semester is not open yet.' }, { status: 409 })

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

  if (positionCode.max_uses) {
    const { count } = await admin
      .from('position_code_claims')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', positionCode.id)
      .neq('status', 'declined')
    if ((count || 0) >= positionCode.max_uses) {
      return NextResponse.json({ error: 'That position code has reached its use limit.' }, { status: 400 })
    }
  }

  // email_confirm: true so Supabase never emails this account or blocks its
  // login on its own - profiles.email_verified (manual, admin-set) is the
  // real gate, enforced by useAuth.
  const { data: created, error: createError } = await (admin as any).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError || !created?.user) {
    return NextResponse.json({ error: createError?.message || 'Failed to create account.' }, { status: 400 })
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    email,
    full_name: fullName,
    account_status: 'pending_approval',
    role: 'general_member',
    email_verified: false,
  })
  if (profileError) {
    await (admin as any).auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const { data: membership, error: membershipError } = await admin
    .from('member_term_memberships')
    .upsert(
      {
        term_id: term.id,
        user_id: created.user.id,
        status: 'pending_dues',
        dues_status: 'unpaid',
        position_role: positionCode.intended_role,
        is_returning: false,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'term_id,user_id' }
    )
    .select('id')
    .single()
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })

  const { error: claimError } = await admin.from('position_code_claims').upsert(
    {
      term_id: term.id,
      membership_id: membership.id,
      code_id: positionCode.id,
      user_id: created.user.id,
      requested_role: positionCode.intended_role,
      status: 'pending',
    },
    { onConflict: 'term_id,user_id' }
  )
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
