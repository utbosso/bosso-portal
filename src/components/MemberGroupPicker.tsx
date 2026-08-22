'use client'

import UserSearch, { type UserOption } from '@/components/UserSearch'
import type { CommunicationMemberGroup } from '@/lib/communication-recipients'

type MemberGroupPickerProps = {
  users: UserOption[]
  value: string[]
  onChange: (value: string[]) => void
  groups?: CommunicationMemberGroup[]
  placeholder?: string
  disabled?: boolean
}

const POSITION_GROUPS = [
  { role: 'general_member', label: 'General members' },
  { role: 'analyst', label: 'Analysts' },
  { role: 'project_manager', label: 'Project managers' },
  { role: 'board_member', label: 'Board' },
] as const

export default function MemberGroupPicker({
  users,
  value,
  onChange,
  groups = [],
  placeholder = 'Search current members by name...',
  disabled = false,
}: MemberGroupPickerProps) {
  const availableIds = new Set(users.map((user) => user.id))
  const toggleIds = (ids: string[]) => {
    if (ids.length === 0) return
    const selected = new Set(value)
    const entireGroupSelected = ids.every((id) => selected.has(id))

    if (entireGroupSelected) {
      const group = new Set(ids)
      onChange(value.filter((id) => !group.has(id)))
      return
    }

    onChange(Array.from(new Set([...value, ...ids])))
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Add or remove a whole position</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleIds(users.map((user) => user.id))}
            disabled={disabled || users.length === 0}
            aria-pressed={users.length > 0 && users.every((user) => value.includes(user.id))}
            className="min-h-10 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary/50 aria-pressed:bg-primary/15 aria-pressed:text-primary"
          >
            All current members · {users.length}
          </button>
          {POSITION_GROUPS.map((group) => {
            const ids = users.filter((user) => user.role === group.role).map((user) => user.id)
            const active = ids.length > 0 && ids.every((id) => value.includes(id))
            return (
              <button
                key={group.role}
                type="button"
                onClick={() => toggleIds(ids)}
                disabled={disabled || ids.length === 0}
                aria-pressed={active}
                className="min-h-10 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary/50 aria-pressed:bg-primary/15 aria-pressed:text-primary"
              >
                {group.label} · {ids.length}
              </button>
            )
          })}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled}
              className="min-h-10 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Admin-created semester groups</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const ids = group.member_ids.filter((id) => availableIds.has(id))
              const active = ids.length > 0 && ids.every((id) => value.includes(id))
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleIds(ids)}
                  disabled={disabled || ids.length === 0}
                  aria-pressed={active}
                  title={group.description || group.name}
                  className="min-h-10 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary/60 aria-pressed:bg-primary/15 aria-pressed:text-primary"
                >
                  {group.name} · {ids.length}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <UserSearch
        users={users}
        value={value}
        onChange={(next) => onChange(next as string[])}
        placeholder={placeholder}
        multiple
        disabled={disabled}
        selectionDisplayLimit={6}
      />
      <p className="text-xs text-muted-foreground">
        {value.length} approved current-semester member{value.length === 1 ? '' : 's'} selected
      </p>
    </div>
  )
}
