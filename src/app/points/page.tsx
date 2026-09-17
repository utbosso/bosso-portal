'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Camera,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import { EMPTY_POINT_SUMMARY, POINT_CATEGORY_OPTIONS } from '@/lib/semester'
import UserSearch, { type UserOption } from '@/components/UserSearch'
import { fetchCurrentMemberDirectory } from '@/lib/communication-recipients'
import { canAccessAudience } from '@/lib/role-scope'
import type {
  EventCategory,
  MemberTermPointSummary,
  PointLedgerEntry,
  PointRequest,
  PointRequestStatus,
  TermPointRule,
} from '@/types/database.types'

const supabase = createClient()
const PORTAL_ADMIN_EMAIL = 'internal@txbosso.com'

const statusStyles: Record<PointRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  needs_info: 'bg-blue-50 text-blue-800 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  declined: 'bg-stone-100 text-stone-700 border-stone-200',
}

function categoryLabel(category: EventCategory) {
  return POINT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || category
}

type RequestableEvent = {
  id: string
  title: string
  start_at: string
  point_value: number | null
  event_category: EventCategory | null
}

export default function PointsPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { access, schemaReady } = usePortalAccess(user?.id, authLoading)
  const [summary, setSummary] = useState<MemberTermPointSummary | null>(null)
  const [rules, setRules] = useState<TermPointRule[]>([])
  const [rulesPublished, setRulesPublished] = useState(false)
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([])
  const [requests, setRequests] = useState<PointRequest[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({})
  const [requestMemberOptions, setRequestMemberOptions] = useState<UserOption[]>([])
  const [requestableEvents, setRequestableEvents] = useState<RequestableEvent[]>([])
  const [proofLinks, setProofLinks] = useState<Record<string, { name: string; url: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [requestedPoints, setRequestedPoints] = useState('')
  const [category, setCategory] = useState<EventCategory>('membership')
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewPrompt, setReviewPrompt] = useState<{ request: PointRequest; status: PointRequestStatus } | null>(null)
  const [reviewFinalPoints, setReviewFinalPoints] = useState('')
  const [reviewFinalCategory, setReviewFinalCategory] = useState<EventCategory>('membership')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')

  const isPortalAdmin = user?.email?.toLowerCase() === PORTAL_ADMIN_EMAIL
  const activeTermId = access?.term_id
  // loadPoints also re-runs from a window-focus listener and realtime
  // subscriptions further below (any point_ledger/point_requests change),
  // both far more frequent than this page's own data actually changing.
  // Unconditionally showing the loading state on every one of those blanked
  // the whole page for an instant on every tab refocus.
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
  }, [activeTermId])

  const loadPoints = useCallback(async () => {
    if (!user || !activeTermId || !schemaReady) {
      setLoading(false)
      return
    }

    if (!hasLoadedRef.current) setLoading(true)
    setError('')

    const [summaryResult, rulesResult, ledgerResult, requestResult, termResult] = await Promise.all([
      supabase
        .from('member_term_point_summary')
        .select('*')
        .eq('term_id', activeTermId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('term_point_rules').select('*').eq('term_id', activeTermId).order('category'),
      supabase
        .from('point_ledger')
        .select('*')
        .eq('term_id', activeTermId)
        .eq('user_id', user.id)
        .is('voided_at', null)
        .order('occurred_at', { ascending: false })
        .limit(100),
      isPortalAdmin
        ? supabase.from('point_requests').select('*').eq('term_id', activeTermId).order('created_at', { ascending: false }).limit(200)
        : supabase
            .from('point_requests')
            .select('*')
            .eq('term_id', activeTermId)
            .or(`user_id.eq.${user.id},submitted_by.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(200),
      supabase.from('academic_terms').select('points_rules_status').eq('id', activeTermId).maybeSingle(),
    ])

    const firstError = summaryResult.error || rulesResult.error || ledgerResult.error || requestResult.error || termResult.error
    if (firstError) {
      setError(firstError.message)
      hasLoadedRef.current = true
      setLoading(false)
      return
    }

    setSummary(summaryResult.data as MemberTermPointSummary | null)
    setRules((rulesResult.data || []) as TermPointRule[])
    setRulesPublished(termResult.data?.points_rules_status === 'published')
    setLedger((ledgerResult.data || []) as PointLedgerEntry[])
    const nextRequests = (requestResult.data || []) as PointRequest[]
    setRequests(nextRequests)

    if (nextRequests.length) {
      const { data: attachments } = await supabase
        .from('point_request_attachments')
        .select('request_id, storage_path, file_name')
        .in('request_id', nextRequests.slice(0, 500).map((request) => request.id))
      const nextProofLinks: Record<string, { name: string; url: string }> = {}
      await Promise.all((attachments || []).map(async (attachment) => {
        const { data: signed } = await supabase.storage.from('point-request-proof').createSignedUrl(attachment.storage_path, 900)
        if (signed?.signedUrl) nextProofLinks[attachment.request_id] = { name: attachment.file_name, url: signed.signedUrl }
      }))
      setProofLinks(nextProofLinks)
    } else {
      setProofLinks({})
    }

    if (nextRequests.length) {
      const ids = Array.from(new Set(nextRequests.flatMap((request) => [request.user_id, request.submitted_by].filter(Boolean) as string[])))
      const { data: members } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setMemberNames(Object.fromEntries((members || []).map((member) => [member.id, member.full_name])))

      const eventIds = Array.from(new Set(nextRequests.map((request) => request.event_id).filter(Boolean) as string[]))
      if (eventIds.length) {
        const { data: linkedEvents } = await supabase.from('events').select('id, title').in('id', eventIds)
        setEventTitles(Object.fromEntries((linkedEvents || []).map((item) => [item.id, item.title])))
      } else {
        setEventTitles({})
      }
    } else {
      setMemberNames({})
      setEventTitles({})
    }

    hasLoadedRef.current = true
    setLoading(false)
  }, [activeTermId, isPortalAdmin, schemaReady, user])

  useEffect(() => {
    void loadPoints()
  }, [loadPoints])

  useEffect(() => {
    if (!user || !schemaReady) return
    const loadRequestMembers = async () => {
      try {
        const { members } = await fetchCurrentMemberDirectory()
        const options = members.filter((member) => member.role !== 'admin')
        setRequestMemberOptions(options)
        setBeneficiaryIds((current) => {
          const approvedIds = new Set(options.map((member) => member.id))
          const retained = current.filter((id) => approvedIds.has(id))
          return retained.length > 0 ? retained : approvedIds.has(user.id) ? [user.id] : []
        })
      } catch (directoryError) {
        console.error('Current-semester members could not be loaded for point requests', directoryError)
        setRequestMemberOptions([])
      }
    }
    void loadRequestMembers()
  }, [activeTermId, schemaReady, user])

  useEffect(() => {
    if (!activeTermId || !schemaReady || !profile) {
      setRequestableEvents([])
      return
    }
    const loadRequestableEvents = async () => {
      const { data, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_at, point_value, event_category, audience_scope, audience_scope_mode, target_user_ids')
        .eq('term_id', activeTermId)
        .is('archived_at', null)
        .lte('start_at', new Date().toISOString())
        .order('start_at', { ascending: false })
        .limit(100)

      if (eventsError) {
        console.error('Requestable events could not be loaded', eventsError)
        setRequestableEvents([])
        return
      }

      const eligible = ((data || []) as any[]).filter((item) =>
        canAccessAudience(user?.id, profile.role, item.audience_scope, item.audience_scope_mode, item.target_user_ids)
      )
      setRequestableEvents(eligible)
    }
    void loadRequestableEvents()
  }, [activeTermId, schemaReady, profile, user?.id])

  useEffect(() => {
    if (!activeTermId || !user || !schemaReady) return
    const channel = supabase
      .channel(`points-page:${activeTermId}:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_terms', filter: `id=eq.${activeTermId}` }, () => void loadPoints())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'term_point_rules', filter: `term_id=eq.${activeTermId}` }, () => void loadPoints())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_ledger' }, () => void loadPoints())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_requests' }, () => void loadPoints())
      .subscribe()

    const refresh = () => void loadPoints()
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      void supabase.removeChannel(channel)
    }
  }, [activeTermId, loadPoints, schemaReady, user])

  const values = summary || ({ ...EMPTY_POINT_SUMMARY, term_id: activeTermId || '', user_id: user?.id || '' } as MemberTermPointSummary)
  const categoryCards = useMemo(
    () =>
      POINT_CATEGORY_OPTIONS.map((option) => ({
        ...option,
        points: Number(values[`${option.value}_points` as keyof MemberTermPointSummary] || 0),
      })),
    [values]
  )
  // BOSSO requires one flat semester total, not a minimum per category - sum
  // this role's rows (term_point_rules still stores one row per category)
  // into that single number.
  const requiredPoints = useMemo(
    () => rules.filter((item) => item.position_role === profile?.role).reduce((sum, item) => sum + Number(item.minimum_points || 0), 0),
    [rules, profile?.role]
  )
  const pointsRemaining = rulesPublished ? Math.max(0, requiredPoints - Number(values.total_points)) : 0

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !activeTermId) return
    const approvedIds = new Set(requestMemberOptions.map((member) => member.id))
    const beneficiaries = Array.from(new Set(beneficiaryIds)).filter((id) => approvedIds.has(id))
    if (beneficiaries.length === 0) {
      setError('Select at least one member approved for the current semester.')
      return
    }
    const points = Number(requestedPoints)
    if (!Number.isFinite(points) || points <= 0 || points > 1000) {
      setError('Requested points must be between 1 and 1,000.')
      return
    }
    if (proof && (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(proof.type) || proof.size > 10 * 1024 * 1024)) {
      setError('Proof must be a JPG, PNG, WebP, or PDF no larger than 10 MB.')
      return
    }

    setSubmitting(true)
    setError('')
    const response = await fetch('/api/points/submit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        termId: activeTermId,
        beneficiaryIds: beneficiaries,
        eventId: selectedEventId || null,
        requestedPoints: points,
        category,
        note: note.trim(),
      }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.pointRequests?.length) {
      setError(result?.error || 'The request could not be created.')
      setSubmitting(false)
      return
    }
    const pointRequests = result.pointRequests

    if (proof) {
      const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const proofErrors: string[] = []
      for (const pointRequest of pointRequests) {
        const storagePath = `${user.id}/${pointRequest.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('point-request-proof').upload(storagePath, proof)
        if (uploadError) {
          proofErrors.push(uploadError.message)
          continue
        }
        const { error: attachmentError } = await supabase.from('point_request_attachments').insert({
          request_id: pointRequest.id,
          user_id: user.id,
          storage_path: storagePath,
          file_name: proof.name,
          mime_type: proof.type,
          file_size_bytes: proof.size,
        })
        if (attachmentError) proofErrors.push(attachmentError.message)
      }
      if (proofErrors.length) setError(`The requests were saved, but some proof uploads failed: ${proofErrors[0]}`)
    }

    setRequestedPoints('')
    setCategory('membership')
    setSelectedEventId('')
    setNote('')
    setProof(null)
    setBeneficiaryIds(approvedIds.has(user.id) ? [user.id] : [])
    setShowRequestForm(false)
    setSubmitting(false)
    await loadPoints()
  }

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId)
    const selected = requestableEvents.find((item) => item.id === eventId)
    if (!selected) return
    if (selected.point_value) setRequestedPoints(String(selected.point_value))
    if (selected.event_category) setCategory(selected.event_category)
    setNote((current) => (current.trim() ? current : `Attended: ${selected.title}`))
  }

  const openReviewPrompt = (request: PointRequest, status: PointRequestStatus) => {
    setReviewError('')
    setReviewFinalPoints(String(request.final_points ?? request.requested_points))
    setReviewFinalCategory(request.final_category ?? request.suggested_category)
    setReviewNote('')
    setReviewPrompt({ request, status })
  }

  const submitReviewPrompt = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reviewPrompt) return
    const { request, status } = reviewPrompt

    let finalPoints: number | null = null
    if (status === 'approved') {
      finalPoints = Number(reviewFinalPoints)
      if (!Number.isFinite(finalPoints) || finalPoints <= 0 || finalPoints > 1000) {
        setReviewError('Enter a valid point amount between 1 and 1,000.')
        return
      }
    }
    if (status === 'needs_info' && !reviewNote.trim()) {
      setReviewError('Let the member know what information is needed.')
      return
    }

    setReviewingId(request.id)
    const response = await fetch('/api/admin/point-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: request.id,
        status,
        finalPoints: status === 'approved' ? finalPoints : null,
        finalCategory: status === 'approved' ? reviewFinalCategory : null,
        reviewerNote: reviewNote.trim(),
      }),
    })
    const payload = await response.json()
    setReviewingId(null)
    if (!response.ok) {
      setReviewError(payload.error || 'Review could not be saved.')
      return
    }
    setReviewPrompt(null)
    await loadPoints()
  }

  if (!schemaReady) {
    return (
      <div className="portal-page">
        <div className="portal-empty"><Clock3 className="h-8 w-8" /><h1>Semester points are ready for migration</h1><p>The new canonical ledger will appear here after the local migration is approved and applied.</p></div>
      </div>
    )
  }

  return (
    <div className="portal-page space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="portal-eyebrow">{access?.term_name || 'Current semester'}</p>
          <h1 className="portal-title">Points</h1>
          <p className="portal-subtitle">One total, one breakdown, and a complete review history.</p>
        </div>
        <button onClick={() => setShowRequestForm(true)} className="portal-button w-full justify-center sm:w-auto"><Plus className="h-4 w-4" /> Request points</button>
      </header>

      {error && <div className="portal-alert-error">{error}</div>}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div className="portal-stat-card col-span-2 bg-[#221f1c] text-white lg:col-span-1">
          <p className="text-sm text-stone-300">Semester total</p>
          <p className="mt-5 text-4xl font-semibold">
            {Number(values.total_points).toLocaleString()}
            {rulesPublished && requiredPoints > 0 && (
              <span className="text-lg font-normal text-stone-300"> / {requiredPoints.toLocaleString()}</span>
            )}
          </p>
          <p className="mt-2 text-xs text-stone-300">
            {rulesPublished ? (requiredPoints > 0 ? 'points toward this semester\'s requirement' : 'Requirement being finalized') : 'Requirement being finalized'}
          </p>
        </div>
        {categoryCards.map((item) => (
          <div key={item.value} className="portal-stat-card">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-5 text-3xl font-semibold">{item.points.toLocaleString()}</p>
          </div>
        ))}
      </section>

      {rulesPublished && requiredPoints > 0 && pointsRemaining > 0 && (
        <section className="portal-alert-warning p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Your next point goal</h2>
              <p className="mt-1 text-muted-foreground">
                <strong>{pointsRemaining.toLocaleString()}</strong> more point{pointsRemaining === 1 ? '' : 's'} to reach this semester's {requiredPoints.toLocaleString()}-point requirement.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="portal-panel">
          <div className="portal-panel-header"><div><h2>Point history</h2><p>Every approved source for this semester.</p></div><button onClick={() => void loadPoints()} className="portal-icon-button" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
          {loading ? <div className="portal-loading"><Loader2 className="animate-spin" /> Loading points…</div> : ledger.length === 0 ? (
            <div className="portal-empty compact"><FileText className="h-7 w-7" /><h3>No points yet</h3><p>Your new semester starts at zero. Prior semesters remain archived.</p></div>
          ) : (
            <div className="divide-y divide-border">
              {ledger.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{entry.note || categoryLabel(entry.category)}</p><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(entry.category)} · {new Date(entry.occurred_at).toLocaleDateString()}</p></div>
                  <span className={`font-semibold ${Number(entry.points) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(entry.points) > 0 ? '+' : ''}{entry.points}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-header"><div><h2>{isPortalAdmin ? 'Review queue' : 'Point requests'}</h2><p>{isPortalAdmin ? 'Review the beneficiary, submitter, and proof before awarding points.' : 'Track requests you submitted or that someone submitted for you.'}</p></div></div>
          {requests.length === 0 ? <div className="portal-empty compact"><BadgeCheck className="h-7 w-7" /><h3>All clear</h3><p>{isPortalAdmin ? 'There are no point requests to review.' : 'No requests have been submitted by you or for you.'}</p></div> : (
            <div className="space-y-3">
              {requests.map((request) => (
                <article key={request.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><p className="font-medium">For {memberNames[request.user_id] || (request.user_id === user?.id ? 'you' : 'Member')}</p><p className="mt-1 text-sm text-muted-foreground">{request.status === 'approved' ? request.final_points : request.requested_points} {request.status === 'approved' ? 'awarded' : 'requested'} · {categoryLabel(request.status === 'approved' && request.final_category ? request.final_category : request.suggested_category)}</p>{request.event_id && <p className="mt-1 text-xs text-muted-foreground">Event: {eventTitles[request.event_id] || 'Loading…'}</p>}{request.submitted_by && request.submitted_by !== request.user_id && <p className="mt-1 text-xs text-muted-foreground">Submitted by {memberNames[request.submitted_by] || (request.submitted_by === user?.id ? 'you' : 'another member')}</p>}</div><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[request.status]}`}>{request.status.replace('_', ' ')}</span></div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{request.note}</p>
                  {proofLinks[request.id] && <a href={proofLinks[request.id].url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary"><FileText className="h-3.5 w-3.5" /> View proof: {proofLinks[request.id].name}</a>}
                  {request.reviewer_note && <p className="mt-3 rounded-lg bg-muted p-3 text-xs">Admin: {request.reviewer_note}</p>}
                  {isPortalAdmin && ['pending', 'needs_info'].includes(request.status) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={reviewingId === request.id} onClick={() => openReviewPrompt(request, 'approved')} className="portal-button small">Approve</button>
                      <button disabled={reviewingId === request.id} onClick={() => openReviewPrompt(request, 'needs_info')} className="portal-button-secondary small">Needs info</button>
                      <button disabled={reviewingId === request.id} onClick={() => openReviewPrompt(request, 'declined')} className="portal-button-ghost small">Decline</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showRequestForm && (
        <div className="portal-modal-backdrop" onMouseDown={() => setShowRequestForm(false)}>
          <form onSubmit={submitRequest} onMouseDown={(event) => event.stopPropagation()} className="portal-modal">
            <div className="portal-form-header"><div><p className="portal-eyebrow">Member submission</p><h2>Submit point proof</h2><p>Submit for yourself or for other approved members who earned the same points.</p></div><button type="button" onClick={() => setShowRequestForm(false)} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <div className="mt-6">
              <label className="portal-label">Who earned these points?</label>
              <UserSearch
                users={requestMemberOptions}
                value={beneficiaryIds}
                onChange={(value) => setBeneficiaryIds(value as string[])}
                placeholder="Search approved current-semester members..."
                multiple
                selectionDisplayLimit={6}
              />
              <p className="mt-2 text-xs text-muted-foreground">One review request will be created per selected person, with the same note and proof attached.</p>
            </div>
            <label className="mt-6 block">
              <span className="portal-label">Related event (optional)</span>
              <select
                value={selectedEventId}
                onChange={(event) => handleEventSelect(event.target.value)}
                className="portal-input w-full"
              >
                <option value="">No related event / other</option>
                {requestableEvents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {new Date(item.start_at).toLocaleDateString()}
                    {item.point_value ? ` · ${item.point_value} pts` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">Picking an event fills in the points and category below from that event's settings — you can still adjust them.</p>
            </label>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label><span className="portal-label">Points requested</span><input type="number" min="0.5" max="1000" step="0.5" value={requestedPoints} onChange={(event) => setRequestedPoints(event.target.value)} className="portal-input w-full" required /></label>
              <label><span className="portal-label">Suggested category</span><select value={category} onChange={(event) => setCategory(event.target.value as EventCategory)} className="portal-input w-full">{POINT_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <label className="mt-5 block"><span className="portal-label">What did they complete?</span><textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={3} maxLength={4000} rows={5} className="portal-input w-full resize-none" placeholder="Include the event, date, contribution, and any context the reviewer needs." required /></label>
            <label className="mt-5 block rounded-xl border border-dashed border-border p-5 text-center hover:border-primary"><Camera className="mx-auto h-6 w-6 text-muted-foreground" /><span className="mt-2 block text-sm font-medium">{proof ? proof.name : 'Add a photo or PDF (optional)'}</span><span className="mt-1 block text-xs text-muted-foreground">JPG, PNG, WebP, or PDF · 10 MB max</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setProof(event.target.files?.[0] || null)} /></label>
            <div className="portal-form-actions"><button type="button" onClick={() => setShowRequestForm(false)} className="portal-button-secondary justify-center">Cancel</button><button disabled={submitting} className="portal-button justify-center">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request</button></div>
          </form>
        </div>
      )}

      {reviewPrompt && (
        <div className="portal-modal-backdrop" onMouseDown={() => setReviewPrompt(null)}>
          <form onSubmit={submitReviewPrompt} onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-md">
            <div className="portal-form-header">
              <div>
                <p className="portal-eyebrow">
                  {reviewPrompt.status === 'approved' ? 'Approve request' : reviewPrompt.status === 'declined' ? 'Decline request' : 'Ask for more info'}
                </p>
                <h2>For {memberNames[reviewPrompt.request.user_id] || 'this member'}</h2>
              </div>
              <button type="button" onClick={() => setReviewPrompt(null)} className="portal-icon-button"><X className="h-5 w-5" /></button>
            </div>

            {reviewPrompt.status === 'approved' && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="portal-label">Final points</span>
                  <input
                    type="number"
                    min="0.5"
                    max="1000"
                    step="0.5"
                    autoFocus
                    value={reviewFinalPoints}
                    onChange={(event) => setReviewFinalPoints(event.target.value)}
                    className="portal-input w-full"
                    required
                  />
                </label>
                <label>
                  <span className="portal-label">Final category</span>
                  <select
                    value={reviewFinalCategory}
                    onChange={(event) => setReviewFinalCategory(event.target.value as EventCategory)}
                    className="portal-input w-full"
                  >
                    {POINT_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            <label className="mt-5 block">
              <span className="portal-label">{reviewPrompt.status === 'needs_info' ? 'What information is needed?' : 'Note to the member (optional)'}</span>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                rows={3}
                className="portal-input w-full resize-none"
                required={reviewPrompt.status === 'needs_info'}
              />
            </label>

            {reviewError && <p className="mt-3 text-sm text-red-700">{reviewError}</p>}

            <div className="portal-form-actions">
              <button type="button" onClick={() => setReviewPrompt(null)} className="portal-button-secondary justify-center">Cancel</button>
              <button disabled={reviewingId === reviewPrompt.request.id} className="portal-button justify-center">
                {reviewingId === reviewPrompt.request.id && <Loader2 className="h-4 w-4 animate-spin" />}
                {reviewPrompt.status === 'approved' ? 'Approve & award points' : reviewPrompt.status === 'declined' ? 'Decline' : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
