import 'server-only'

import type { RoleScopeMode, UserRole } from '@/types/database.types'
import { filterUsersByAudience } from '@/lib/role-scope'

export type CurrentTermMember = {
  id: string
  email: string
  full_name: string
  role: UserRole
}

export type CurrentTermAudience = {
  roleScope?: UserRole | null
  roleScopeMode?: RoleScopeMode | null
  targetUserIds?: string[] | null
}

export type CurrentTermMemberGroup = {
  id: string
  name: string
  description: string | null
  member_ids: string[]
}

export type CurrentTermMemberContext = {
  term: { id: string; name: string }
  members: CurrentTermMember[]
  groups: CurrentTermMemberGroup[]
}

const ROLE_RANK: Record<UserRole, number> = {
  general_member: 1,
  analyst: 2,
  project_manager: 3,
  board_member: 4,
  admin: 5,
}

export function canManageCommunications(role: UserRole | null | undefined) {
  return Boolean(role && ROLE_RANK[role] >= ROLE_RANK.project_manager)
}

function missingSemesterSchema(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error && (
      ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code || '') ||
      /academic_terms|member_term_memberships|term_member_groups|term_member_group_members/i.test(error.message || '')
    )
  )
}

async function loadLegacyApprovedMembers(admin: any): Promise<CurrentTermMemberContext> {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, account_status')
    .order('full_name')

  if (error) throw new Error(`Approved portal members could not be loaded: ${error.message}`)

  const seenEmails = new Set<string>()
  const members: CurrentTermMember[] = []
  for (const profile of profiles || []) {
    const email = profile.email?.trim().toLowerCase()
    if (!email || !['approved', 'active'].includes(profile.account_status) || seenEmails.has(email)) continue
    seenEmails.add(email)
    members.push({
      id: profile.id,
      email,
      full_name: profile.full_name,
      role: profile.role as UserRole,
    })
  }

  return {
    term: { id: 'legacy-approved-members', name: 'Current approved portal members' },
    members,
    groups: [],
  }
}

export async function loadCurrentTermMembers(admin: any): Promise<CurrentTermMemberContext> {
  const { data: term, error: termError } = await admin
    .from('academic_terms')
    .select('id, name')
    .eq('status', 'current')
    .maybeSingle()

  if (termError) {
    if (missingSemesterSchema(termError)) return loadLegacyApprovedMembers(admin)
    throw new Error(`Current semester could not be loaded: ${termError.message}`)
  }
  // This transitional fallback keeps the local preview usable before the setup
  // wizard activates its first term. Once a current term exists, only that
  // term's approved memberships are returned below.
  if (!term) return loadLegacyApprovedMembers(admin)

  const [membershipsResult, groupsResult] = await Promise.all([
    admin
      .from('member_term_memberships')
      .select('user_id, position_role')
      .eq('term_id', term.id)
      // These values mean the semester renewal and dues checks are approved.
      // Point-minimum progress is deliberately not part of this directory.
      .in('status', ['active', 'exempt'])
      .in('dues_status', ['paid', 'exempt']),
    (admin as any)
      .from('term_member_groups')
      .select('id, name, description')
      .eq('term_id', term.id)
      .order('name'),
  ])

  const { data: memberships, error: membershipsError } = membershipsResult
  const { data: groupRows, error: groupsError } = groupsResult

  if (membershipsError) {
    if (missingSemesterSchema(membershipsError)) return loadLegacyApprovedMembers(admin)
    throw new Error(`Current members could not be loaded: ${membershipsError.message}`)
  }
  if (groupsError && !missingSemesterSchema(groupsError)) {
    throw new Error(`Current-semester groups could not be loaded: ${groupsError.message}`)
  }

  const membershipRows = memberships || []
  const userIds = Array.from(new Set(membershipRows.map((membership: any) => membership.user_id)))
  if (userIds.length === 0) return { term, members: [], groups: [] }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, email, full_name, account_status')
    .in('id', userIds)

  if (profilesError) throw new Error(`Member profiles could not be loaded: ${profilesError.message}`)

  const profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  const seenEmails = new Set<string>()
  const members: CurrentTermMember[] = []

  for (const membership of membershipRows) {
    const profile: any = profilesById.get(membership.user_id)
    const email = profile?.email?.trim().toLowerCase()
    const accountCanEnterPortal =
      profile?.account_status == null || ['approved', 'active'].includes(profile.account_status)
    if (!profile || !email || !accountCanEnterPortal || seenEmails.has(email)) continue

    seenEmails.add(email)
    members.push({
      id: profile.id,
      email,
      full_name: profile.full_name,
      role: membership.position_role as UserRole,
    })
  }

  members.sort((a, b) => a.full_name.localeCompare(b.full_name))

  const approvedMemberIds = new Set(members.map((member) => member.id))
  const groupIds = (groupsError ? [] : groupRows || []).map((group: any) => group.id)
  const { data: groupMemberRows, error: groupMembersError } = groupIds.length
    ? await (admin as any)
        .from('term_member_group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds)
    : { data: [], error: null }
  if (groupMembersError) throw new Error(`Group members could not be loaded: ${groupMembersError.message}`)

  const memberIdsByGroup = new Map<string, string[]>()
  for (const row of groupMemberRows || []) {
    if (!approvedMemberIds.has(row.user_id)) continue
    const ids = memberIdsByGroup.get(row.group_id) || []
    ids.push(row.user_id)
    memberIdsByGroup.set(row.group_id, ids)
  }

  const groups: CurrentTermMemberGroup[] = (groupsError ? [] : groupRows || []).map((group: any) => ({
    id: group.id,
    name: group.name,
    description: group.description || null,
    member_ids: memberIdsByGroup.get(group.id) || [],
  }))

  return { term, members, groups }
}

export function selectCurrentTermRecipients(
  context: CurrentTermMemberContext,
  audience: CurrentTermAudience
) {
  const recipients = filterUsersByAudience(
    context.members,
    audience.roleScope,
    audience.roleScopeMode,
    audience.targetUserIds
  )

  // Position-group messages go to organization positions, not the internal
  // portal service account. "All members" and explicit selections may include it.
  return audience.roleScope && !(audience.targetUserIds?.length)
    ? recipients.filter((member) => member.role !== 'admin')
    : recipients
}
