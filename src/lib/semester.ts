import type {
  EventCategory,
  MemberTermPointSummary,
  PortalAccessStatus,
  UserRole,
} from '@/types/database.types'

export const POSITION_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'general_member', label: 'General member' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'project_manager', label: 'Project manager' },
  { value: 'board_member', label: 'Board member' },
]

export const POINT_CATEGORY_OPTIONS: Array<{ value: EventCategory; label: string }> = [
  { value: 'membership', label: 'Membership' },
  { value: 'professional_education', label: 'Professional / Education' },
  { value: 'social', label: 'Social' },
  { value: 'philanthropy', label: 'Philanthropy' },
]

export const EMPTY_POINT_SUMMARY: Omit<MemberTermPointSummary, 'term_id' | 'user_id'> = {
  total_points: 0,
  membership_points: 0,
  professional_education_points: 0,
  social_points: 0,
  philanthropy_points: 0,
  entry_count: 0,
}

export function isMissingSemesterSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.includes('get_portal_access_status') ||
    error.message?.includes('academic_terms')
  )
}

export function getRenewalMessage(access: PortalAccessStatus | null) {
  switch (access?.reason) {
    case 'dues_required':
      return 'Your position was received. Pay your dues below — access opens automatically the moment payment clears.'
    case 'pending_approval':
      return 'Your renewal is ready for administrator review.'
    case 'declined':
      return 'Your renewal needs attention. Contact internal@txbosso.com for help.'
    case 'setup_required':
      return 'The next semester is still being configured. Check back soon.'
    default:
      return 'Confirm your position for the new semester to begin renewal.'
  }
}
