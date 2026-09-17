import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { loadCurrentTermMembers } from '@/lib/current-term-recipients'

// The admin Points Breakdown tab used to query member_term_point_summary
// and point_ledger directly from the browser with no user_id filter -
// correct only if row-level security grants this account broad read access
// across every member's rows, which for a plain authenticated session isn't
// something to assume. The per-member totals (via the view) could plausibly
// still resolve while the raw point_ledger rows backing "View Details"
// didn't, since a member's own row is always visible to themselves but nothing
// here confirmed the admin account could see everyone else's. Running this
// under the service role sidesteps the question entirely.
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isPortalAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  let context
  try {
    context = await loadCurrentTermMembers(admin)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Members could not be loaded.' }, { status: 500 })
  }
  const eligibleMembers = context.members.filter((member) => member.role !== 'admin')

  const { data: currentTerm, error: currentTermError } = await admin
    .from('academic_terms')
    .select('id, points_rules_status')
    .eq('status', 'current')
    .maybeSingle()

  if (currentTermError) return NextResponse.json({ error: currentTermError.message }, { status: 500 })
  if (!currentTerm) {
    return NextResponse.json({ requirementsPublished: false, requiredPointsByRole: {}, pointsData: [] })
  }

  const [summariesResult, ledgerResult, rulesResult] = await Promise.all([
    admin.from('member_term_point_summary').select('*').eq('term_id', currentTerm.id),
    admin
      .from('point_ledger')
      .select('*')
      .eq('term_id', currentTerm.id)
      .is('voided_at', null)
      .order('occurred_at', { ascending: false }),
    admin.from('term_point_rules').select('*').eq('term_id', currentTerm.id),
  ])

  const firstError = summariesResult.error || ledgerResult.error || rulesResult.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const summariesByUser = new Map((summariesResult.data || []).map((row: any) => [row.user_id, row]))
  type SourceEntry = { id: string; title: string; points: number; timestamp: string }
  const emptySources = (): Record<string, SourceEntry[]> => ({
    membership: [],
    professional_education: [],
    social: [],
    philanthropy: [],
    uncategorized: [],
  })
  const sourcesByUser = new Map<string, Record<string, SourceEntry[]>>()
  const requiredByRole: Record<string, number> = {}
  for (const rule of rulesResult.data || []) {
    const role = (rule as any).position_role as string
    requiredByRole[role] = (requiredByRole[role] || 0) + Number(rule.minimum_points || 0)
  }

  const knownCategories = ['membership', 'professional_education', 'social', 'philanthropy']
  for (const entry of ledgerResult.data || []) {
    const sources = sourcesByUser.get(entry.user_id) || emptySources()
    const category = knownCategories.includes(entry.category) ? entry.category : 'uncategorized'
    sources[category].push({
      id: entry.id,
      title: entry.note || String(entry.source_type).replaceAll('_', ' '),
      points: Number(entry.points || 0),
      timestamp: entry.occurred_at,
    })
    sourcesByUser.set(entry.user_id, sources)
  }

  const requirementsPublished = currentTerm.points_rules_status === 'published'

  const pointsData = eligibleMembers.map((member) => {
    const summary: any = summariesByUser.get(member.id)
    const total = Number(summary?.total_points || 0)
    const meetsRequirement = total >= (requiredByRole[member.role] || 0)

    return {
      user_id: member.id,
      full_name: member.full_name,
      email: member.email,
      role: member.role,
      total_points: total,
      membership_points: Number(summary?.membership_points || 0),
      professional_points: Number(summary?.professional_education_points || 0),
      social_points: Number(summary?.social_points || 0),
      philanthropy_points: Number(summary?.philanthropy_points || 0),
      uncategorized_points: 0,
      is_active: requirementsPublished && meetsRequirement,
      source_breakdown: sourcesByUser.get(member.id) || emptySources(),
    }
  })

  return NextResponse.json({ requirementsPublished, requiredPointsByRole: requiredByRole, pointsData })
}
