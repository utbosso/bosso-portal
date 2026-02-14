import type { RoleScopeMode, UserRole } from '@/types/database.types'

export type RoleScopeOption = UserRole | 'all' | 'analyst_only'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  general_member: 1,
  analyst: 2,
  project_manager: 3,
  board_member: 4,
  admin: 5,
}

export function canAccessRoleScope(
  userRole: UserRole | null | undefined,
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined
): boolean {
  if (!roleScope) return true
  if (!userRole) return false
  if (userRole === 'admin') return true
  if (roleScopeMode === 'exact_role') return userRole === roleScope
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[roleScope]
}

export function toRoleScopePayload(option: RoleScopeOption): {
  roleScope: UserRole | null
  roleScopeMode: RoleScopeMode | null
} {
  if (option === 'all') {
    return {
      roleScope: null,
      roleScopeMode: null,
    }
  }

  if (option === 'analyst_only') {
    return {
      roleScope: 'analyst',
      roleScopeMode: 'exact_role',
    }
  }

  return {
    roleScope: option,
    roleScopeMode: 'minimum_role',
  }
}

export function fromRoleScopePayload(
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined
): RoleScopeOption {
  if (!roleScope) return 'all'
  if (roleScope === 'analyst' && roleScopeMode === 'exact_role') return 'analyst_only'
  return roleScope
}

export function getRoleScopeLabel(
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined
): string {
  if (!roleScope) return 'All BOSSO members'
  if (roleScope === 'analyst' && roleScopeMode === 'exact_role') return 'Analysts only'
  if (roleScope === 'general_member') return 'General Members only'
  if (roleScope === 'analyst') return 'Analysts and above'
  if (roleScope === 'project_manager') return 'PMs and Board'
  if (roleScope === 'board_member') return 'Board only'
  return roleScope.replace('_', ' ')
}

export function filterUsersByRoleScope<T extends { role: UserRole }>(
  users: T[],
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined
): T[] {
  if (!roleScope) return users
  return users.filter((user) => canAccessRoleScope(user.role, roleScope, roleScopeMode))
}

export function canAccessAudience(
  userId: string | null | undefined,
  userRole: UserRole | null | undefined,
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined,
  targetUserIds: string[] | null | undefined
): boolean {
  const selectedUserIds = targetUserIds ?? []
  if (selectedUserIds.length > 0) {
    if (!userId) return false
    return selectedUserIds.includes(userId)
  }

  return canAccessRoleScope(userRole, roleScope, roleScopeMode)
}

export function filterUsersByAudience<T extends { id: string; role: UserRole }>(
  users: T[],
  roleScope: UserRole | null | undefined,
  roleScopeMode: RoleScopeMode | null | undefined,
  targetUserIds: string[] | null | undefined
): T[] {
  const selectedUserIds = targetUserIds ?? []
  if (selectedUserIds.length > 0) {
    const selectedSet = new Set(selectedUserIds)
    return users.filter((user) => selectedSet.has(user.id))
  }

  return filterUsersByRoleScope(users, roleScope, roleScopeMode)
}
