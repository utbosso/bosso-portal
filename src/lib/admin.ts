/**
 * Admin utility functions for role checking and access control
 */

import { UserRole } from '@/types/database.types'

/**
 * Check if a user role is admin
 */
export function isAdmin(role: UserRole | undefined | null): boolean {
  return role === 'admin'
}

/**
 * Check if a user role has minimum required role level
 * Role hierarchy (lowest to highest):
 * general_member < analyst < project_manager < board_member < admin
 */
export function hasMinimumRole(
  userRole: UserRole | undefined | null,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false

  const roleHierarchy: Record<UserRole, number> = {
    general_member: 1,
    analyst: 2,
    project_manager: 3,
    board_member: 4,
    admin: 5,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    general_member: 'General Member',
    analyst: 'Analyst',
    project_manager: 'Project Manager',
    board_member: 'Board Member',
    admin: 'Administrator',
  }
  return roleNames[role]
}

/**
 * Get role color for UI display
 */
export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    general_member: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    analyst: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    project_manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    board_member: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return roleColors[role]
}

/**
 * Check if user can manage other users
 * Only admins can manage users
 */
export function canManageUsers(role: UserRole | undefined | null): boolean {
  return isAdmin(role)
}

/**
 * Check if user can view all feedback/reports
 * Only admins can view reports
 */
export function canViewReports(role: UserRole | undefined | null): boolean {
  return isAdmin(role)
}

/**
 * Check if user can manage announcements
 * Board members and admins can manage announcements
 */
export function canManageAnnouncements(role: UserRole | undefined | null): boolean {
  return hasMinimumRole(role, 'board_member')
}

/**
 * Check if user can manage events
 * Board members and admins can manage events
 */
export function canManageEvents(role: UserRole | undefined | null): boolean {
  return hasMinimumRole(role, 'board_member')
}

/**
 * Check if user can assign tasks
 * Project managers, board members, and admins can assign tasks
 */
export function canAssignTasks(role: UserRole | undefined | null): boolean {
  return hasMinimumRole(role, 'project_manager')
}
