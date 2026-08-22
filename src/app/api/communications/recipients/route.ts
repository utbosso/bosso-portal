import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import {
  canManageCommunications,
  loadCurrentTermMembers,
  selectCurrentTermRecipients,
} from '@/lib/current-term-recipients'
import type { RoleScopeMode, UserRole } from '@/types/database.types'

const USER_ROLES: UserRole[] = ['general_member', 'analyst', 'project_manager', 'board_member', 'admin']
const SCOPE_MODES: RoleScopeMode[] = ['minimum_role', 'exact_role']

async function getCurrentMemberContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const context = await loadCurrentTermMembers(admin)
  const currentMember = context.members.find((member) => member.id === user.id)
  if (!isPortalAdminUser(user) && !currentMember) {
    return { error: NextResponse.json({ error: 'Only approved current-semester portal members can view the member directory.' }, { status: 403 }) }
  }

  return { context, currentMember, user }
}

export async function GET() {
  try {
    const result = await getCurrentMemberContext()
    if (result.error) return result.error
    const context = result.context!
    return NextResponse.json({
      termName: context.term.name,
      members: context.members.map(({ id, full_name, role }) => ({ id, full_name, role })),
      groups: context.groups,
    })
  } catch (error) {
    console.error('Error loading current-semester member directory', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Current-semester members could not be loaded.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const result = await getCurrentMemberContext()
    if (result.error) return result.error
    const context = result.context!
    if (!isPortalAdminUser(result.user!) && !canManageCommunications(result.currentMember?.role)) {
      return NextResponse.json({ error: 'Only current-semester PMs, Board, or the portal admin can prepare member emails.' }, { status: 403 })
    }
    const body = await request.json().catch(() => null)

    const roleScope = body?.roleScope == null ? null : body.roleScope
    const roleScopeMode = body?.roleScopeMode == null ? null : body.roleScopeMode
    const targetUserIds = body?.targetUserIds == null ? null : body.targetUserIds

    if (roleScope !== null && !USER_ROLES.includes(roleScope)) {
      return NextResponse.json({ error: 'Invalid position audience.' }, { status: 400 })
    }
    if (roleScopeMode !== null && !SCOPE_MODES.includes(roleScopeMode)) {
      return NextResponse.json({ error: 'Invalid position matching rule.' }, { status: 400 })
    }
    if (targetUserIds !== null && (!Array.isArray(targetUserIds) || targetUserIds.length > 500 || targetUserIds.some((id) => typeof id !== 'string'))) {
      return NextResponse.json({ error: 'Invalid selected-member audience.' }, { status: 400 })
    }

    const recipients = selectCurrentTermRecipients(context, {
      roleScope,
      roleScopeMode,
      targetUserIds,
    })

    return NextResponse.json({ termName: context.term.name, recipients })
  } catch (error) {
    console.error('Error resolving current-semester communication recipients', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Current-semester recipients could not be resolved.' },
      { status: 500 }
    )
  }
}
