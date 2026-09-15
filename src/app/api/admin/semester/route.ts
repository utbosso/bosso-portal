import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import type { EventCategory, UserRole } from '@/types/database.types'

const ROLES: UserRole[] = ['general_member', 'analyst', 'project_manager', 'board_member']
const CATEGORIES: EventCategory[] = ['membership', 'professional_education', 'social', 'philanthropy']
const PLAN_LENGTHS = ['semester', 'annual'] as const

// BOSSO no longer sets point requirements by category (membership/
// professional_education/social/philanthropy) - just one semester total per
// role. term_point_rules still stores one row per category to avoid a
// schema migration, so every role's total lives under this one category and
// the other three are kept at zero; dashboard/points already sum all four
// per role, so this reads back as a single flat total with no other change.
const TOTAL_POINTS_CATEGORY: EventCategory = 'membership'

function buildPointRuleRows(termId: string, minimumsByRole: Record<UserRole, number>, description: string, updatedAt: string) {
  return ROLES.flatMap((role) =>
    CATEGORIES.map((category) => ({
      term_id: termId,
      category,
      position_role: role,
      label: category === 'professional_education' ? 'Professional / Education' : category.charAt(0).toUpperCase() + category.slice(1),
      minimum_points: category === TOTAL_POINTS_CATEGORY ? minimumsByRole[role] : 0,
      target_points: null,
      description,
      updated_at: updatedAt,
    }))
  )
}

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

async function getAdminUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!isPortalAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const [terms, memberships, claims, profiles, codes, rules, groups, groupMembers, prices, checkoutSettings, duesPayments, duesPaymentTerms] = await Promise.all([
    admin.from('academic_terms').select('*').order('starts_on', { ascending: false }),
    admin.from('member_term_memberships').select('*').order('created_at', { ascending: false }),
    admin.from('position_code_claims').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, email, role').order('full_name'),
    admin.from('position_codes').select('id, term_id, label, intended_role, max_uses, expires_at, is_active, created_at').order('created_at'),
    admin.from('term_point_rules').select('*').order('category'),
    admin.from('term_member_groups').select('*').order('name'),
    admin.from('term_member_group_members').select('*'),
    admin.from('dues_prices').select('*'),
    admin.from('dues_checkout_settings').select('*').maybeSingle(),
    admin.from('dues_payments').select('id, user_id, source').order('created_at', { ascending: false }),
    admin.from('dues_payment_terms').select('payment_id, term_id'),
  ])

  const firstError = terms.error || memberships.error || claims.error || profiles.error || codes.error || rules.error || groups.error || groupMembers.error || prices.error || checkoutSettings.error || duesPayments.error || duesPaymentTerms.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  return NextResponse.json({
    terms: terms.data || [],
    memberships: memberships.data || [],
    claims: claims.data || [],
    profiles: profiles.data || [],
    codes: codes.data || [],
    rules: rules.data || [],
    groups: (groups.data || []).map((group) => ({
      ...group,
      member_ids: (groupMembers.data || [])
        .filter((member) => member.group_id === group.id)
        .map((member) => member.user_id),
    })),
    prices: prices.data || [],
    checkoutSettings: checkoutSettings.data || { pass_fee_to_member: false },
    duesPayments: duesPayments.data || [],
    duesPaymentTerms: duesPaymentTerms.data || [],
  })
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!isPortalAdminUser(user)) {
    return NextResponse.json({ error: 'Only internal@txbosso.com can run semester setup.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const action = body?.action
  const admin = createAdminClient()

  if (action === 'save_term') {
    const term = body?.term
    const name = typeof term?.name === 'string' ? term.name.trim() : ''
    const slug = typeof term?.slug === 'string' ? term.slug.trim().toLowerCase() : ''
    const semester = term?.semester
    const startsOn = term?.startsOn
    const endsOn = term?.endsOn
    const academicYear = typeof term?.academicYear === 'string' ? term.academicYear.trim() : ''
    if (!name || !slug || !['fall', 'spring', 'summer'].includes(semester) || !startsOn || !endsOn || !academicYear) {
      return NextResponse.json({ error: 'Complete every term field.' }, { status: 400 })
    }
    if (new Date(endsOn).getTime() < new Date(startsOn).getTime()) {
      return NextResponse.json({ error: 'The end date must be after the start date.' }, { status: 400 })
    }

    // Step 1 only prepares term details - it must never change a term's lifecycle
    // status or publish state. Only activate_academic_term moves status between
    // draft/upcoming/current/archived, and only update_point_rules publishes points.
    const { data: existingTerm } = await admin
      .from('academic_terms')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    const termFields = {
      name,
      slug,
      academic_year: academicYear,
      semester,
      starts_on: startsOn,
      ends_on: endsOn,
      renewal_opens_at: term.renewalOpensAt || null,
      updated_at: new Date().toISOString(),
    }

    const termResult = existingTerm
      ? await admin
          .from('academic_terms')
          .update(termFields)
          .eq('id', existingTerm.id)
          .select('*')
          .single()
      : await admin
          .from('academic_terms')
          .insert({ ...termFields, status: 'upcoming', points_rules_status: 'draft', created_by: user!.id })
          .select('*')
          .single()

    const { data: savedTerm, error: termError } = termResult
    if (termError) return NextResponse.json({ error: termError.message }, { status: 500 })

    const minimumsByRole: Record<UserRole, number> = {} as any
    for (const role of ROLES) minimumsByRole[role] = Math.max(0, Number(body?.minimums?.[role]) || 0)
    const { error: rulesError } = await admin.from('term_point_rules').upsert(
      buildPointRuleRows(savedTerm.id, minimumsByRole, 'Requirements are being finalized for this semester.', new Date().toISOString()),
      { onConflict: 'term_id,category,position_role' }
    )
    if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 })

    const requestedCodes: Array<{ label?: string; role?: UserRole; maxUses?: number | null }> = Array.isArray(body?.codes)
      ? body.codes
      : []
    const generatedCodes: Array<{ label: string; role: UserRole; code: string }> = []
    if (requestedCodes.length > 0) {
      const { error: deactivateError } = await admin
        .from('position_codes')
        .update({ is_active: false })
        .eq('term_id', savedTerm.id)
        .eq('is_active', true)
      if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 })
    }
    for (const requestedCode of requestedCodes) {
      if (!requestedCode.role || !ROLES.includes(requestedCode.role)) continue
      const plainCode = `BOSSO-${randomBytes(10).toString('hex').toUpperCase()}`
      const label = requestedCode.label?.trim() || `${requestedCode.role.replaceAll('_', ' ')} access`
      const { error: codeError } = await admin.from('position_codes').insert({
        term_id: savedTerm.id,
        label,
        code_hash: hashCode(plainCode),
        intended_role: requestedCode.role,
        max_uses: requestedCode.maxUses || null,
        expires_at: null,
        is_active: true,
        created_by: user!.id,
      })
      if (codeError) return NextResponse.json({ error: codeError.message }, { status: 500 })
      generatedCodes.push({ label, role: requestedCode.role, code: plainCode })
    }

    return NextResponse.json({ success: true, term: savedTerm, generatedCodes })
  }

  if (action === 'update_point_rules') {
    const termId = typeof body?.termId === 'string' ? body.termId : ''
    const status = body?.status === 'published' ? 'published' : 'draft'
    const minimumsByRole = body?.minimums
    if (!termId || !minimumsByRole || typeof minimumsByRole !== 'object') {
      return NextResponse.json({ error: 'Term and point requirements are required.' }, { status: 400 })
    }

    const normalizedMinimums: Record<UserRole, number> = {} as any
    for (const role of ROLES) normalizedMinimums[role] = Number(minimumsByRole?.[role])
    const hasInvalidValue = ROLES.some((role) => !Number.isFinite(normalizedMinimums[role]) || normalizedMinimums[role] < 0)
    if (hasInvalidValue) {
      return NextResponse.json({ error: 'Every point requirement must be a non-negative number.' }, { status: 400 })
    }

    const { data: target } = await admin.from('academic_terms').select('id, status').eq('id', termId).maybeSingle()
    if (!target) return NextResponse.json({ error: 'Term not found.' }, { status: 404 })
    if (target.status === 'archived') {
      return NextResponse.json({ error: 'Archived point rules are read-only.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const description =
      status === 'published'
        ? 'Published semester point requirement.'
        : 'Requirements are being finalized for this semester.'
    const { error: rulesError } = await admin.from('term_point_rules').upsert(
      buildPointRuleRows(termId, normalizedMinimums, description, now),
      { onConflict: 'term_id,category,position_role' }
    )
    if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 })

    const { error: termError } = await admin
      .from('academic_terms')
      .update({ points_rules_status: status, updated_at: now })
      .eq('id', termId)
    if (termError) return NextResponse.json({ error: termError.message }, { status: 500 })

    return NextResponse.json({ success: true, status })
  }

  if (action === 'manage_dues_pricing') {
    const termId = typeof body?.termId === 'string' ? body.termId : ''
    const pricesByRole = body?.prices
    const passFeeToMember = Boolean(body?.passFeeToMember)
    if (!termId || !pricesByRole || typeof pricesByRole !== 'object') {
      return NextResponse.json({ error: 'Term and pricing by position are required.' }, { status: 400 })
    }

    const rows: Array<{ term_id: string; position_role: UserRole; plan_length: (typeof PLAN_LENGTHS)[number]; amount_cents: number; updated_at: string }> = []
    const now = new Date().toISOString()
    for (const role of ROLES) {
      for (const planLength of PLAN_LENGTHS) {
        const amountNumber = Number(pricesByRole?.[role]?.[planLength])
        if (!Number.isFinite(amountNumber) || amountNumber < 0) {
          return NextResponse.json({ error: 'Every dues price must be a non-negative number.' }, { status: 400 })
        }
        rows.push({
          term_id: termId,
          position_role: role,
          plan_length: planLength,
          amount_cents: Math.round(amountNumber * 100),
          updated_at: now,
        })
      }
    }

    const { error: pricesError } = await admin
      .from('dues_prices')
      .upsert(rows, { onConflict: 'term_id,position_role,plan_length' })
    if (pricesError) return NextResponse.json({ error: pricesError.message }, { status: 500 })

    const { error: settingsError } = await admin
      .from('dues_checkout_settings')
      .update({ pass_fee_to_member: passFeeToMember, updated_at: now })
      .eq('id', true)
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  if (action === 'save_member_group') {
    const termId = typeof body?.termId === 'string' ? body.termId : ''
    const groupId = typeof body?.groupId === 'string' ? body.groupId : ''
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : ''
    const userIds = Array.from(new Set(
      Array.isArray(body?.userIds)
        ? body.userIds.filter((id: unknown): id is string => typeof id === 'string')
        : []
    )).slice(0, 500)

    if (!termId || name.length < 2 || userIds.length === 0) {
      return NextResponse.json({ error: 'Choose the current semester, a group name, and at least one member.' }, { status: 400 })
    }

    const { data: term } = await admin
      .from('academic_terms')
      .select('id, status')
      .eq('id', termId)
      .maybeSingle()
    if (!term || term.status !== 'current') {
      return NextResponse.json({ error: 'Custom groups can only be managed for the current semester.' }, { status: 409 })
    }

    const { data: approvedMemberships, error: membershipError } = await admin
      .from('member_term_memberships')
      .select('user_id')
      .eq('term_id', termId)
      .in('user_id', userIds)
      .in('status', ['active', 'exempt'])
      .in('dues_status', ['paid', 'exempt'])
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })

    const approvedIds = new Set((approvedMemberships || []).map((membership) => membership.user_id))
    if (approvedIds.size !== userIds.length) {
      return NextResponse.json({ error: 'Every group member must be approved for the current semester.' }, { status: 409 })
    }

    let savedGroupId = groupId
    if (groupId) {
      const { data: existing } = await admin
        .from('term_member_groups')
        .select('id')
        .eq('id', groupId)
        .eq('term_id', termId)
        .maybeSingle()
      if (!existing) return NextResponse.json({ error: 'Semester group not found.' }, { status: 404 })
      const { error: updateError } = await admin
        .from('term_member_groups')
        .update({ name, description: description || null, updated_at: new Date().toISOString() })
        .eq('id', groupId)
      if (updateError) {
        return NextResponse.json(
          { error: updateError.code === '23505' ? 'A group with that name already exists this semester.' : updateError.message },
          { status: updateError.code === '23505' ? 409 : 500 }
        )
      }
    } else {
      const { data: created, error: createError } = await admin
        .from('term_member_groups')
        .insert({ term_id: termId, name, description: description || null, created_by: user!.id })
        .select('id')
        .single()
      if (createError) {
        return NextResponse.json(
          { error: createError.code === '23505' ? 'A group with that name already exists this semester.' : createError.message },
          { status: createError.code === '23505' ? 409 : 500 }
        )
      }
      savedGroupId = created.id
    }

    const { error: clearError } = await admin
      .from('term_member_group_members')
      .delete()
      .eq('group_id', savedGroupId)
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })

    const { error: membersError } = await admin
      .from('term_member_group_members')
      .insert(userIds.map((userId) => ({ group_id: savedGroupId, user_id: userId })))
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

    return NextResponse.json({ success: true, groupId: savedGroupId })
  }

  if (action === 'delete_member_group') {
    const groupId = typeof body?.groupId === 'string' ? body.groupId : ''
    const termId = typeof body?.termId === 'string' ? body.termId : ''
    if (!groupId || !termId) return NextResponse.json({ error: 'Semester group is required.' }, { status: 400 })

    const { data: term } = await admin.from('academic_terms').select('status').eq('id', termId).maybeSingle()
    if (!term || term.status !== 'current') {
      return NextResponse.json({ error: 'Only current-semester groups can be deleted.' }, { status: 409 })
    }
    const { error: deleteError } = await admin
      .from('term_member_groups')
      .delete()
      .eq('id', groupId)
      .eq('term_id', termId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'activate_term') {
    const termId = typeof body?.termId === 'string' ? body.termId : ''
    if (!termId) return NextResponse.json({ error: 'Term not found.' }, { status: 404 })

    const { data: activation, error: activationError } = await (admin as any).rpc(
      'activate_academic_term',
      { target_term_id: termId, run_by_user_id: user!.id }
    )

    if (activationError) {
      const status = activationError.code === 'P0002'
        ? 404
        : activationError.code === '22023'
          ? 409
          : activationError.code === '42501'
            ? 403
            : 500
      return NextResponse.json({ error: activationError.message }, { status })
    }

    return NextResponse.json({ success: true, ...(activation || {}) })
  }

  if (action === 'record_dues') {
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const termIds = Array.isArray(body?.termIds) ? body.termIds.filter((id: unknown) => typeof id === 'string') : []
    const amountCents = body?.amountCents == null ? null : Number(body.amountCents)
    if (!userId || termIds.length === 0 || (amountCents !== null && (!Number.isInteger(amountCents) || amountCents < 0))) {
      return NextResponse.json({ error: 'Member, dues coverage, and a valid amount are required.' }, { status: 400 })
    }

    const { data: payment, error: paymentError } = await admin
      .from('dues_payments')
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        payment_reference: typeof body?.reference === 'string' ? body.reference.trim() || null : null,
        paid_at: new Date().toISOString(),
        recorded_by: user!.id,
        note: typeof body?.note === 'string' ? body.note.trim() || null : null,
      })
      .select('id')
      .single()
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

    const { error: coverageError } = await admin
      .from('dues_payment_terms')
      .insert(termIds.map((termId: string) => ({ payment_id: payment.id, term_id: termId })))
    if (coverageError) return NextResponse.json({ error: coverageError.message }, { status: 500 })

    for (const termId of termIds) {
      const { data: membership } = await admin
        .from('member_term_memberships')
        .select('id, status')
        .eq('term_id', termId)
        .eq('user_id', userId)
        .maybeSingle()
      if (membership) {
        await admin
          .from('member_term_memberships')
          .update({
            dues_status: 'paid',
            status: membership.status === 'active' ? 'active' : 'pending_approval',
            updated_at: new Date().toISOString(),
          })
          .eq('id', membership.id)
      }
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'update_membership_position') {
    const membershipId = typeof body?.membershipId === 'string' ? body.membershipId : ''
    const positionRole = body?.positionRole
    const allRoles: UserRole[] = [...ROLES, 'admin']
    if (!membershipId || !allRoles.includes(positionRole)) {
      return NextResponse.json({ error: 'Membership and a valid position are required.' }, { status: 400 })
    }

    const { data: membership } = await admin
      .from('member_term_memberships')
      .select('user_id, status')
      .eq('id', membershipId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 })

    // The position a member claimed via their code (last year's leftover code,
    // a typo, sharing someone else's) isn't proof of their actual current
    // role - this lets an admin correct it. If they're already approved for
    // this term, profiles.role was already copied from the old value and
    // needs the same correction so the rest of the app (pricing, dashboards)
    // reflects the fix immediately instead of only from the next renewal.
    const now = new Date().toISOString()
    const { error: membershipError } = await admin
      .from('member_term_memberships')
      .update({ position_role: positionRole, updated_at: now })
      .eq('id', membershipId)
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })

    if (['active', 'exempt'].includes(membership.status)) {
      const { error: profileError } = await admin
        .from('profiles')
        .update({ role: positionRole })
        .eq('id', membership.user_id)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'review_membership') {
    const membershipId = typeof body?.membershipId === 'string' ? body.membershipId : ''
    const decision = body?.decision
    if (!membershipId || !['approve', 'decline'].includes(decision)) {
      return NextResponse.json({ error: 'Membership and decision are required.' }, { status: 400 })
    }

    const { data: membership } = await admin
      .from('member_term_memberships')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 })
    if (decision === 'approve' && !['paid', 'exempt'].includes(membership.dues_status)) {
      return NextResponse.json({ error: 'Record dues before approving portal access.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { error: reviewError } = await admin
      .from('member_term_memberships')
      .update({
        status: decision === 'approve' ? 'active' : 'declined',
        approved_at: decision === 'approve' ? now : null,
        approved_by: user!.id,
        admin_note: typeof body?.note === 'string' ? body.note.trim() || null : null,
        updated_at: now,
      })
      .eq('id', membershipId)
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })

    await admin
      .from('position_code_claims')
      .update({
        status: decision === 'approve' ? 'approved' : 'declined',
        reviewed_by: user!.id,
        reviewed_at: now,
        review_note: typeof body?.note === 'string' ? body.note.trim() || null : null,
      })
      .eq('membership_id', membershipId)

    if (decision === 'approve') {
      const { error: profileError } = await admin
        .from('profiles')
        .update({ role: membership.position_role, account_status: 'approved' })
        .eq('id', membership.user_id)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown semester action.' }, { status: 400 })
}
