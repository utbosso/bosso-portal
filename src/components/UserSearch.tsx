'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Check } from 'lucide-react'

export interface UserOption {
  id: string
  full_name: string
  email?: string
  role?: string
}

interface UserSearchProps {
  users: UserOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  multiple?: boolean
  disabled?: boolean
  excludeRoles?: string[]
  selectionDisplayLimit?: number
}

export default function UserSearch({
  users,
  value,
  onChange,
  placeholder = 'Search by name...',
  multiple = false,
  disabled = false,
  excludeRoles = [],
  selectionDisplayLimit = 8,
}: UserSearchProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter users based on search and excluded roles
  const filteredUsers = users.filter((user) => {
    if (excludeRoles.includes(user.role || '')) return false
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      user.full_name.toLowerCase().includes(searchLower) ||
      (user.email?.toLowerCase().includes(searchLower) ?? false)
    )
  })

  // Get selected user(s) for display
  const selectedUsers = multiple
    ? users.filter((u) => (value as string[]).includes(u.id))
    : users.find((u) => u.id === value)
  const visibleSelectedUsers = multiple
    ? (selectedUsers as UserOption[]).slice(0, selectionDisplayLimit)
    : []
  const hiddenSelectionCount = multiple
    ? Math.max(0, (selectedUsers as UserOption[]).length - visibleSelectedUsers.length)
    : 0

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (userId: string) => {
    if (multiple) {
      const currentValues = value as string[]
      if (currentValues.includes(userId)) {
        onChange(currentValues.filter((id) => id !== userId))
      } else {
        onChange([...currentValues, userId])
      }
    } else {
      onChange(userId)
      setIsOpen(false)
      setSearch('')
    }
  }

  const handleClear = () => {
    onChange(multiple ? [] : '')
    setSearch('')
    inputRef.current?.focus()
  }

  const handleRemoveUser = (userId: string) => {
    if (multiple) {
      onChange((value as string[]).filter((id) => id !== userId))
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected users display (for multiple) */}
      {multiple && (selectedUsers as UserOption[]).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {visibleSelectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs rounded-md"
            >
              {user.full_name}
              <button
                type="button"
                onClick={() => handleRemoveUser(user.id)}
                className="hover:text-primary/70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {hiddenSelectionCount > 0 && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              +{hiddenSelectionCount} more
            </span>
          )}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={!multiple && selectedUsers && !isOpen ? (selectedUsers as UserOption).full_name : search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
            if (!multiple && selectedUsers) {
              setSearch('')
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="portal-input w-full bg-dark-100 pl-9 pr-10"
        />
        {((multiple && (value as string[]).length > 0) || (!multiple && value)) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-primary/20 bg-dark-200 shadow-lg">
          {filteredUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = multiple
                ? (value as string[]).includes(user.id)
                : value === user.id
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user.id)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-primary/10 ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="break-words text-foreground">{user.full_name}</span>
                    {user.role && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({user.role.replaceAll('_', ' ')})
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
