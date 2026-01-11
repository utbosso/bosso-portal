import type { EventCategory, EventType } from '@/types/database.types'

// =====================================================
// BOSSO MEMBERSHIP POINTS SYSTEM (SPRING 2026)
// =====================================================

// Event Category Information
export const EVENT_CATEGORIES: Record<EventCategory, {
  label: string
  description: string
  maxPoints: number
  minRequired: number
  color: string
}> = {
  membership: {
    label: 'Membership',
    description: 'Baseline responsibilities expected of all BOSSO members',
    maxPoints: 50,
    minRequired: 25,
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  professional_education: {
    label: 'Professional / Education',
    description: 'Professional development and industry exposure',
    maxPoints: 100,
    minRequired: 25,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  social: {
    label: 'Social',
    description: 'Internal community and cross-role engagement',
    maxPoints: 75,
    minRequired: 25,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  philanthropy: {
    label: 'Philanthropy',
    description: 'Service, impact, and community involvement',
    maxPoints: 75,
    minRequired: 25,
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
}

// Event Type Information with Default Points
export const EVENT_TYPES: Record<EventType, {
  label: string
  points: number | null
  category: EventCategory
  description?: string
  isRecurring?: boolean
  maxPerSemester?: number
}> = {
  // Membership Events (50+ possible points)
  membership_profile_creation: {
    label: 'Membership Profile Creation',
    points: 5,
    category: 'membership',
    description: 'Complete your BOSSO member profile',
    maxPerSemester: 1,
  },
  on_time_dues_payment: {
    label: 'On-Time Dues Payment',
    points: 5,
    category: 'membership',
    description: 'Pay semester dues by deadline',
    maxPerSemester: 1,
  },
  resume_book_submission: {
    label: 'Resume Book Submission',
    points: 5,
    category: 'membership',
    description: 'Submit resume for BOSSO resume book',
    maxPerSemester: 1,
  },
  semester_reflection: {
    label: 'Semester Reflection (Role-Based)',
    points: 5,
    category: 'membership',
    description: 'Complete end-of-semester reflection',
    maxPerSemester: 1,
  },
  profit_share_participation: {
    label: 'Profit Share Participation',
    points: 3,
    category: 'membership',
    description: '3 points each, up to 15 points total',
    isRecurring: true,
    maxPerSemester: 5,
  },
  tabling_recruitment: {
    label: 'Tabling / Recruitment Help',
    points: 3,
    category: 'membership',
    description: '3 points each, up to 15 points total',
    isRecurring: true,
    maxPerSemester: 5,
  },

  // Professional / Education Events (100+ possible points)
  general_meeting: {
    label: 'General Meeting',
    points: 2,
    category: 'professional_education',
    description: '2 points each, up to 20 points total',
    isRecurring: true,
    maxPerSemester: 10,
  },
  workshop_attendance: {
    label: 'Workshop Attendance',
    points: 10,
    category: 'professional_education',
    description: '10 points per workshop',
    isRecurring: true,
  },
  director_board_coffee_chat: {
    label: 'Director / Board Coffee Chat',
    points: 5,
    category: 'professional_education',
    description: '5 points each, up to 15 points total',
    isRecurring: true,
    maxPerSemester: 3,
  },
  boss_attendance: {
    label: 'BOSS Conference Attendance',
    points: 15,
    category: 'professional_education',
    description: 'Attend BOSS Conference',
    maxPerSemester: 1,
  },
  case_competition_participation: {
    label: 'Case Competition Participation',
    points: 15,
    category: 'professional_education',
    description: 'Participate in case competition',
    isRecurring: true,
  },
  member_project_participation: {
    label: 'Member Project Participation',
    points: 25,
    category: 'professional_education',
    description: 'Contribute to a BOSSO project',
    isRecurring: true,
  },

  // Social Events (75+ possible points)
  semesterly_org_social: {
    label: 'Semesterly Org-Wide Social Event',
    points: 15,
    category: 'social',
    description: 'Attend semester-wide social event',
    maxPerSemester: 1,
  },
  project_team_social: {
    label: 'Project Team Social Event',
    points: 5,
    category: 'social',
    description: '5 points each, up to 15 points total',
    isRecurring: true,
    maxPerSemester: 3,
  },
  role_based_social: {
    label: 'Role-Based Social Event',
    points: 20,
    category: 'social',
    description: 'Attend role-specific social event',
    isRecurring: true,
  },
  org_wide_social: {
    label: 'Org-Wide Social Event',
    points: 5,
    category: 'social',
    description: '5 points each, up to 25 points total',
    isRecurring: true,
    maxPerSemester: 5,
  },

  // Philanthropy Events (75+ possible points)
  boss_volunteering_shift: {
    label: 'BOSS Volunteering Shift',
    points: 10,
    category: 'philanthropy',
    description: 'Volunteer at BOSS Conference',
    isRecurring: true,
  },
  individual_service_event: {
    label: 'Individual Service Event',
    points: 5,
    category: 'philanthropy',
    description: '5 points each, up to 15 points total',
    isRecurring: true,
    maxPerSemester: 3,
  },
  bosso_service_event: {
    label: 'BOSSO Service Event',
    points: 5,
    category: 'philanthropy',
    description: '5 points each, up to 20 points total',
    isRecurring: true,
    maxPerSemester: 4,
  },
  multi_org_service_event: {
    label: 'Multi-Org Service Event',
    points: 15,
    category: 'philanthropy',
    description: '15 points each, up to 30 points total',
    isRecurring: true,
    maxPerSemester: 2,
  },

  // Other
  other: {
    label: 'Other',
    points: null,
    category: 'membership',
    description: 'Custom event type with custom points',
  },
}

// Minimum Requirements for Active Status
export const MINIMUM_REQUIREMENTS = {
  totalPoints: 100,
  perCategory: 25,
}

// Get event types by category
export function getEventTypesByCategory(category: EventCategory): Array<{
  value: EventType
  label: string
  points: number | null
  description?: string
}> {
  const types = Object.entries(EVENT_TYPES)
    .filter(([type, info]) => info.category === category || type === 'other')
    .map(([type, info]) => ({
      value: type as EventType,
      label: info.label,
      points: info.points,
      description: info.description,
    }))

  // Move "Other" to the end of the list
  const otherIndex = types.findIndex(t => t.value === 'other')
  if (otherIndex !== -1) {
    const other = types.splice(otherIndex, 1)[0]
    types.push(other)
  }

  return types
}

// Get default points for an event type
export function getDefaultPoints(eventType: EventType): number | null {
  return EVENT_TYPES[eventType].points
}

// Get event type label
export function getEventTypeLabel(eventType: EventType): string {
  return EVENT_TYPES[eventType].label
}

// Get event category label
export function getEventCategoryLabel(category: EventCategory): string {
  return EVENT_CATEGORIES[category].label
}

// Get event category color
export function getEventCategoryColor(category: EventCategory): string {
  return EVENT_CATEGORIES[category].color
}

// Get category info
export function getCategoryInfo(category: EventCategory) {
  return EVENT_CATEGORIES[category]
}

// Check if user meets active status requirements
export function checkActiveStatus(categoryPoints: Record<EventCategory, number>): {
  isActive: boolean
  totalPoints: number
  meetsTotal: boolean
  meetsPerCategory: boolean
  missingCategories: EventCategory[]
} {
  const total = Object.values(categoryPoints).reduce((sum, points) => sum + points, 0)
  const meetsTotal = total >= MINIMUM_REQUIREMENTS.totalPoints

  const missingCategories: EventCategory[] = []
  let meetsPerCategory = true

  for (const [category, points] of Object.entries(categoryPoints) as [EventCategory, number][]) {
    if (points < MINIMUM_REQUIREMENTS.perCategory) {
      meetsPerCategory = false
      missingCategories.push(category)
    }
  }

  return {
    isActive: meetsTotal && meetsPerCategory,
    totalPoints: total,
    meetsTotal,
    meetsPerCategory,
    missingCategories,
  }
}
