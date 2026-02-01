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
}

export default function UserSearch({
  users,
  value,
  onChange,
  placeholder = 'Search by name...',
  multiple = false,
  disabled = false,
  excludeRoles = [],
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
          {(selectedUsers as UserOption[]).map((user) => (
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
          className="w-full pl-9 pr-8 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {((multiple && (value as string[]).length > 0) || (!multiple && value)) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-dark-200 border border-primary/20 rounded-md shadow-lg max-h-48 overflow-y-auto">
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
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center justify-between ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <div>
                    <span className="text-foreground">{user.full_name}</span>
                    {user.role && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({user.role.replace('_', ' ')})
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
