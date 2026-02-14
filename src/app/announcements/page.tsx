'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, AnnouncementRead, Profile } from '@/types/database.types'
import { Megaphone, PlusCircle, Trash2, Mail, Paperclip } from 'lucide-react'
import { isAdmin } from '@/lib/admin'
import RichTextEditor from '@/components/RichTextEditor'
import UserSearch, { type UserOption } from '@/components/UserSearch'
import { announcementBodyToPlainText } from '@/lib/announcement-rich-text'
import {
  canAccessAudience,
  filterUsersByAudience,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'

const supabase = createClient()

type AnnouncementWithAuthor = Announcement & {
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  unread?: boolean
  attachment_url?: string | null
}

type AudienceMode = 'role' | 'people'

export default function AnnouncementsPage() {
  const { profile, hasMinimumRole } = useAuth()
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('role')
  const [roleScope, setRoleScope] = useState<RoleScopeOption>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [peopleOptions, setPeopleOptions] = useState<UserOption[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canPost = hasMinimumRole('project_manager')
  const isUserAdmin = isAdmin(profile?.role)

  const canSeeAnnouncement = (item: Announcement) => {
    return canAccessAudience(
      profile?.id,
      profile?.role,
      item.role_scope,
      item.role_scope_mode,
      item.target_user_ids
    )
  }

  const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_')

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
          target_user_ids,
          attachment_path,
          attachment_name,
          attachment_mime_type,
          author:profiles!announcements_created_by_fkey(id, full_name, role)
        `
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      const readsResult = await readsPromise
      if (readsResult.error) throw readsResult.error

      const readIds = new Set((readsResult.data as any[]).map((r) => r.announcement_id))
      const rows = (data as any as AnnouncementWithAuthor[]) ?? []
      const filteredRows = rows
        .filter(canSeeAnnouncement)
        .map((row) => ({ ...row, unread: !readIds.has(row.id) }))

      const withAttachmentUrls = await Promise.all(
        filteredRows.map(async (row) => {
          if (!row.attachment_path) return row
          const { data: signedData, error: signedError } = await supabase.storage
            .from('announcement-attachments')
            .createSignedUrl(row.attachment_path, 60 * 60)

          if (signedError) {
            console.warn('Failed to create signed URL for attachment', signedError)
            return row
          }

          return {
            ...row,
            attachment_url: signedData.signedUrl,
          }
        })
      )

      setAnnouncements(withAttachmentUrls)
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
  }, [profile?.id, profile?.role])

  useEffect(() => {
    const fetchPeopleOptions = async () => {
      if (!canPost) return
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('account_status', 'active')
        .order('full_name', { ascending: true })

      if (error) {
        console.error('Error loading members for targeting', error)
        return
      }

      setPeopleOptions((data ?? []) as UserOption[])
    }

    fetchPeopleOptions()
  }, [canPost])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setError(null)

    if (!announcementBodyToPlainText(body).trim()) {
      setError('Message cannot be empty.')
      return
    }
    if (audienceMode === 'people' && selectedUserIds.length === 0) {
      setError('Please select at least one member.')
      return
    }

    try {
      const scopePayload = toRoleScopePayload(roleScope)
      const payload = {
        title,
        body,
        created_by: profile.id,
        role_scope: audienceMode === 'role' ? scopePayload.roleScope : null,
        role_scope_mode: audienceMode === 'role' ? scopePayload.roleScopeMode : null,
        target_user_ids: audienceMode === 'people' ? selectedUserIds : null,
      }

      const { data: createdAnnouncement, error } = await supabase
        .from('announcements')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error

      if (attachmentFile && createdAnnouncement?.id) {
        const attachmentPath = `${createdAnnouncement.id}/${Date.now()}-${sanitizeFileName(attachmentFile.name)}`
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(attachmentPath, attachmentFile, {
            contentType: attachmentFile.type || undefined,
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        const { error: attachmentUpdateError } = await supabase
          .from('announcements')
          .update({
            attachment_path: attachmentPath,
            attachment_name: attachmentFile.name,
            attachment_mime_type: attachmentFile.type || null,
          })
          .eq('id', createdAnnouncement.id)

        if (attachmentUpdateError) {
          await supabase.storage.from('announcement-attachments').remove([attachmentPath])
          throw attachmentUpdateError
        }
      }

      setTitle('')
      setBody('')
      setAudienceMode('role')
      setRoleScope('all')
      setSelectedUserIds([])
      setAttachmentFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setFormOpen(false)
      await fetchAnnouncements()
    } catch (err: any) {
      console.error('Error creating announcement:', err)
      setError('Failed to create announcement. You may not have permission.')
    }
  }

  const handleDelete = async (announcement: AnnouncementWithAuthor, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmDelete = window.confirm('Delete this announcement?')
    if (!confirmDelete) return

    try {
      if (announcement.attachment_path) {
        const { error: removeError } = await supabase.storage
          .from('announcement-attachments')
          .remove([announcement.attachment_path])
        if (removeError) {
          console.warn('Failed to remove attachment during delete', removeError)
        }
      }

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcement.id)

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
        .select('id, email, full_name, role')
        .eq('account_status', 'active')

      const { data: users, error } = await query

      if (error) throw error

      const eligibleUsers = filterUsersByAudience(
        users || [],
        announcement.role_scope,
        announcement.role_scope_mode,
        announcement.target_user_ids
      )

      // Get list of email addresses for BCC
      const bccEmails = eligibleUsers.map(u => u.email).join(',')

      // Create email subject and body
      const subject = encodeURIComponent(`BOSSO Announcement: ${announcement.title}`)
      const emailBody = encodeURIComponent(`${announcementBodyToPlainText(announcement.body)}

---
Posted by: ${announcement.author?.full_name || 'BOSSO Team'}
Target Audience: ${announcement.target_user_ids?.length
  ? `${announcement.target_user_ids.length} selected member(s)`
  : getRoleScopeLabel(announcement.role_scope, announcement.role_scope_mode)}
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

          <RichTextEditor
            id="announcement-message"
            label="Message"
            value={body}
            onChange={setBody}
            required
            minHeightClassName="min-h-[180px]"
            placeholder="Share details, location, expectations, or links."
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Visible to
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAudienceMode('role')}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  audienceMode === 'role'
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-dark-100 text-muted-foreground border-primary/20'
                }`}
              >
                Role Group
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode('people')}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  audienceMode === 'people'
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-dark-100 text-muted-foreground border-primary/20'
                }`}
              >
                Specific People
              </button>
            </div>
            {audienceMode === 'role' ? (
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
            ) : (
              <div className="space-y-2">
                <UserSearch
                  users={peopleOptions}
                  value={selectedUserIds}
                  onChange={(value) => setSelectedUserIds(value as string[])}
                  placeholder="Search and select members..."
                  multiple
                />
                <p className="text-xs text-muted-foreground">
                  {selectedUserIds.length} member(s) selected
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Attachment (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-dark-300 hover:file:opacity-90"
            />
            <p className="text-xs text-muted-foreground">
              Upload a PDF or image to include with this announcement.
            </p>
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
                {(a.role_scope || (a.target_user_ids?.length ?? 0) > 0) && (
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                    Target: {a.target_user_ids?.length
                      ? `${a.target_user_ids.length} selected member(s)`
                      : getRoleScopeLabel(a.role_scope, a.role_scope_mode)}
                  </span>
                )}
                {a.attachment_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                    <Paperclip className="w-3 h-3" />
                    {a.attachment_name}
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
                  onClick={(e) => handleDelete(a, e)}
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
