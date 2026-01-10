'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { isAdmin } from '@/lib/admin'
import type { Announcement, AnnouncementRead, Profile, UserRole } from '@/types/database.types'
import { ArrowLeft, Pencil, Save, Trash2, X } from 'lucide-react'

const supabase = createClient()

type AnnouncementWithAuthor = Announcement & {
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}

export default function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { profile, hasMinimumRole } = useAuth()

  const [announcement, setAnnouncement] = useState<AnnouncementWithAuthor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [roleScope, setRoleScope] = useState<UserRole | 'all'>('all')

  const roleHierarchy: Record<UserRole, number> = useMemo(
    () => ({
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
      admin: 5,
    }),
    []
  )

  const isUserAdmin = isAdmin(profile?.role)
  const canManage = isUserAdmin || announcement?.created_by === profile?.id || hasMinimumRole('board_member')
  const canView = (item: Announcement | null) => {
    if (!item) return false
    if (isUserAdmin) return true // Admins can view all announcements
    if (!item.role_scope) return true
    if (!profile) return false
    return roleHierarchy[profile.role] >= roleHierarchy[item.role_scope]
  }

  const fetchAnnouncement = async () => {
    setLoading(true)
    setError(null)
    try {
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
        .eq('id', params.id)
        .single()

      if (error) throw error

      const record = (data as any) as AnnouncementWithAuthor
      setAnnouncement(record)
      setTitle(record?.title ?? '')
      setBody(record?.body ?? '')
      setRoleScope((record?.role_scope as UserRole | null) ?? 'all')

      if (profile) {
        const readPayload: AnnouncementRead = {
          announcement_id: record.id,
          user_id: profile.id,
          read_at: new Date().toISOString(),
        }
        await supabase.from('announcement_reads').upsert(readPayload, { onConflict: 'announcement_id,user_id' })
      }
    } catch (err: any) {
      console.error('Error loading announcement', err)
      setError('Failed to load announcement.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, profile?.role])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcement) return

    setSaving(true)
    setError(null)

    try {
      const payload = {
        title,
        body,
        role_scope: roleScope === 'all' ? null : roleScope,
      }

      const { error } = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', announcement.id)

      if (error) throw error

      await fetchAnnouncement()
      setEditing(false)
    } catch (err: any) {
      console.error('Error updating announcement', err)
      setError('Failed to update announcement. You may not have permission.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!announcement) return
    const confirmDelete = window.confirm('Delete this announcement? This cannot be undone.')
    if (!confirmDelete) return

    setDeleting(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcement.id)

      if (error) throw error

      router.push('/announcements')
    } catch (err: any) {
      console.error('Error deleting announcement', err)
      setError('Failed to delete announcement. You may not have permission.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <p className="text-muted-foreground text-sm">Loading announcement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <p className="text-muted-foreground text-sm">Announcement not found.</p>
      </div>
    )
  }

  if (!canView(announcement)) {
    return (
      <div className="space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <p className="text-destructive text-sm">You do not have access to this announcement.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>

        {canManage && !editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/40 text-sm text-primary hover:bg-primary/10"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/50 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="card-glow p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {new Date(announcement.created_at).toLocaleString()}
            </p>
            <h1 className="text-2xl font-bold text-foreground">{announcement.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Posted by {announcement.author?.full_name ?? 'Unknown'}</span>
              {announcement.author?.role && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                  {announcement.author.role.replace('_', ' ')}
                </span>
              )}
              {announcement.role_scope && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                  Target: {announcement.role_scope.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {announcement.body}
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="card-glow p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Visible to</label>
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-primary/30 text-muted-foreground hover:bg-dark-100"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-dark-300 font-medium hover:opacity-90 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
