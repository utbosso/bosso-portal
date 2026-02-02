import type { EventCategory } from '@/types/database.types'

export const POINTS_CATEGORIES: EventCategory[] = [
  'membership',
  'professional_education',
  'social',
  'philanthropy',
]

export type CategoryTotals = Record<EventCategory, number>

type AttendancePointsRow = {
  points_earned: number | null
  event_category: EventCategory | null
  event?: { event_category?: EventCategory | null } | Array<{ event_category?: EventCategory | null }> | null
}

type AdjustmentPointsRow = {
  points: number | null
  reason: string | null
}

export function getCategoryFromAdjustmentReason(reason: string | null): EventCategory | null {
  if (!reason) return null
  const match = reason.match(/\((membership|professional_education|social|philanthropy)\)\s*$/)
  return (match?.[1] as EventCategory) || null
}

function getEventCategoryFromJoin(
  event: AttendancePointsRow['event']
): EventCategory | null {
  if (!event) return null
  if (Array.isArray(event)) {
    return (event[0]?.event_category as EventCategory | null | undefined) ?? null
  }
  return (event.event_category as EventCategory | null | undefined) ?? null
}

export function buildCategoryTotals(
  attendanceRows: AttendancePointsRow[],
  adjustmentRows: AdjustmentPointsRow[]
): {
  categoryTotals: CategoryTotals
  totalPoints: number
  uncategorizedPoints: number
  eventsByCategory: Record<EventCategory, number>
} {
  const categoryTotals: CategoryTotals = {
    membership: 0,
    professional_education: 0,
    social: 0,
    philanthropy: 0,
  }

  const eventsByCategory: Record<EventCategory, number> = {
    membership: 0,
    professional_education: 0,
    social: 0,
    philanthropy: 0,
  }

  let totalPoints = 0
  let uncategorizedPoints = 0

  for (const row of attendanceRows) {
    const points = Number(row.points_earned || 0)
    const category = row.event_category ?? getEventCategoryFromJoin(row.event)
    totalPoints += points

    if (category && category in categoryTotals) {
      categoryTotals[category] += points
      eventsByCategory[category] += 1
    } else {
      uncategorizedPoints += points
    }
  }

  for (const row of adjustmentRows) {
    const points = Number(row.points || 0)
    const category = getCategoryFromAdjustmentReason(row.reason)
    totalPoints += points

    if (category && category in categoryTotals) {
      categoryTotals[category] += points
    } else {
      uncategorizedPoints += points
    }
  }

  return {
    categoryTotals,
    totalPoints,
    uncategorizedPoints,
    eventsByCategory,
  }
}
