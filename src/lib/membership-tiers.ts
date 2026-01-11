import type { UserRole } from '@/types/database.types'

// =====================================================
// BOSSO MEMBERSHIP TIERS (SPRING 2026)
// =====================================================
// Based on official BOSSO Membership Tiers, Roles & Eligibility

export const MEMBERSHIP_TIERS = {
  inactive: {
    role: 'general_member' as UserRole,
    label: 'Inactive Member',
    minPoints: 0,
    maxPoints: 99,
    requiresCategoryMinimums: false,
    description: 'Not considered active. Not eligible for advancement or leadership.',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
  active_general: {
    role: 'general_member' as UserRole,
    label: 'Active General Member',
    minPoints: 100,
    maxPoints: 149,
    requiresCategoryMinimums: true, // Must have 25+ in each category
    description: 'Active BOSSO member. Eligible to apply for Analyst roles.',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  active_analyst: {
    role: 'analyst' as UserRole,
    label: 'Active Analyst',
    minPoints: 150,
    maxPoints: 199,
    requiresCategoryMinimums: true,
    description: 'Active BOSSO member. Eligible to reapply as Analyst. Eligible to apply for PM roles.',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  leadership_eligible: {
    role: 'analyst' as UserRole, // Still analyst, but eligible for leadership
    label: 'Leadership Eligible',
    minPoints: 200,
    maxPoints: Infinity,
    requiresCategoryMinimums: true,
    description: 'Active BOSSO member. Eligible for PM and Board roles. Sustained, high-impact contribution.',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
}

export const ROLE_REQUIREMENTS = {
  general_member: {
    minPoints: 100, // General members need 100+ points to be active
    requiresCategoryMinimums: true, // Must have 25+ in each category
  },
  analyst: {
    minPoints: 150,
    requiresCategoryMinimums: true,
  },
  project_manager: {
    minPoints: 200,
    requiresCategoryMinimums: true,
  },
  board_member: {
    minPoints: 200,
    requiresCategoryMinimums: true,
  },
  admin: {
    minPoints: 0,
    requiresCategoryMinimums: false,
  },
}

// Check if user meets requirements for a specific role
export function meetsRoleRequirements(
  role: UserRole,
  totalPoints: number,
  categoryPoints: {
    membership: number
    professional_education: number
    social: number
    philanthropy: number
  }
): { meets: boolean; reason?: string } {
  const requirements = ROLE_REQUIREMENTS[role]

  // Admins have no point requirements
  if (role === 'admin') {
    return { meets: true }
  }

  // Check total points
  if (totalPoints < requirements.minPoints) {
    return {
      meets: false,
      reason: `Need ${requirements.minPoints}+ total points (currently ${totalPoints})`,
    }
  }

  // Check category minimums if required
  if (requirements.requiresCategoryMinimums) {
    const categories = [
      { name: 'Membership', points: categoryPoints.membership },
      { name: 'Professional/Education', points: categoryPoints.professional_education },
      { name: 'Social', points: categoryPoints.social },
      { name: 'Philanthropy', points: categoryPoints.philanthropy },
    ]

    for (const category of categories) {
      if (category.points < 25) {
        return {
          meets: false,
          reason: `Need 25+ points in ${category.name} (currently ${category.points})`,
        }
      }
    }
  }

  return { meets: true }
}

// Get the appropriate tier based on points
export function getMembershipTier(
  totalPoints: number,
  categoryPoints: {
    membership: number
    professional_education: number
    social: number
    philanthropy: number
  }
) {
  const meetsCategoryMinimums =
    categoryPoints.membership >= 25 &&
    categoryPoints.professional_education >= 25 &&
    categoryPoints.social >= 25 &&
    categoryPoints.philanthropy >= 25

  if (totalPoints >= 200 && meetsCategoryMinimums) {
    return MEMBERSHIP_TIERS.leadership_eligible
  }

  if (totalPoints >= 150 && meetsCategoryMinimums) {
    return MEMBERSHIP_TIERS.active_analyst
  }

  if (totalPoints >= 100 && meetsCategoryMinimums) {
    return MEMBERSHIP_TIERS.active_general
  }

  return MEMBERSHIP_TIERS.inactive
}
