'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EVENT_CATEGORIES, MINIMUM_REQUIREMENTS } from '@/lib/bosso-points'
import { POINTS_CATEGORIES, buildCategoryTotals } from '@/lib/points-calculations'
import type { EventCategory } from '@/types/database.types'
import { Folder, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

const supabase = createClient()

type CategoryPoints = {
  category: EventCategory
  category_label: string
  category_points: number
  events_attended: number
  max_possible_points: number
}

type Props = {
  userId: string
  showTitle?: boolean
  compact?: boolean
}

export default function CategoryPointsBreakdown({ userId, showTitle = true, compact = false }: Props) {
  const [categoryData, setCategoryData] = useState<CategoryPoints[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [uncategorizedPoints, setUncategorizedPoints] = useState(0)
  const [minimums, setMinimums] = useState<Record<EventCategory, number>>({
    membership: MINIMUM_REQUIREMENTS.perCategory,
    professional_education: MINIMUM_REQUIREMENTS.perCategory,
    social: MINIMUM_REQUIREMENTS.perCategory,
    philanthropy: MINIMUM_REQUIREMENTS.perCategory,
  })
  const [rulesFinalized, setRulesFinalized] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchCategoryBreakdown()
    }
  }, [userId])

  const fetchCategoryBreakdown = async () => {
    setLoading(true)
    try {
      const { data: currentTerm, error: termError } = await supabase
        .from('academic_terms')
        .select('id, points_rules_status')
        .eq('status', 'current')
        .maybeSingle()

      if (!termError && currentTerm) {
        const [summaryResult, ledgerResult, rulesResult] = await Promise.all([
          supabase
            .from('member_term_point_summary')
            .select('*')
            .eq('term_id', currentTerm.id)
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('point_ledger')
            .select('category, source_type')
            .eq('term_id', currentTerm.id)
            .eq('user_id', userId)
            .is('voided_at', null),
          supabase.from('term_point_rules').select('*').eq('term_id', currentTerm.id),
        ])

        if (!summaryResult.error && !ledgerResult.error && !rulesResult.error) {
          const summary = summaryResult.data
          const nextMinimums = { membership: 0, professional_education: 0, social: 0, philanthropy: 0 } as Record<EventCategory, number>
          for (const rule of rulesResult.data || []) nextMinimums[rule.category as EventCategory] = Number(rule.minimum_points || 0)
          const attendanceCounts = { membership: 0, professional_education: 0, social: 0, philanthropy: 0 } as Record<EventCategory, number>
          for (const entry of ledgerResult.data || []) {
            if (entry.source_type === 'attendance') attendanceCounts[entry.category as EventCategory] += 1
          }

          setCategoryData(
            POINTS_CATEGORIES.map((category) => {
              const rule = (rulesResult.data || []).find((item) => item.category === category)
              const pointsKey = `${category}_points` as keyof typeof summary
              const points = Number(summary?.[pointsKey] || 0)
              return {
                category,
                category_label: EVENT_CATEGORIES[category].label,
                category_points: points,
                events_attended: attendanceCounts[category],
                max_possible_points: Math.max(Number(rule?.target_points || 0), Number(rule?.minimum_points || 0), points, 1),
              }
            })
          )
          setTotalPoints(Number(summary?.total_points || 0))
          setUncategorizedPoints(0)
          setMinimums(nextMinimums)
          setRulesFinalized(currentTerm.points_rules_status === 'published')
          return
        }
      }

      // Compatibility fallback until the semester migration is applied.
      const [attendanceResult, adjustmentsResult] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('points_earned, event_category, event:events(event_category)')
          .eq('user_id', userId),
        supabase
          .from('points_adjustments')
          .select('points, reason')
          .eq('user_id', userId),
      ])

      if (attendanceResult.error) {
        console.error('Error fetching attendance points:', attendanceResult.error)
        return
      }

      if (adjustmentsResult.error) {
        console.error('Error fetching adjustment points:', adjustmentsResult.error)
        return
      }

      const { categoryTotals, totalPoints, uncategorizedPoints, eventsByCategory } =
        buildCategoryTotals(attendanceResult.data || [], adjustmentsResult.data || [])

      const completeData: CategoryPoints[] = POINTS_CATEGORIES.map((cat) => {
        const catInfo = EVENT_CATEGORIES[cat]
        return {
          category: cat,
          category_label: catInfo.label,
          category_points: categoryTotals[cat],
          events_attended: eventsByCategory[cat],
          max_possible_points: catInfo.maxPoints,
        }
      })

      setCategoryData(completeData)
      setTotalPoints(totalPoints)
      setUncategorizedPoints(uncategorizedPoints)
      setRulesFinalized(true)
    } catch (err) {
      console.error('Error fetching category breakdown:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const refresh = () => void fetchCategoryBreakdown()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (loading) {
    return (
      <div className="card-glow p-6 space-y-4">
        <div className="h-6 bg-dark-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-dark-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Check active status
  const totalMinimum = Object.values(minimums).reduce((sum, value) => sum + value, 0)
  const meetsTotal = totalPoints >= totalMinimum
  const missingCategories = categoryData.filter(
    (cat) => cat.category_points < minimums[cat.category]
  )
  const isActive = rulesFinalized && meetsTotal && missingCategories.length === 0

  if (compact) {
    return (
      <div className="space-y-3">
        {showTitle && (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Folder className="w-4 h-4 text-primary" />
              Points by Category
            </h3>
            <div className="flex items-center gap-2">
              {!rulesFinalized ? (
                <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Finalizing
                </span>
              ) : isActive ? (
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Meets requirements
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Below minimums
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categoryData.map((cat) => {
            const categoryInfo = EVENT_CATEGORIES[cat.category]
            const percentage = (cat.category_points / cat.max_possible_points) * 100
            const meetsMinimum = cat.category_points >= minimums[cat.category]

            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{cat.category_label}</span>
                  <span className={`font-medium ${!rulesFinalized ? 'text-foreground' : meetsMinimum ? 'text-green-400' : 'text-orange-400'}`}>
                    {rulesFinalized ? `${cat.category_points} / ${minimums[cat.category]} min` : `${cat.category_points} earned`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-dark-200 rounded-full border border-primary/20">
                  <div
                    className={`h-full rounded-full transition-all ${categoryInfo.color.split(' ')[0]}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {!rulesFinalized ? (
          <div className="text-xs text-muted-foreground bg-dark-200/50 border border-primary/10 rounded-lg p-3">
            Point minimums are being finalized for this semester. Your approved points are still recorded normally.
          </div>
        ) : !isActive && (
          <div className="text-xs text-muted-foreground bg-dark-200/50 border border-primary/10 rounded-lg p-3 space-y-1">
            <p className="font-medium text-orange-400">Requirements for Active Status:</p>
            {uncategorizedPoints !== 0 && (
              <p className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                {uncategorizedPoints} uncategorized points still count toward total
              </p>
            )}
            {!meetsTotal && (
              <p className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Need {totalMinimum - totalPoints} more total points
              </p>
            )}
            {missingCategories.map((cat) => (
              <p key={cat.category} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Need {minimums[cat.category] - cat.category_points} more in {cat.category_label}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card-glow p-6 space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Points Breakdown by Category
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{totalPoints}</p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
            {!rulesFinalized ? (
              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1.5 text-sm font-medium">
                <AlertCircle className="w-4 h-4" /> Requirements finalizing
              </span>
            ) : isActive ? (
              <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Point requirements met
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                Below point minimums
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryData.map((cat) => {
          const categoryInfo = EVENT_CATEGORIES[cat.category]
          const percentage = (cat.category_points / cat.max_possible_points) * 100
          const meetsMinimum = cat.category_points >= minimums[cat.category]

          return (
            <div
              key={cat.category}
              className={`p-4 rounded-lg border ${categoryInfo.color.split('bg-')[1].split('/')[0] === 'orange' ? 'border-orange-500/30 bg-orange-500/5' : categoryInfo.color.split('bg-')[1].split('/')[0] === 'blue' ? 'border-blue-500/30 bg-blue-500/5' : categoryInfo.color.split('bg-')[1].split('/')[0] === 'purple' ? 'border-purple-500/30 bg-purple-500/5' : 'border-green-500/30 bg-green-500/5'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Folder className={`w-5 h-5 ${categoryInfo.color.split(' ')[1]}`} />
                  <h3 className="text-sm font-semibold text-foreground">{cat.category_label}</h3>
                </div>
                {!rulesFinalized ? (
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                ) : meetsMinimum ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-foreground">{cat.category_points}</span>
                  <span className="text-xs text-muted-foreground">
                    {cat.max_possible_points}+ possible
                  </span>
                </div>

                <div className="w-full h-2 bg-dark-200 rounded-full border border-primary/20">
                  <div
                    className={`h-full rounded-full transition-all ${categoryInfo.color.split(' ')[0]}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{cat.events_attended} events attended</span>
                  <span className={`font-medium ${meetsMinimum ? 'text-green-400' : 'text-orange-400'}`}>
                    {!rulesFinalized ? 'Minimum finalizing' : meetsMinimum ? 'Meets minimum' : `Need ${minimums[cat.category] - cat.category_points} more`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!rulesFinalized ? (
        <div className="portal-alert-info">
          Point minimums are still being finalized. Approved points will continue to appear above.
        </div>
      ) : !isActive ? (
        <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: 'hsl(var(--warning-border))', backgroundColor: 'hsl(var(--warning-surface))' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ color: 'hsl(var(--warning))', backgroundColor: 'hsl(var(--background) / 0.65)' }}>
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your next point goal</h3>
              <p className="mt-1 text-sm text-muted-foreground">Only the remaining category gaps are shown here.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {missingCategories.map((cat) => (
              <span key={cat.category} className="rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'hsl(var(--warning-border))', color: 'hsl(var(--warning))', backgroundColor: 'hsl(var(--background) / 0.7)' }}>
                <strong>{minimums[cat.category] - cat.category_points}</strong> more in {cat.category_label}
              </span>
            ))}
            {missingCategories.length === 0 && !meetsTotal && (
              <span className="rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'hsl(var(--warning-border))', color: 'hsl(var(--warning))', backgroundColor: 'hsl(var(--background) / 0.7)' }}>
                <strong>{totalMinimum - totalPoints}</strong> more total points
              </span>
            )}
          </div>
          {uncategorizedPoints !== 0 && <p className="mt-3 text-xs text-muted-foreground">Your {uncategorizedPoints} uncategorized points are already included in the semester total.</p>}
        </div>
      ) : null}
    </div>
  )
}
