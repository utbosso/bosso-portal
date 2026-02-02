'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, AnnouncementRead, Profile } from '@/types/database.types'
import { Megaphone, PlusCircle, Trash2, Pencil, Mail } from 'lucide-react'
import { isAdmin } from '@/lib/admin'
import {
  canAccessRoleScope,
  filterUsersByRoleScope,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'

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
  const [roleScope, setRoleScope] = useState<RoleScopeOption>('all')
  const [error, setError] = useState<string | null>(null)

  const canPost = hasMinimumRole('project_manager')
  const isUserAdmin = isAdmin(profile?.role)

  const canSeeAnnouncement = (item: Announcement) => {
    return canAccessRoleScope(profile?.role, item.role_scope, item.role_scope_mode)
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
          role_scope_mode,
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
      const scopePayload = toRoleScopePayload(roleScope)
      const payload = {
        title,
        body,
        created_by: profile.id,
        role_scope: scopePayload.roleScope,
        ...(scopePayload.roleScopeMode ? { role_scope_mode: scopePayload.roleScopeMode } : {}),
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmDelete = window.confirm('Delete this announcement?')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchAnnouncements()
    } catch (err: any) {
      console.error('Error deleting announcement:', err)
      setError('Failed to delete announcement.')
    }
  }

  const canManageAnnouncement = (announcement: AnnouncementWithAuthor) => {
    if (!profile) return false
    // Admins can manage everything
    if (isUserAdmin) return true
    // Creators can manage their own
    return announcement.created_by === profile.id
  }

  const sendAnnouncementEmail = async (announcement: AnnouncementWithAuthor) => {
    try {
      // Fetch all eligible users based on role_scope
      let query = supabase
        .from('profiles')
        .select('email, full_name, role')
        .eq('account_status', 'active')

      const { data: users, error } = await query

      if (error) throw error

      const eligibleUsers = filterUsersByRoleScope(
        users || [],
        announcement.role_scope,
        announcement.role_scope_mode
      )

      // Get list of email addresses for BCC
      const bccEmails = eligibleUsers.map(u => u.email).join(',')

      // Create email subject and body
      const subject = encodeURIComponent(`BOSSO Announcement: ${announcement.title}`)
      const emailBody = encodeURIComponent(`${announcement.body}

---
Posted by: ${announcement.author?.full_name || 'BOSSO Team'}
Target Audience: ${getRoleScopeLabel(announcement.role_scope, announcement.role_scope_mode)}
Date: ${new Date(announcement.created_at).toLocaleString()}

View on portal: ${window.location.origin}/announcements/${announcement.id}`)

      // Open Gmail compose with BCC
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccEmails)}&su=${subject}&body=${emailBody}`

      window.open(gmailUrl, '_blank')
    } catch (error) {
      console.error('Error preparing announcement email:', error)
      alert('Failed to prepare email. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-primary" />
            Announcements
          </h1>
        </div>

        {canPost && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{formOpen ? 'Close form' : 'New announcement'}</span>
            <span className="sm:hidden">{formOpen ? 'Close' : 'New'}</span>
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
              <option value="analyst_only">Analysts only</option>
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
          <div
            key={a.id}
            className="card-glow p-4 space-y-2 hover:border-primary/60 transition"
          >
            <Link href={`/announcements/${a.id}`} className="block">
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
                    Target: {getRoleScopeLabel(a.role_scope, a.role_scope_mode)}
                  </span>
                )}
              </div>
            </Link>

            {canManageAnnouncement(a) && (
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    sendAnnouncementEmail(a)
                  }}
                  className="p-1.5 rounded-md bg-dark-200 hover:bg-green-500/10 text-green-400 hover:text-green-300 transition"
                  title="Send email to members"
                >
                  <Mail className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDelete(a.id, e)}
                  className="p-1.5 rounded-md bg-dark-200 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition"
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
