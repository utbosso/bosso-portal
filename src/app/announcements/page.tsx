'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, AnnouncementRead, Profile } from '@/types/database.types'
import { Megaphone, PlusCircle, Trash2, Mail, Paperclip, Search, X } from 'lucide-react'
import RichTextEditor from '@/components/RichTextEditor'
import type { UserOption } from '@/components/UserSearch'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import SectionPageHeader from '@/components/SectionPageHeader'
import ReferenceLinksEditor from '@/components/ReferenceLinksEditor'
import {
  appendAnnouncementFallbackLinks,
  extractAnnouncementFallbackLinks,
  isMissingReferenceLinksColumn,
  normalizeReferenceLinks,
  type ReferenceLink,
} from '@/lib/reference-links'
import { announcementBodyToPlainText } from '@/lib/announcement-rich-text'
import SendEmailModal, { type SendEmailRequest } from '@/components/SendEmailModal'
import {
  canAccessAudience,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'
import {
  fetchCurrentMemberDirectory,
  type CommunicationMemberGroup,
} from '@/lib/communication-recipients'

const supabase = createClient()

type AnnouncementWithAuthor = Announcement & {
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  unread?: boolean
  attachment_url?: string | null
}

type AudienceMode = 'role' | 'people'

export default function AnnouncementsPage() {
  const { user, profile, hasMinimumRole, loading: authLoading } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id, authLoading)
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [emailRequest, setEmailRequest] = useState<SendEmailRequest | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('role')
  const [roleScope, setRoleScope] = useState<RoleScopeOption>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [peopleOptions, setPeopleOptions] = useState<UserOption[]>([])
  const [memberGroups, setMemberGroups] = useState<CommunicationMemberGroup[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLink[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const canPost = hasMinimumRole('project_manager')
  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  const visibleAnnouncements = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return announcements
    return announcements.filter((announcement) =>
      [
        announcement.title,
        announcementBodyToPlainText(announcement.body),
        announcement.author?.full_name,
        announcement.attachment_name,
        ...(announcement.reference_links || []).flatMap((link) => [link.label, link.url]),
      ].some((value) => value?.toLowerCase().includes(normalized))
    )
  }, [announcements, query])

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
    if (accessLoading) return
    setLoading(true)
    setError(null)
    try {
      const readsPromise = profile
        ? supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', profile.id)
        : Promise.resolve({ data: [] as AnnouncementRead[], error: null })

      const baseSelect = `
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
      let announcementsQuery: any = supabase
        .from('announcements')
        .select(`${baseSelect}, reference_links`)
      if (schemaReady && access?.term_id) {
        announcementsQuery = announcementsQuery.eq('term_id', access.term_id).is('archived_at', null)
      }
      let announcementsResult = await announcementsQuery.order('created_at', { ascending: false })

      if (isMissingReferenceLinksColumn(announcementsResult.error)) {
        let fallbackQuery: any = supabase.from('announcements').select(baseSelect)
        if (schemaReady && access?.term_id) {
          fallbackQuery = fallbackQuery.eq('term_id', access.term_id).is('archived_at', null)
        }
        announcementsResult = await fallbackQuery.order('created_at', { ascending: false })
      }

      const { data, error } = announcementsResult

      if (error) throw error
      const readsResult = await readsPromise
      if (readsResult.error) throw readsResult.error

      const readIds = new Set((readsResult.data as any[]).map((r) => r.announcement_id))
      const rows = ((data as any as AnnouncementWithAuthor[]) ?? []).map((row) => {
        const fallbackLinks = extractAnnouncementFallbackLinks(row.body)
        const structuredLinks = Array.isArray(row.reference_links) ? row.reference_links : []
        return { ...row, body: fallbackLinks.body, reference_links: structuredLinks.length ? structuredLinks : fallbackLinks.links }
      })
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
  }, [profile?.id, profile?.role, access?.term_id, schemaReady, accessLoading])

  useEffect(() => {
    const fetchPeopleOptions = async () => {
      if (!canPost) return
      try {
        const { members, groups } = await fetchCurrentMemberDirectory()
        setPeopleOptions(members)
        setMemberGroups(groups)
      } catch (directoryError) {
        console.error('Error loading current-semester members for targeting', directoryError)
        setPeopleOptions([])
        setMemberGroups([])
      }
    }

    void fetchPeopleOptions()
  }, [access?.term_id, canPost])

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
      const normalizedLinks = normalizeReferenceLinks(referenceLinks)
      const scopePayload = toRoleScopePayload(roleScope)
      const payload = {
        title,
        body,
        created_by: profile.id,
        role_scope: audienceMode === 'role' ? scopePayload.roleScope : null,
        role_scope_mode: audienceMode === 'role' ? scopePayload.roleScopeMode : null,
        target_user_ids: audienceMode === 'people' ? selectedUserIds : null,
        reference_links: normalizedLinks,
        ...(schemaReady && access?.term_id ? { term_id: access.term_id, archived_at: null } : {}),
      }

      let createResult = await (supabase as any)
        .from('announcements')
        .insert(payload)
        .select('id')
        .single()

      if (isMissingReferenceLinksColumn(createResult.error)) {
        const { reference_links: _referenceLinks, ...fallbackPayload } = payload
        createResult = await (supabase as any)
          .from('announcements')
          .insert({ ...fallbackPayload, body: appendAnnouncementFallbackLinks(body, normalizedLinks) })
          .select('id')
          .single()
      }

      const { data: createdAnnouncement, error } = createResult

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
      setReferenceLinks([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setFormOpen(false)
      await fetchAnnouncements()
    } catch (err: any) {
      console.error('Error creating announcement:', err)
      setError(err instanceof Error && /link|https?:\/\//i.test(err.message) ? err.message : 'Failed to create announcement. You may not have permission.')
    }
  }

  const handleDelete = async (announcement: AnnouncementWithAuthor, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmDelete = window.confirm('Delete this announcement?')
    if (!confirmDelete) return

    try {
      const { error } = schemaReady
        ? await (supabase as any).from('announcements').update({ archived_at: new Date().toISOString() }).eq('id', announcement.id)
        : await supabase.from('announcements').delete().eq('id', announcement.id)

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

  const sendAnnouncementEmail = (announcement: AnnouncementWithAuthor) => setEmailRequest({ kind: 'announcement', id: announcement.id })

  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Organization"
        title="Announcements"
        icon={Megaphone}
        actions={canPost ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="portal-button"
          >
            <PlusCircle className="w-4 h-4" />
            New announcement
          </button>
        ) : undefined}
      />

      {error && <div className="portal-alert-error">{error}</div>}

      {canPost && formOpen && (
        <div className="portal-modal-backdrop" onMouseDown={() => setFormOpen(false)}>
          <form onSubmit={handleCreate} onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-3xl">
            <div className="portal-form-header">
              <div><p className="portal-eyebrow">New announcement</p><h2>Publish a member update</h2><p>Write the update first, then choose exactly who should receive it.</p></div>
              <button type="button" onClick={() => setFormOpen(false)} className="portal-icon-button"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5">
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>1</span><div><h3>Announcement</h3><p>Use a clear title and put the action or deadline near the top.</p></div></div>
                <div className="space-y-4">
                  <label><span className="portal-label">Title</span><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="portal-input w-full" placeholder="Example: Fall kickoff meeting — RSVP by Thursday" /></label>
                  <RichTextEditor id="announcement-message" label="Message" value={body} onChange={setBody} required minHeightClassName="min-h-[210px]" placeholder="Share the key update, what members need to do, and when." />
                </div>
              </section>

              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>2</span><div><h3>Audience</h3><p>Send only to approved members in the current semester.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setAudienceMode('role')} className={`portal-choice-card ${audienceMode === 'role' ? 'selected' : ''}`}><span className="mt-1 h-3 w-3 rounded-full border-2 border-primary p-0.5">{audienceMode === 'role' && <span className="block h-full w-full rounded-full bg-primary" />}</span><span><strong className="block text-sm">Position group</strong><span className="mt-1 block text-xs text-muted-foreground">Choose a role-based audience.</span></span></button>
                  <button type="button" onClick={() => setAudienceMode('people')} className={`portal-choice-card ${audienceMode === 'people' ? 'selected' : ''}`}><span className="mt-1 h-3 w-3 rounded-full border-2 border-primary p-0.5">{audienceMode === 'people' && <span className="block h-full w-full rounded-full bg-primary" />}</span><span><strong className="block text-sm">People or custom group</strong><span className="mt-1 block text-xs text-muted-foreground">Search names or reuse a semester team.</span></span></button>
                </div>
                <div className="mt-4">
                  {audienceMode === 'role' ? <label><span className="portal-label">Position group</span><select value={roleScope} onChange={(e) => setRoleScope(e.target.value as any)} className="portal-input w-full"><option value="all">All BOSSO members</option><option value="general_member">General Members only</option><option value="analyst">Analysts and above</option><option value="analyst_only">Analysts only</option><option value="project_manager">PMs and Board</option><option value="board_member">Board only</option></select></label> : <MemberGroupPicker users={peopleOptions} groups={memberGroups} value={selectedUserIds} onChange={setSelectedUserIds} placeholder="Search approved current-semester members..." />}
                </div>
              </section>

              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>3</span><div><h3>Resources <span className="font-normal text-muted-foreground">(optional)</span></h3><p>Add useful destinations or one supporting PDF/image.</p></div></div>
                <ReferenceLinksEditor value={referenceLinks} onChange={setReferenceLinks} description="Add registration forms, meeting links, shared documents, or relevant pages." />
                <div className="mt-5 border-t border-border pt-5"><p className="portal-label">File attachment <span className="font-normal text-muted-foreground">(optional)</span></p><input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} className="portal-input w-full file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground" /></div>
              </section>
            </div>

            <div className="portal-form-actions"><button type="button" onClick={() => setFormOpen(false)} className="portal-button-secondary justify-center">Cancel</button><button type="submit" className="portal-button justify-center"><Megaphone className="h-4 w-4" /> Publish announcement</button></div>
          </form>
        </div>
      )}

      <div className="portal-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="portal-input w-full pl-9" placeholder="Search announcements, authors, or attachments" />
        </div>
        <p className="text-xs text-muted-foreground">{visibleAnnouncements.length} of {announcements.length} announcements</p>
      </div>

      <div className="portal-panel p-0 sm:p-0">
        {loading && (
          <div className="portal-loading">
            Loading announcements...
          </div>
        )}

        {!loading && visibleAnnouncements.length === 0 && (
          <div className="portal-empty compact">
            <Megaphone className="h-8 w-8" />
            <h3>{announcements.length === 0 ? 'No announcements yet' : 'No matching announcements'}</h3>
            <p>{announcements.length === 0 ? 'Semester updates will appear here when they are published.' : 'Try a broader search term.'}</p>
          </div>
        )}

        {!loading && visibleAnnouncements.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-3 border-b border-border p-5 transition-colors last:border-b-0 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
          >
            <Link href={`/announcements/${a.id}`} className="block min-w-0 flex-1">
              <h2 className="min-w-0 break-words text-base font-semibold text-foreground">
                {a.title}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Posted by {a.author?.full_name ?? 'Unknown'}
                </span>
                {a.unread && (
                  <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive uppercase tracking-wide text-[11px]">
                    Unread
                  </span>
                )}
                {canManageAnnouncement(a) && (a.role_scope || (a.target_user_ids?.length ?? 0) > 0) && (
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
                {(a.reference_links?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {a.reference_links?.length} link{a.reference_links?.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-4">
              {canPost && (
                <div className="flex w-[5.5rem] shrink-0 items-center justify-end gap-2">
                  {canManageAnnouncement(a) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          sendAnnouncementEmail(a)
                        }}
                        className="portal-icon-button"
                        title="Send email to members"
                        aria-label={`Send ${a.title} by email`}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(a, e)}
                        className="portal-icon-button text-destructive hover:text-destructive"
                        title="Delete announcement"
                        aria-label={`Delete ${a.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
              <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      <SendEmailModal request={emailRequest} onClose={() => setEmailRequest(null)} />
    </div>
  )
}
