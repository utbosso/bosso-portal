'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import RichTextContent from '@/components/RichTextContent'
import RichTextEditor from '@/components/RichTextEditor'
import type { UserOption } from '@/components/UserSearch'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import ReferenceLinksEditor from '@/components/ReferenceLinksEditor'
import { announcementBodyToPlainText } from '@/lib/announcement-rich-text'
import type { Announcement, AnnouncementRead, Profile } from '@/types/database.types'
import { ArrowLeft, ExternalLink, Link2, Megaphone, Pencil, Save, Trash2, X, Paperclip } from 'lucide-react'
import SectionPageHeader from '@/components/SectionPageHeader'
import {
  appendAnnouncementFallbackLinks,
  extractAnnouncementFallbackLinks,
  isMissingReferenceLinksColumn,
  normalizeReferenceLinks,
  type ReferenceLink,
} from '@/lib/reference-links'
import {
  canAccessAudience,
  fromRoleScopePayload,
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
}

type AudienceMode = 'role' | 'people'

export default function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, profile, hasMinimumRole, loading: authLoading } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id, authLoading)

  const [announcement, setAnnouncement] = useState<AnnouncementWithAuthor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('role')
  const [roleScope, setRoleScope] = useState<RoleScopeOption>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [peopleOptions, setPeopleOptions] = useState<UserOption[]>([])
  const [memberGroups, setMemberGroups] = useState<CommunicationMemberGroup[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLink[]>([])

  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'
  const canManage = isUserAdmin || announcement?.created_by === profile?.id || hasMinimumRole('board_member')
  const canSeeAudienceTarget = isUserAdmin || announcement?.created_by === profile?.id
  const canView = (item: Announcement | null) => {
    if (!item) return false
    return canAccessAudience(
      profile?.id,
      profile?.role,
      item.role_scope,
      item.role_scope_mode,
      item.target_user_ids
    )
  }

  const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_')

  const fetchAnnouncement = async () => {
    if (accessLoading) return
    setLoading(true)
    setError(null)
    try {
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
      let announcementQuery: any = supabase
        .from('announcements')
        .select(`${baseSelect}, reference_links`)
        .eq('id', params.id)
      if (schemaReady && access?.term_id) {
        announcementQuery = announcementQuery.eq('term_id', access.term_id).is('archived_at', null)
      }
      let announcementResult = await announcementQuery.single()

      if (isMissingReferenceLinksColumn(announcementResult.error)) {
        let fallbackQuery: any = supabase.from('announcements').select(baseSelect).eq('id', params.id)
        if (schemaReady && access?.term_id) {
          fallbackQuery = fallbackQuery.eq('term_id', access.term_id).is('archived_at', null)
        }
        announcementResult = await fallbackQuery.single()
      }

      const { data, error } = announcementResult

      if (error) throw error

      const rawRecord = (data as any) as AnnouncementWithAuthor
      const fallbackLinks = extractAnnouncementFallbackLinks(rawRecord.body)
      const structuredLinks = Array.isArray(rawRecord.reference_links) ? rawRecord.reference_links : []
      const record = { ...rawRecord, body: fallbackLinks.body, reference_links: structuredLinks.length ? structuredLinks : fallbackLinks.links }
      setAnnouncement(record)
      setTitle(record.title ?? '')
      setBody(record.body ?? '')
      setReferenceLinks(record.reference_links ?? [])
      setAudienceMode((record?.target_user_ids?.length ?? 0) > 0 ? 'people' : 'role')
      setRoleScope(fromRoleScopePayload(record?.role_scope, record?.role_scope_mode))
      setSelectedUserIds(record?.target_user_ids ?? [])
      setAttachmentFile(null)
      setRemoveAttachment(false)

      if (record.attachment_path) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('announcement-attachments')
          .createSignedUrl(record.attachment_path, 60 * 60)

        if (signedError) {
          console.warn('Failed to create signed URL for announcement attachment', signedError)
          setAttachmentUrl(null)
        } else {
          setAttachmentUrl(signedData.signedUrl)
        }
      } else {
        setAttachmentUrl(null)
      }

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
  }, [params.id, profile?.id, profile?.role, access?.term_id, schemaReady, accessLoading])

  useEffect(() => {
    const fetchPeopleOptions = async () => {
      if (!canManage) return
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
  }, [access?.term_id, canManage])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcement) return

    setSaving(true)
    setError(null)

    try {
      if (!announcementBodyToPlainText(body).trim()) {
        setError('Message cannot be empty.')
        setSaving(false)
        return
      }
      if (audienceMode === 'people' && selectedUserIds.length === 0) {
        setError('Please select at least one member.')
        setSaving(false)
        return
      }

      const scopePayload = toRoleScopePayload(roleScope)
      const normalizedLinks = normalizeReferenceLinks(referenceLinks)
      const payload: Record<string, any> = {
        title,
        body,
        role_scope: audienceMode === 'role' ? scopePayload.roleScope : null,
        role_scope_mode: audienceMode === 'role' ? scopePayload.roleScopeMode : null,
        target_user_ids: audienceMode === 'people' ? selectedUserIds : null,
        reference_links: normalizedLinks,
      }

      const currentAttachmentPath = announcement.attachment_path
      let uploadedAttachmentPath: string | null = null

      if (attachmentFile) {
        uploadedAttachmentPath = `${announcement.id}/${Date.now()}-${sanitizeFileName(attachmentFile.name)}`
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(uploadedAttachmentPath, attachmentFile, {
            contentType: attachmentFile.type || undefined,
            upsert: false,
          })
        if (uploadError) throw uploadError

        payload.attachment_path = uploadedAttachmentPath
        payload.attachment_name = attachmentFile.name
        payload.attachment_mime_type = attachmentFile.type || null
      } else if (removeAttachment) {
        payload.attachment_path = null
        payload.attachment_name = null
        payload.attachment_mime_type = null
      }

      let updateResult = await (supabase as any)
        .from('announcements')
        .update(payload)
        .eq('id', announcement.id)

      if (isMissingReferenceLinksColumn(updateResult.error)) {
        const { reference_links: _referenceLinks, ...fallbackPayload } = payload
        updateResult = await (supabase as any)
          .from('announcements')
          .update({ ...fallbackPayload, body: appendAnnouncementFallbackLinks(body, normalizedLinks) })
          .eq('id', announcement.id)
      }

      const { error } = updateResult

      if (error) {
        if (uploadedAttachmentPath) {
          await supabase.storage.from('announcement-attachments').remove([uploadedAttachmentPath])
        }
        throw error
      }

      const shouldDeleteOldAttachment =
        !!currentAttachmentPath &&
        (removeAttachment || (uploadedAttachmentPath !== null && uploadedAttachmentPath !== currentAttachmentPath))

      if (shouldDeleteOldAttachment) {
        const { error: removeError } = await supabase.storage
          .from('announcement-attachments')
          .remove([currentAttachmentPath])
        if (removeError) {
          console.warn('Failed to remove old attachment after update', removeError)
        }
      }

      await fetchAnnouncement()
      setEditing(false)
    } catch (err: any) {
      console.error('Error updating announcement', err)
      setError(err instanceof Error && /link|https?:\/\//i.test(err.message) ? err.message : 'Failed to update announcement. You may not have permission.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!announcement) return
    const confirmDelete = window.confirm('Archive this announcement? It will remain in semester history.')
    if (!confirmDelete) return

    setDeleting(true)
    setError(null)

    try {
      const { error } = schemaReady
        ? await (supabase as any).from('announcements').update({ archived_at: new Date().toISOString() }).eq('id', announcement.id)
        : await supabase.from('announcements').delete().eq('id', announcement.id)

      if (error) throw error

      router.push('/announcements')
    } catch (err: any) {
      console.error('Error deleting announcement', err)
      setError('Failed to delete announcement. You may not have permission.')
      setDeleting(false)
    }
  }

  const cancelEditing = () => {
    setEditing(false)
    setAttachmentFile(null)
    setRemoveAttachment(false)
  }

  if (loading) {
    return (
      <div className="portal-page space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <div className="portal-loading">Loading announcement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="portal-page space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <div className="portal-alert-error">{error}</div>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="portal-page space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <div className="portal-empty compact"><Megaphone className="h-8 w-8" /><h3>Announcement not found</h3></div>
      </div>
    )
  }

  if (!canView(announcement)) {
    return (
      <div className="portal-page space-y-4">
        <Link href="/announcements" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to announcements
        </Link>
        <div className="portal-alert-error">You do not have access to this announcement.</div>
      </div>
    )
  }

  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Announcement"
        title={announcement.title}
        description={`Posted by ${announcement.author?.full_name ?? 'Unknown'} · ${new Date(announcement.created_at).toLocaleString()}`}
        icon={Megaphone}
        fullWidthTitle
        actions={<>
          <Link href="/announcements" className="portal-button-secondary"><ArrowLeft className="h-4 w-4" /> All announcements</Link>
          {canManage && !editing && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setAttachmentFile(null)
                setRemoveAttachment(false)
              }}
              className="portal-button-secondary"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="portal-button-secondary text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          )}
        </>}
      />

      {!editing ? (
        <article className="portal-panel space-y-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {announcement.author?.role && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                  {announcement.author.role.replace('_', ' ')}
                </span>
              )}
              {canSeeAudienceTarget && (announcement.role_scope || (announcement.target_user_ids?.length ?? 0) > 0) && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[11px]">
                  Target: {announcement.target_user_ids?.length
                    ? `${announcement.target_user_ids.length} selected member(s)`
                    : getRoleScopeLabel(announcement.role_scope, announcement.role_scope_mode)}
                </span>
              )}
            </div>
          </div>

          <RichTextContent
            content={announcement.body}
            className="min-w-0 max-w-full space-y-2 [overflow-wrap:anywhere] text-sm leading-relaxed text-muted-foreground [&_a]:break-all [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
          />

          {announcement.reference_links && announcement.reference_links.length > 0 && (
            <section className="border-t border-border pt-5">
              <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Links</h2></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {announcement.reference_links.map((link, index) => (
                  <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/40"><span className="min-w-0 truncate">{link.label}</span><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></a>
                ))}
              </div>
            </section>
          )}

          {announcement.attachment_name && attachmentUrl && (
            <div className="pt-2 border-t border-primary/10 space-y-3">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Paperclip className="w-4 h-4" />
                Open attachment: {announcement.attachment_name}
              </a>

              {announcement.attachment_mime_type?.startsWith('image/') && (
                <img
                  src={attachmentUrl}
                  alt={announcement.attachment_name}
                  className="max-w-full max-h-[420px] rounded-md border border-primary/20 object-contain"
                />
              )}
            </div>
          )}
        </article>
      ) : (
        <div className="portal-modal-backdrop" onMouseDown={cancelEditing}>
          <form onSubmit={handleUpdate} onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-3xl">
            <div className="portal-form-header"><div><p className="portal-eyebrow">Edit announcement</p><h2>Update the member message</h2><p>Changes appear in the portal immediately; email copies already sent will not update.</p></div><button type="button" onClick={cancelEditing} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <div className="space-y-5">
              <section className="portal-form-section"><div className="portal-form-section-heading"><span>1</span><div><h3>Announcement</h3><p>Keep the title direct and the requested action easy to find.</p></div></div><div className="space-y-4"><label><span className="portal-label">Title</span><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="portal-input w-full" /></label><RichTextEditor id="announcement-edit-message" label="Message" value={body} onChange={setBody} required minHeightClassName="min-h-[220px]" /></div></section>
              <section className="portal-form-section"><div className="portal-form-section-heading"><span>2</span><div><h3>Audience</h3><p>Keep or change the current-semester audience.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setAudienceMode('role')} className={`portal-choice-card ${audienceMode === 'role' ? 'selected' : ''}`}><span><strong className="block text-sm">Position group</strong><span className="mt-1 block text-xs text-muted-foreground">Choose a role-based audience.</span></span></button><button type="button" onClick={() => setAudienceMode('people')} className={`portal-choice-card ${audienceMode === 'people' ? 'selected' : ''}`}><span><strong className="block text-sm">People or custom group</strong><span className="mt-1 block text-xs text-muted-foreground">Search names or semester teams.</span></span></button></div><div className="mt-4">{audienceMode === 'role' ? <select value={roleScope} onChange={(e) => setRoleScope(e.target.value as any)} className="portal-input w-full"><option value="all">All BOSSO members</option><option value="general_member">General Members only</option><option value="analyst">Analysts and above</option><option value="analyst_only">Analysts only</option><option value="project_manager">PMs and Board</option><option value="board_member">Board only</option></select> : <MemberGroupPicker users={peopleOptions} groups={memberGroups} value={selectedUserIds} onChange={setSelectedUserIds} placeholder="Search approved current-semester members..." />}</div></section>
              <section className="portal-form-section"><div className="portal-form-section-heading"><span>3</span><div><h3>Resources <span className="font-normal text-muted-foreground">(optional)</span></h3><p>Update useful links or replace the supporting PDF/image.</p></div></div><ReferenceLinksEditor value={referenceLinks} onChange={setReferenceLinks} description="Add registration forms, meeting links, shared documents, or relevant pages." /><div className="mt-5 border-t border-border pt-5"><p className="portal-label">File attachment <span className="font-normal text-muted-foreground">(optional)</span></p>{announcement.attachment_name && !removeAttachment && <div className="mb-3 rounded-lg border border-border bg-card p-3 text-sm">Current file: {announcement.attachment_name}</div>}{announcement.attachment_name && <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={removeAttachment} onChange={(e) => setRemoveAttachment(e.target.checked)} /> Remove current attachment</label>}<input type="file" accept="application/pdf,image/*" onChange={(e) => { setAttachmentFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setRemoveAttachment(false) }} className="portal-input w-full file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground" /></div></section>
              {error && <div className="portal-alert-error">{error}</div>}
            </div>
            <div className="portal-form-actions"><button type="button" onClick={cancelEditing} className="portal-button-secondary justify-center">Cancel</button><button type="submit" disabled={saving} className="portal-button justify-center"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
