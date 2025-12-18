'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, AnnouncementRead, Profile, UserRole } from '@/types/database.types'
import { Megaphone, PlusCircle } from 'lucide-react'

const supabase = createClient()

type AnnouncementWithAuthor = Announcement & {
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  unread?: boolean
}

export default function AnnouncementsPage() {
  const { profile, hasMinimumRole } = useAuth()
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [roleScope, setRoleScope] = useState<UserRole | 'all'>('all')
  const [error, setError] = useState<string | null>(null)

  const canPost = hasMinimumRole('project_manager')
  const roleHierarchy: Record<UserRole, number> = useMemo(
    () => ({
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
    }),
    []
  )

  const canSeeAnnouncement = (item: Announcement) => {
    if (!item.role_scope) return true
    if (!profile) return false
    return roleHierarchy[profile.role] >= roleHierarchy[item.role_scope]
  }

  const fetchAnnouncements = async () => {
    setLoading(true)
    setError(null)
    try {
      const readsPromise = profile
        ? supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', profile.id)
        : Promise.resolve({ data: [] as AnnouncementRead[], error: null })

      const { data, error } = await supabase
        .from('announcements')
        .select(
          `
          id,
          title,
          body,
          created_at,
          created_by,
          role_scope,
          author:profiles!announcements_created_by_fkey(id, full_name, role)
        `
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      const readsResult = await readsPromise
      if (readsResult.error) throw readsResult.error

      const readIds = new Set((readsResult.data as any[]).map((r) => r.announcement_id))
      const rows = (data as any as AnnouncementWithAuthor[]) ?? []
      const filtered = rows
        .filter(canSeeAnnouncement)
        .map((row) => ({ ...row, unread: !readIds.has(row.id) }))

      setAnnouncements(filtered)
    } catch (err: any) {
      console.error('Error fetching announcements:', err)
      setError('Failed to load announcements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setError(null)

    try {
      const payload = {
        title,
        body,
        created_by: profile.id,
        role_scope: roleScope === 'all' ? null : roleScope,
      }

      const { error } = await supabase
        .from('announcements')
        .insert(payload)

      if (error) throw error

      setTitle('')
      setBody('')
      setRoleScope('all')
      setFormOpen(false)
      await fetchAnnouncements()
    } catch (err: any) {
      console.error('Error creating announcement:', err)
      setError('Failed to create announcement. You may not have permission.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-primary" />
            BOSSO Announcements
          </h1>
          <p className="text-muted-foreground text-sm">
            Central hub for BOSSO updates, events, and opportunities.
          </p>
        </div>

        {canPost && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
          >
            <PlusCircle className="w-4 h-4" />
            {formOpen ? 'Close form' : 'New announcement'}
          </button>
        )}
      </div>

      {canPost && formOpen && (
        <form
          onSubmit={handleCreate}
          className="card-glow p-5 space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Example: BOSSO kickoff meeting this Thursday"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Share details, location, expectations, or links."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Visible to
            </label>
            <select
              value={roleScope}
              onChange={(e) => setRoleScope(e.target.value as any)}
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All BOSSO members</option>
              <option value="general_member">General Members only</option>
              <option value="analyst">Analysts and above</option>
              <option value="project_manager">PMs and Board</option>
              <option value="board_member">Board only</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-primary/30 text-muted-foreground hover:bg-dark-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-primary text-dark-300 font-medium hover:opacity-90"
            >
              Post announcement
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Loading announcements...
          </div>
        )}

        {!loading && announcements.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No announcements yet.
          </div>
        )}

        {!loading && announcements.map((a) => (
          <Link
            key={a.id}
            href={`/announcements/${a.id}`}
            className="block card-glow p-4 space-y-2 hover:border-primary/60 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {a.title}
              </h2>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Posted by {a.author?.full_name ?? 'Unknown'}
              </span>
              {a.unread && (
                <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive uppercase tracking-wide text-[11px]">
                  Unread
                </span>
              )}
              {a.role_scope && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                  Target: {a.role_scope.replace('_', ' ')}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
