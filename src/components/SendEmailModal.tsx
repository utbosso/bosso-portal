'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'

export type SendEmailRequest = {
  kind: 'event' | 'announcement' | 'approval' | 'dues' | 'password'
  id?: string
  userId?: string
  role?: string
  semesterPrice?: string | null
  annualPrice?: string | null
  password?: string
}

type Plan = { subject: string; label: string; count: number; previewTo: string | null }

const KIND_TITLES: Record<SendEmailRequest['kind'], string> = {
  event: 'Email event invite',
  announcement: 'Email announcement',
  approval: 'Email account approval',
  dues: 'Email dues reminder',
  password: 'Email temporary password',
}

export default function SendEmailModal({ request, onClose }: { request: SendEmailRequest | null; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState('')
  const [previewSent, setPreviewSent] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null)

  const call = useCallback(
    async (mode: 'plan' | 'preview' | 'send') => {
      const response = await fetch('/api/communications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'The email request failed.')
      return payload
    },
    [request]
  )

  useEffect(() => {
    setPlan(null)
    setError('')
    setPreviewSent(false)
    setResult(null)
    setBusy(null)
    if (!request) return
    let cancelled = false
    setLoadingPlan(true)
    call('plan')
      .then((payload) => { if (!cancelled) setPlan(payload) })
      .catch((planError) => { if (!cancelled) setError(planError.message) })
      .finally(() => { if (!cancelled) setLoadingPlan(false) })
    return () => { cancelled = true }
  }, [request, call])

  if (!request) return null

  const isBulk = request.kind === 'event' || request.kind === 'announcement'
  const canSend = Boolean(plan) && !busy && !result && (!isBulk || previewSent)

  const run = async (mode: 'preview' | 'send') => {
    setBusy(mode)
    setError('')
    try {
      const payload = await call(mode)
      if (mode === 'preview') setPreviewSent(true)
      else setResult({ sent: payload.sent, failed: payload.failed || [] })
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'The email could not be sent.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="portal-modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-md">
        <div className="portal-form-header">
          <div>
            <p className="portal-eyebrow">Send from the portal</p>
            <h2>{KIND_TITLES[request.kind]}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="portal-icon-button"><X className="h-5 w-5" /></button>
        </div>

        {loadingPlan && <div className="portal-loading mt-6"><Loader2 className="animate-spin" /> Preparing…</div>}

        {plan && !result && (
          <div className="mt-6 space-y-3 text-sm">
            <p><span className="text-muted-foreground">Subject:</span> <strong>{plan.subject}</strong></p>
            <p><span className="text-muted-foreground">To:</span> <strong>{plan.label}</strong></p>
            {isBulk && <p className="text-xs text-muted-foreground">Recipients are BCC'd, so members can't see each other.</p>}
            <p className="rounded-lg bg-muted p-3 text-xs">
              {isBulk
                ? `Send yourself a preview first${plan.previewTo ? ` (goes to ${plan.previewTo})` : ''}, check how it looks, then send it to everyone.`
                : 'You can send a preview to yourself first, or send it straight away.'}
            </p>
            {previewSent && <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Preview sent{plan.previewTo ? ` to ${plan.previewTo}` : ''}. Check your inbox.</p>}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Sent to {result.sent} recipient{result.sent === 1 ? '' : 's'}.</p>
            {result.failed.length > 0 && <p className="text-red-700">{result.failed.length} could not be delivered: {result.failed.join(', ')}</p>}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="portal-form-actions">
          {result ? (
            <button type="button" onClick={onClose} className="portal-button justify-center">Done</button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={Boolean(busy)} className="portal-button-secondary justify-center">Cancel</button>
              <button
                type="button"
                disabled={!plan || Boolean(busy)}
                onClick={() => void run('preview')}
                className={`${isBulk && !previewSent ? 'portal-button' : 'portal-button-secondary'} justify-center`}
              >
                {busy === 'preview' && <Loader2 className="h-4 w-4 animate-spin" />}
                {previewSent ? 'Send preview again' : 'Send preview to me'}
              </button>
              <button
                type="button"
                disabled={!canSend}
                onClick={() => void run('send')}
                className={`${isBulk && !previewSent ? 'portal-button-secondary' : 'portal-button'} justify-center`}
              >
                {busy === 'send' && <Loader2 className="h-4 w-4 animate-spin" />}
                {isBulk && plan ? `Send to ${plan.count}` : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
