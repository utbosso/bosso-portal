'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  CalendarRange,
  Check,
  Clipboard,
  Coins,
  CreditCard,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import SemesterRolloverGuide from '@/components/SemesterRolloverGuide'
import type { UserOption } from '@/components/UserSearch'
import type { CommunicationMemberGroup } from '@/lib/communication-recipients'
import { POSITION_OPTIONS } from '@/lib/semester'
import type {
  AcademicTerm,
  DuesPayment,
  DuesPaymentTerm,
  DuesPlanLength,
  DuesPrice,
  MemberTermMembership,
  PositionCodeClaim,
  TermPointRule,
  UserRole,
} from '@/types/database.types'

const PLAN_LENGTH_OPTIONS: Array<{ value: DuesPlanLength; label: string }> = [
  { value: 'semester', label: 'Semester' },
  { value: 'annual', label: 'Full year' },
]

type MemberProfile = { id: string; full_name: string; email: string; role: UserRole }
type CodeMetadata = {
  id: string
  term_id: string
  label: string
  intended_role: UserRole
  max_uses: number | null
  expires_at: string | null
  is_active: boolean
}
type SetupData = {
  terms: AcademicTerm[]
  memberships: MemberTermMembership[]
  claims: PositionCodeClaim[]
  profiles: MemberProfile[]
  codes: CodeMetadata[]
  rules: TermPointRule[]
  groups: Array<CommunicationMemberGroup & { term_id: string }>
  prices: DuesPrice[]
  checkoutSettings: { pass_fee_to_member: boolean }
  duesPayments: Array<Pick<DuesPayment, 'id' | 'user_id' | 'source'>>
  duesPaymentTerms: Array<Pick<DuesPaymentTerm, 'payment_id' | 'term_id'>>
}
type GeneratedCode = { label: string; role: UserRole; code: string }
type RoleMinimums = Record<UserRole, number>
type RoleDuesPrices = Record<UserRole, Record<DuesPlanLength, number>>

function emptyRoleMinimums(): RoleMinimums {
  return Object.fromEntries(POSITION_OPTIONS.map((position) => [position.value, 0])) as RoleMinimums
}

function emptyRoleDuesPrices(): RoleDuesPrices {
  return Object.fromEntries(
    POSITION_OPTIONS.map((position) => [position.value, { semester: 0, annual: 0 }])
  ) as RoleDuesPrices
}

function DuesPricingGrid({ value, onChange }: { value: RoleDuesPrices; onChange: (next: RoleDuesPrices) => void }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-medium">Position</th>
            {PLAN_LENGTH_OPTIONS.map((option) => (
              <th key={option.value} className="pb-2 pl-3 font-medium">{option.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POSITION_OPTIONS.map((position) => (
            <tr key={position.value}>
              <td className="py-1.5 pr-3 font-medium">{position.label}</td>
              {PLAN_LENGTH_OPTIONS.map((option) => (
                <td key={option.value} className="py-1.5 pl-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="portal-input w-full pl-6"
                      value={value[position.value][option.value]}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          [position.value]: { ...value[position.value], [option.value]: Number(event.target.value) },
                        })
                      }
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ADMIN_EMAIL = 'internal@txbosso.com'

function RoleMinimumsGrid({ value, onChange }: { value: RoleMinimums; onChange: (next: RoleMinimums) => void }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[360px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-medium">Position</th>
            <th className="pb-2 pl-3 font-medium">Required points</th>
          </tr>
        </thead>
        <tbody>
          {POSITION_OPTIONS.map((position) => (
            <tr key={position.value}>
              <td className="py-1.5 pr-3 font-medium">{position.label}</td>
              <td className="py-1.5 pl-3">
                <input
                  type="number"
                  min="0"
                  className="portal-input w-full max-w-[160px]"
                  value={value[position.value]}
                  onChange={(event) => onChange({ ...value, [position.value]: Number(event.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SemesterSetupPage() {
  const { user } = useAuth()
  const [data, setData] = useState<SetupData>({
    terms: [],
    memberships: [],
    claims: [],
    profiles: [],
    codes: [],
    rules: [],
    groups: [],
    prices: [],
    checkoutSettings: { pass_fee_to_member: false },
    duesPayments: [],
    duesPaymentTerms: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([])
  const [renewalSearch, setRenewalSearch] = useState('')
  const [duesPrompt, setDuesPrompt] = useState<{ membership: MemberTermMembership; annual: boolean } | null>(null)
  const [duesAmount, setDuesAmount] = useState('')
  const [duesError, setDuesError] = useState('')
  const [groupForm, setGroupForm] = useState({ id: '', name: '', description: '', memberIds: [] as string[] })
  const [termForm, setTermForm] = useState({
    name: 'Spring 2027',
    slug: 'spring-2027',
    academicYear: '2026–2027',
    semester: 'spring',
    startsOn: '2027-01-11',
    endsOn: '2027-05-14',
    renewalOpensAt: '2026-12-01T09:00',
  })
  const [minimums, setMinimums] = useState<RoleMinimums>(emptyRoleMinimums())
  const [ruleTermId, setRuleTermId] = useState('')
  const [ruleMinimums, setRuleMinimums] = useState<RoleMinimums>(emptyRoleMinimums())
  const [priceTermId, setPriceTermId] = useState('')
  const [duesPrices, setDuesPrices] = useState<RoleDuesPrices>(emptyRoleDuesPrices())
  const [passFeeToMember, setPassFeeToMember] = useState(false)

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  const loadSetup = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    const response = await fetch('/api/admin/semester', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) setError(payload.error || 'Semester setup could not be loaded.')
    else setData({
      ...payload,
      groups: payload.groups || [],
      prices: payload.prices || [],
      checkoutSettings: payload.checkoutSettings || { pass_fee_to_member: false },
      duesPayments: payload.duesPayments || [],
      duesPaymentTerms: payload.duesPaymentTerms || [],
    })
    setLoading(false)
  }, [isAdmin])

  useEffect(() => {
    void loadSetup()
  }, [loadSetup])

  const currentTerm = data.terms.find((term) => term.status === 'current')
  const upcomingTerms = data.terms.filter((term) => ['upcoming', 'draft'].includes(term.status))
  const currentMemberships = data.memberships.filter((membership) => membership.term_id === currentTerm?.id)
  const currentGroups = data.groups.filter((group) => group.term_id === currentTerm?.id)
  const editableTerms = data.terms.filter((term) => ['current', 'upcoming', 'draft'].includes(term.status))
  const selectedRuleTerm = editableTerms.find((term) => term.id === ruleTermId)
  const profilesById = useMemo(
    () => Object.fromEntries(data.profiles.map((profile) => [profile.id, profile])),
    [data.profiles]
  )
  const filteredCurrentMemberships = currentMemberships.filter((membership) => {
    const member = profilesById[membership.user_id]
    const query = renewalSearch.trim().toLowerCase()
    if (!query) return true
    return `${member?.full_name || ''} ${member?.email || ''} ${membership.position_role}`
      .toLowerCase()
      .includes(query)
  })
  const currentMemberOptions = useMemo<UserOption[]>(
    () => currentMemberships
      .filter((membership) =>
        ['active', 'exempt'].includes(membership.status) &&
        ['paid', 'exempt'].includes(membership.dues_status) &&
        membership.position_role !== 'admin'
      )
      .map((membership) => {
        const member = profilesById[membership.user_id]
        return {
          id: membership.user_id,
          full_name: member?.full_name || 'Unknown member',
          email: member?.email,
          role: membership.position_role,
        }
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [currentMemberships, profilesById]
  )

  useEffect(() => {
    const nextTermId = editableTerms.some((term) => term.id === ruleTermId)
      ? ruleTermId
      : currentTerm?.id || editableTerms[0]?.id || ''
    if (nextTermId !== ruleTermId) setRuleTermId(nextTermId)
    if (!nextTermId) return
    const nextMinimums = emptyRoleMinimums()
    for (const position of POSITION_OPTIONS) {
      const total = data.rules
        .filter((item) => item.term_id === nextTermId && item.position_role === position.value)
        .reduce((sum, item) => sum + Number(item.minimum_points || 0), 0)
      nextMinimums[position.value] = total
    }
    setRuleMinimums(nextMinimums)
    // Reset this editor only when refreshed server data or the selected term changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rules, data.terms, ruleTermId])

  useEffect(() => {
    const nextTermId = editableTerms.some((term) => term.id === priceTermId)
      ? priceTermId
      : currentTerm?.id || editableTerms[0]?.id || ''
    if (nextTermId !== priceTermId) setPriceTermId(nextTermId)
    if (!nextTermId) return
    const nextPrices = emptyRoleDuesPrices()
    for (const position of POSITION_OPTIONS) {
      for (const option of PLAN_LENGTH_OPTIONS) {
        const price = data.prices.find(
          (item) => item.term_id === nextTermId && item.position_role === position.value && item.plan_length === option.value
        )
        nextPrices[position.value][option.value] = (price?.amount_cents || 0) / 100
      }
    }
    setDuesPrices(nextPrices)
    setPassFeeToMember(data.checkoutSettings.pass_fee_to_member)
    // Reset this editor only when refreshed server data or the selected term changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.prices, data.checkoutSettings, data.terms, priceTermId])

  const duesPaymentInfoByUserAndTerm = useMemo(() => {
    // A payment covering 2+ terms is a full-year plan; 1 term is a semester
    // plan - count each payment's term coverage before mapping it per member.
    const termCountByPaymentId = new Map<string, number>()
    for (const paymentTerm of data.duesPaymentTerms) {
      termCountByPaymentId.set(paymentTerm.payment_id, (termCountByPaymentId.get(paymentTerm.payment_id) || 0) + 1)
    }
    const map = new Map<string, { source: string; planLength: 'semester' | 'annual' }>()
    for (const paymentTerm of data.duesPaymentTerms) {
      const payment = data.duesPayments.find((item) => item.id === paymentTerm.payment_id)
      if (!payment) continue
      const planLength = (termCountByPaymentId.get(paymentTerm.payment_id) || 1) >= 2 ? 'annual' : 'semester'
      map.set(`${paymentTerm.term_id}:${payment.user_id}`, { source: payment.source, planLength })
    }
    return map
  }, [data.duesPaymentTerms, data.duesPayments])

  const postAction = async (payload: Record<string, unknown>, label: string) => {
    setSaving(label)
    setError('')
    setSuccess('')
    const response = await fetch('/api/admin/semester', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    setSaving('')
    if (!response.ok) {
      setError(result.error || 'The change could not be saved.')
      return null
    }
    setSuccess(
      result.archivedCounts
        ? 'Semester activated. The rollover audit was saved.'
        : payload.action === 'update_point_rules'
          ? result.status === 'published'
            ? 'Point requirements published for members.'
            : 'Point requirements saved as a draft.'
          : 'Saved successfully.'
    )
    await loadSetup()
    return result
  }

  const saveTerm = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await postAction(
      {
        action: 'save_term',
        term: {
          ...termForm,
          renewalOpensAt: termForm.renewalOpensAt ? new Date(termForm.renewalOpensAt).toISOString() : null,
          status: 'upcoming',
        },
        minimums,
        codes: POSITION_OPTIONS.map((position) => ({
          label: `${termForm.name} — ${position.label}`,
          role: position.value,
          maxUses: position.value === 'board_member' ? 20 : null,
        })),
      },
      'save-term'
    )
    if (result?.generatedCodes) setGeneratedCodes(result.generatedCodes)
  }

  const activateTerm = async (term: AcademicTerm) => {
    const confirmed = window.confirm(
      `Activate ${term.name}? This archives current announcements, events, internal documents, feedback, and team action items. Accounts and history are preserved.`
    )
    if (!confirmed) return
    await postAction({ action: 'activate_term', termId: term.id }, `activate-${term.id}`)
  }

  const updatePointRules = async (status: 'draft' | 'published') => {
    if (!ruleTermId) return
    if (
      status === 'published' &&
      !window.confirm('Publish these point minimums? Members will immediately see them as the official requirements.')
    ) return
    await postAction(
      { action: 'update_point_rules', termId: ruleTermId, minimums: ruleMinimums, status },
      `rules-${status}`
    )
  }

  const saveDuesPricing = async () => {
    if (!priceTermId) return
    await postAction(
      { action: 'manage_dues_pricing', termId: priceTermId, prices: duesPrices, passFeeToMember },
      'dues-pricing'
    )
  }

  const openDuesPrompt = (membership: MemberTermMembership, annual: boolean) => {
    setDuesAmount('')
    setDuesError('')
    setDuesPrompt({ membership, annual })
  }

  const submitDuesPrompt = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!duesPrompt) return
    const { membership, annual } = duesPrompt
    const amountNumber = Number(duesAmount)
    if (!Number.isFinite(amountNumber) || amountNumber < 0) {
      setDuesError('Enter a valid non-negative payment amount.')
      return
    }
    const coverage = annual
      ? data.terms
          .filter((term) => term.academic_year === currentTerm?.academic_year && term.status !== 'archived')
          .map((term) => term.id)
      : [membership.term_id]
    const result = await postAction(
      {
        action: 'record_dues',
        userId: membership.user_id,
        termIds: coverage,
        amountCents: Math.round(amountNumber * 100),
      },
      `dues-${membership.id}`
    )
    if (result) setDuesPrompt(null)
  }

  const reviewMembership = async (membership: MemberTermMembership, decision: 'approve' | 'decline') => {
    if (decision === 'decline' && !window.confirm('Decline this semester renewal?')) return
    await postAction(
      { action: 'review_membership', membershipId: membership.id, decision },
      `${decision}-${membership.id}`
    )
  }

  const saveMemberGroup = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentTerm) return
    const result = await postAction(
      {
        action: 'save_member_group',
        termId: currentTerm.id,
        groupId: groupForm.id || null,
        name: groupForm.name,
        description: groupForm.description,
        userIds: groupForm.memberIds,
      },
      `group-${groupForm.id || 'new'}`
    )
    if (result) setGroupForm({ id: '', name: '', description: '', memberIds: [] })
  }

  const editMemberGroup = (group: CommunicationMemberGroup) => {
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description || '',
      memberIds: group.member_ids,
    })
  }

  const deleteMemberGroup = async (group: CommunicationMemberGroup) => {
    if (!currentTerm || !window.confirm(`Delete the current-semester group “${group.name}”?`)) return
    const result = await postAction(
      { action: 'delete_member_group', termId: currentTerm.id, groupId: group.id },
      `delete-group-${group.id}`
    )
    if (result && groupForm.id === group.id) {
      setGroupForm({ id: '', name: '', description: '', memberIds: [] })
    }
  }

  const semesterAccessLabel = (membership: MemberTermMembership) => {
    if (membership.status === 'exempt') return 'Approved · exempt'
    if (membership.status === 'active') return 'Approved this term'
    if (membership.status === 'pending_approval') return 'Awaiting approval'
    if (membership.status === 'pending_dues') return 'Dues required'
    return 'Declined'
  }

  if (!isAdmin) {
    return <div className="portal-page"><div className="portal-empty"><ShieldCheck className="h-8 w-8" /><h1>Administrator access only</h1><p>Semester setup is restricted to {ADMIN_EMAIL}.</p></div></div>
  }

  return (
    <div className="portal-page space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link>
          <p className="portal-eyebrow">Technical director handoff</p>
          <div className="flex items-center gap-2">
            <h1 className="portal-title">Semester setup</h1>
            <SemesterRolloverGuide />
          </div>
          <p className="portal-subtitle">A repeatable rollover workflow for access, dues, positions, content, and points.</p>
        </div>
        <button onClick={() => void loadSetup()} className="portal-button-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>

      {error && <div className="portal-alert-error">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="portal-stat-card"><CalendarRange className="h-5 w-5 text-primary" /><p className="mt-5 text-sm text-muted-foreground">Current term</p><p className="mt-1 text-xl font-semibold">{currentTerm?.name || 'Not active'}</p></div>
        <div className="portal-stat-card"><Users className="h-5 w-5 text-primary" /><p className="mt-5 text-sm text-muted-foreground">Signed up this term</p><p className="mt-1 text-xl font-semibold">{currentMemberships.length}</p></div>
        <div className="portal-stat-card"><BadgeCheck className="h-5 w-5 text-primary" /><p className="mt-5 text-sm text-muted-foreground">Approved this term</p><p className="mt-1 text-xl font-semibold">{currentMemberships.filter((item) => ['active', 'exempt'].includes(item.status) && ['paid', 'exempt'].includes(item.dues_status)).length}</p></div>
        <div className="portal-stat-card"><KeyRound className="h-5 w-5 text-primary" /><p className="mt-5 text-sm text-muted-foreground">Active codes</p><p className="mt-1 text-xl font-semibold">{data.codes.filter((code) => code.term_id === currentTerm?.id && code.is_active).length}</p></div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Point system</span><h2>Draft and publish minimums</h2><p>Keep requirements visibly in draft while the board is deciding, then publish one shared set of values everywhere.</p></div><Coins className="h-5 w-5 text-muted-foreground" /></div>
        {editableTerms.length === 0 ? <p className="text-sm text-muted-foreground">Create a term before editing point requirements.</p> : <>
          <label className="block max-w-sm"><span className="portal-label">Term</span><select className="portal-input w-full" value={ruleTermId} onChange={(event) => setRuleTermId(event.target.value)}>{editableTerms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.points_rules_status}</option>)}</select></label>
          <RoleMinimumsGrid value={ruleMinimums} onChange={setRuleMinimums} />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Current state: <span className="font-medium capitalize text-foreground">{selectedRuleTerm?.points_rules_status || 'draft'}</span></p><div className="flex gap-2"><button type="button" disabled={saving.startsWith('rules-')} onClick={() => void updatePointRules('draft')} className="portal-button-secondary">Save as draft</button><button type="button" disabled={saving.startsWith('rules-')} onClick={() => void updatePointRules('published')} className="portal-button"><Check className="h-4 w-4" /> Publish requirements</button></div></div>
        </>}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Stripe dues checkout</span><h2>Set dues pricing</h2><p>Members pay these amounts in the portal by card or bank transfer. Update anytime — it takes effect on the next checkout.</p></div><CreditCard className="h-5 w-5 text-muted-foreground" /></div>
        {editableTerms.length === 0 ? <p className="text-sm text-muted-foreground">Create a term before setting dues pricing.</p> : <>
          <label className="block max-w-sm"><span className="portal-label">Term</span><select className="portal-input w-full" value={priceTermId} onChange={(event) => setPriceTermId(event.target.value)}>{editableTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
          <DuesPricingGrid value={duesPrices} onChange={setDuesPrices} />
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={passFeeToMember} onChange={(event) => setPassFeeToMember(event.target.checked)} />
            Pass the card/bank processing fee on to the member (org otherwise absorbs it)
          </label>
          <div className="mt-6 flex justify-end"><button type="button" disabled={saving === 'dues-pricing'} onClick={() => void saveDuesPricing()} className="portal-button">{saving === 'dues-pricing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Save dues pricing</button></div>
        </>}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Step 1</span><h2>Prepare the next term</h2><p>Save dates, draft point minimums, and a fresh code for every position.</p></div><CalendarRange className="h-5 w-5 text-muted-foreground" /></div>
        <form onSubmit={saveTerm}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label><span className="portal-label">Term name</span><input className="portal-input w-full" value={termForm.name} onChange={(event) => setTermForm({ ...termForm, name: event.target.value })} required /></label>
            <label><span className="portal-label">Slug</span><input className="portal-input w-full" value={termForm.slug} onChange={(event) => setTermForm({ ...termForm, slug: event.target.value })} pattern="[a-z0-9-]+" required /></label>
            <label><span className="portal-label">Academic year</span><input className="portal-input w-full" value={termForm.academicYear} onChange={(event) => setTermForm({ ...termForm, academicYear: event.target.value })} required /></label>
            <label><span className="portal-label">Semester</span><select className="portal-input w-full" value={termForm.semester} onChange={(event) => setTermForm({ ...termForm, semester: event.target.value })}><option value="fall">Fall</option><option value="spring">Spring</option><option value="summer">Summer</option></select></label>
            <label><span className="portal-label">Starts</span><input type="date" className="portal-input w-full" value={termForm.startsOn} onChange={(event) => setTermForm({ ...termForm, startsOn: event.target.value })} required /></label>
            <label><span className="portal-label">Ends</span><input type="date" className="portal-input w-full" value={termForm.endsOn} onChange={(event) => setTermForm({ ...termForm, endsOn: event.target.value })} required /></label>
            <label className="md:col-span-2"><span className="portal-label">Renewal opens</span><input type="datetime-local" className="portal-input w-full" value={termForm.renewalOpensAt} onChange={(event) => setTermForm({ ...termForm, renewalOpensAt: event.target.value })} /></label>
          </div>

          <div className="mt-8 border-t border-border pt-7"><div className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /><h3 className="font-semibold">Draft point minimums</h3></div><p className="mt-1 text-sm text-muted-foreground">Leave at zero while the board finalizes the system. Members will see a clear draft notice.</p>
            <RoleMinimumsGrid value={minimums} onChange={setMinimums} />
          </div>

          <div className="mt-7 flex justify-end"><button disabled={saving === 'save-term'} className="portal-button">{saving === 'save-term' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Save term and generate codes</button></div>
        </form>
      </section>

      {generatedCodes.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-amber-800" /><div><h2 className="font-semibold text-amber-950">Copy these codes now</h2><p className="mt-1 text-sm text-amber-800">Only hashes are stored. The plain codes cannot be recovered after you leave this page.</p></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{generatedCodes.map((item) => <div key={item.code} className="flex items-center justify-between rounded-lg border border-amber-200 bg-card p-4"><div><p className="text-xs text-muted-foreground">{item.label}</p><code className="mt-1 block font-semibold text-foreground">{item.code}</code></div><button onClick={() => void navigator.clipboard.writeText(item.code)} className="portal-icon-button"><Clipboard className="h-4 w-4" /></button></div>)}</div>
        </section>
      )}

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Step 2</span><h2>Review renewals</h2><p>Dues and position approval are separate checks. Access opens only when both pass.</p></div><Users className="h-5 w-5 text-muted-foreground" /></div>
        {currentMemberships.length > 0 && (
          <div className="relative mb-5 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={renewalSearch}
              onChange={(event) => setRenewalSearch(event.target.value)}
              className="portal-input w-full pl-9"
              placeholder="Search this semester by name, email, or position"
            />
          </div>
        )}
        {loading ? <div className="portal-loading"><Loader2 className="animate-spin" /> Loading renewals…</div> : currentMemberships.length === 0 ? <div className="portal-empty compact"><Users className="h-7 w-7" /><h3>No renewals yet</h3><p>Members appear here after entering a current position code.</p></div> : (
          filteredCurrentMemberships.length === 0 ? (
            <div className="portal-empty compact"><Search className="h-7 w-7" /><h3>No matching semester members</h3><p>Try another name, email, or position.</p></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3 font-medium">Member</th><th className="pb-3 font-medium">Position</th><th className="pb-3 font-medium">Dues</th><th className="pb-3 font-medium">Semester access</th><th className="pb-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">{filteredCurrentMemberships.map((membership) => { const member = profilesById[membership.user_id]; return <tr key={membership.id}><td className="py-4"><p className="font-medium">{member?.full_name || 'Unknown member'}</p><p className="mt-1 text-xs text-muted-foreground">{member?.email}</p></td><td className="py-4 capitalize">{membership.position_role.replaceAll('_', ' ')}</td><td className="py-4 capitalize">{membership.dues_status}{(() => { const info = duesPaymentInfoByUserAndTerm.get(`${membership.term_id}:${membership.user_id}`); if (!info) return null; return <>{info.source === 'stripe' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Stripe</span>}<span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{info.planLength === 'annual' ? 'Full year' : 'Semester'}</span></> })()}</td><td className="py-4">{semesterAccessLabel(membership)}</td><td className="py-4"><div className="flex justify-end gap-2">{membership.dues_status === 'unpaid' && <><button disabled={saving.includes(membership.id)} onClick={() => openDuesPrompt(membership, false)} className="portal-button-secondary small">Semester dues</button><button disabled={saving.includes(membership.id)} onClick={() => openDuesPrompt(membership, true)} className="portal-button-secondary small">Full year</button></>}{membership.dues_status !== 'unpaid' && !['active', 'exempt'].includes(membership.status) && <button disabled={saving.includes(membership.id)} onClick={() => void reviewMembership(membership, 'approve')} className="portal-button small"><Check className="h-3.5 w-3.5" /> Approve</button>}{!['active', 'exempt', 'declined'].includes(membership.status) && <button disabled={saving.includes(membership.id)} onClick={() => void reviewMembership(membership, 'decline')} className="portal-button-ghost small">Decline</button>}</div></td></tr> })}</tbody></table></div>
          )
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Step 3</span><h2>Build semester groups</h2><p>Create reusable teams such as a PM and their analysts. Only approved members from the current semester can be selected.</p></div><Users className="h-5 w-5 text-muted-foreground" /></div>
        {!currentTerm ? <p className="text-sm text-muted-foreground">Activate a term before creating groups.</p> : (
          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <form onSubmit={saveMemberGroup} className="space-y-5 rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{groupForm.id ? 'Edit group' : 'New group'}</h3>
                {groupForm.id && <button type="button" className="portal-button-ghost small" onClick={() => setGroupForm({ id: '', name: '', description: '', memberIds: [] })}>Cancel edit</button>}
              </div>
              <label><span className="portal-label">Group name</span><input className="portal-input w-full" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Example: Jordan’s analyst team" minLength={2} maxLength={80} required /></label>
              <label><span className="portal-label">Description (optional)</span><input className="portal-input w-full" value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} placeholder="What this group is used for" maxLength={500} /></label>
              <MemberGroupPicker
                users={currentMemberOptions}
                groups={currentGroups.filter((group) => group.id !== groupForm.id)}
                value={groupForm.memberIds}
                onChange={(memberIds) => setGroupForm((current) => ({ ...current, memberIds }))}
                placeholder="Search approved members in this semester..."
              />
              <button disabled={saving.startsWith('group-') || groupForm.memberIds.length === 0} className="portal-button">
                {saving.startsWith('group-') && <Loader2 className="h-4 w-4 animate-spin" />}
                {groupForm.id ? 'Save group' : 'Create group'}
              </button>
            </form>

            <div className="space-y-3">
              {currentGroups.length === 0 ? <div className="portal-empty compact"><Users className="h-7 w-7" /><h3>No custom groups yet</h3><p>Position groups remain available automatically.</p></div> : currentGroups.map((group) => (
                <article key={group.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="font-semibold">{group.name}</h3><p className="mt-1 text-sm text-muted-foreground">{group.description || `${group.member_ids.length} current-semester members`}</p><p className="mt-2 text-xs font-medium text-primary">{group.member_ids.length} member{group.member_ids.length === 1 ? '' : 's'}</p></div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => editMemberGroup(group)} className="portal-icon-button" aria-label={`Edit ${group.name}`}><Pencil className="h-4 w-4" /></button>
                      <button type="button" disabled={saving === `delete-group-${group.id}`} onClick={() => void deleteMemberGroup(group)} className="portal-icon-button text-destructive" aria-label={`Delete ${group.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-header"><div><span className="portal-eyebrow">Step 4</span><h2>Activate and archive</h2><p>This is the only rollover step. It preserves accounts and history while opening a fresh semester view.</p></div><Archive className="h-5 w-5 text-muted-foreground" /></div>
        <div className="space-y-3">{upcomingTerms.length === 0 ? <p className="text-sm text-muted-foreground">Save an upcoming term first.</p> : upcomingTerms.map((term) => <div key={term.id} className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{term.name}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(term.starts_on).toLocaleDateString()} – {new Date(term.ends_on).toLocaleDateString()} · point rules {term.points_rules_status}</p></div><button disabled={saving === `activate-${term.id}`} onClick={() => void activateTerm(term)} className="portal-button">{saving === `activate-${term.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Activate term</button></div>)}</div>
      </section>

      <section className="rounded-xl border border-border bg-[#221f1c] p-6 text-white"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-orange-300" /><div><h2 className="font-semibold">Rollover safety rules</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-stone-300">Never delete auth users or profiles. Archive semester content, create a new membership row, keep dues coverage linked to every paid term, and let the canonical ledger scope points by term. Every activation writes an audit record for the next technical director.</p></div></div></section>

      {duesPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm" aria-hidden="true" onClick={() => setDuesPrompt(null)} />
          <form onSubmit={submitDuesPrompt} className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">
              Record {duesPrompt.annual ? 'full-year' : 'semester'} dues
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profilesById[duesPrompt.membership.user_id]?.full_name || 'This member'}
            </p>
            <label className="mt-5 block">
              <span className="portal-label">Payment amount in dollars</span>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                className="portal-input w-full"
                value={duesAmount}
                onChange={(event) => setDuesAmount(event.target.value)}
                required
              />
            </label>
            {duesError && <p className="mt-2 text-sm text-red-700">{duesError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDuesPrompt(null)} className="portal-button-secondary">Cancel</button>
              <button type="submit" disabled={saving.startsWith('dues-')} className="portal-button">
                {saving.startsWith('dues-') && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
