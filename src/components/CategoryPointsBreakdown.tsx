'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EVENT_CATEGORIES, MINIMUM_REQUIREMENTS } from '@/lib/bosso-points'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchCategoryBreakdown()
    }
  }, [userId])

  const fetchCategoryBreakdown = async () => {
    setLoading(true)
    try {
      // Fetch category breakdown
      const { data, error } = await supabase.rpc('get_user_points_by_category', {
        user_uuid: userId,
      })

      if (error) {
        console.error('Error fetching category breakdown:', error)
        return
      }

      // Ensure all 4 categories are present (fill with 0 if missing)
      const allCategories: EventCategory[] = [
        'membership',
        'professional_education',
        'social',
        'philanthropy',
      ]

      const categoryMap = new Map<EventCategory, CategoryPoints>()
      data?.forEach((item: any) => {
        categoryMap.set(item.category, {
          category: item.category,
          category_label: item.category_label,
          category_points: item.category_points,
          events_attended: item.events_attended,
          max_possible_points: item.max_possible_points,
        })
      })

      // Fill in missing categories with zeros
      const completeData: CategoryPoints[] = allCategories.map((cat) => {
        if (categoryMap.has(cat)) {
          return categoryMap.get(cat)!
        } else {
          const catInfo = EVENT_CATEGORIES[cat]
          return {
            category: cat,
            category_label: catInfo.label,
            category_points: 0,
            events_attended: 0,
            max_possible_points: catInfo.maxPoints,
          }
        }
      })

      setCategoryData(completeData)

      // Calculate total
      const total = completeData.reduce((sum, cat) => sum + cat.category_points, 0)
      setTotalPoints(total)
    } catch (err) {
      console.error('Error fetching category breakdown:', err)
    } finally {
      setLoading(false)
    }
  }

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
  const meetsTotal = totalPoints >= MINIMUM_REQUIREMENTS.totalPoints
  const missingCategories = categoryData.filter(
    (cat) => cat.category_points < MINIMUM_REQUIREMENTS.perCategory
  )
  const isActive = meetsTotal && missingCategories.length === 0

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
              {isActive ? (
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Inactive
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categoryData.map((cat) => {
            const categoryInfo = EVENT_CATEGORIES[cat.category]
            const percentage = (cat.category_points / cat.max_possible_points) * 100
            const meetsMinimum = cat.category_points >= MINIMUM_REQUIREMENTS.perCategory

            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{cat.category_label}</span>
                  <span className={`font-medium ${meetsMinimum ? 'text-green-400' : 'text-orange-400'}`}>
                    {cat.category_points} / {MINIMUM_REQUIREMENTS.perCategory} min
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

        {!isActive && (
          <div className="text-xs text-muted-foreground bg-dark-200/50 border border-primary/10 rounded-lg p-3 space-y-1">
            <p className="font-medium text-orange-400">Requirements for Active Status:</p>
            {!meetsTotal && (
              <p className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Need {MINIMUM_REQUIREMENTS.totalPoints - totalPoints} more total points
              </p>
            )}
            {missingCategories.map((cat) => (
              <p key={cat.category} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Need {MINIMUM_REQUIREMENTS.perCategory - cat.category_points} more in {cat.category_label}
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
            {isActive ? (
              <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Active Member
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                Inactive
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryData.map((cat) => {
          const categoryInfo = EVENT_CATEGORIES[cat.category]
          const percentage = (cat.category_points / cat.max_possible_points) * 100
          const meetsMinimum = cat.category_points >= MINIMUM_REQUIREMENTS.perCategory

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
                {meetsMinimum ? (
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
                    {meetsMinimum ? 'Meets minimum' : `Need ${MINIMUM_REQUIREMENTS.perCategory - cat.category_points} more`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-dark-200/50 border border-primary/10 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Active Member Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Points:</span>
            <span className={`font-medium ${meetsTotal ? 'text-green-400' : 'text-orange-400'}`}>
              {totalPoints} / {MINIMUM_REQUIREMENTS.totalPoints} {meetsTotal ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Category Minimums:</span>
            <span className={`font-medium ${missingCategories.length === 0 ? 'text-green-400' : 'text-orange-400'}`}>
              {MINIMUM_REQUIREMENTS.perCategory}+ each {missingCategories.length === 0 ? '✓' : '✗'}
            </span>
          </div>
        </div>

        {!isActive && (
          <div className="pt-3 border-t border-primary/10 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-orange-400">To become an active member, you need:</p>
            {!meetsTotal && (
              <p className="flex items-center gap-1.5 pl-4">
                • {MINIMUM_REQUIREMENTS.totalPoints - totalPoints} more total points
              </p>
            )}
            {missingCategories.map((cat) => (
              <p key={cat.category} className="flex items-center gap-1.5 pl-4">
                • {MINIMUM_REQUIREMENTS.perCategory - cat.category_points} more points in {cat.category_label}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
