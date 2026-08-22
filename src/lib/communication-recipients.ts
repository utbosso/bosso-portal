import type { RoleScopeMode, UserRole } from '@/types/database.types'

export type CommunicationMember = {
  id: string
  full_name: string
  role: UserRole
  email?: string
}

export type CommunicationMemberGroup = {
  id: string
  name: string
  description: string | null
  member_ids: string[]
}

type Audience = {
  roleScope?: UserRole | null
  roleScopeMode?: RoleScopeMode | null
  targetUserIds?: string[] | null
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Current-semester recipients could not be loaded.')
  return payload
}

export async function fetchCurrentMemberDirectory(): Promise<{
  termName: string
  members: CommunicationMember[]
  groups: CommunicationMemberGroup[]
}> {
  const response = await fetch('/api/communications/recipients', { cache: 'no-store' })
  return readResponse(response)
}

export async function resolveCommunicationRecipients(audience: Audience): Promise<{
  termName: string
  recipients: Required<CommunicationMember>[]
}> {
  const response = await fetch('/api/communications/recipients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audience),
  })
  return readResponse(response)
}
