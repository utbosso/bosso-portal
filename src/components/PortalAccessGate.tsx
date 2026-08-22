'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, BadgeCheck, CircleDollarSign, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import { getRenewalMessage } from '@/lib/semester'

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/pending-approval',
]

export default function PortalAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading: authLoading, signOut } = useAuth()
  const { access, loading, schemaReady, error, refresh } = usePortalAccess(user?.id)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isPublicPath = useMemo(
    () => PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    [pathname]
  )

  if (isPublicPath || !user || !schemaReady || access?.access_granted) return <>{children}</>

  if (authLoading || loading) {
    return (
      <div className="portal-entry">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p>Checking semester access…</p>
      </div>
    )
  }

  const submitRenewal = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const response = await fetch('/api/semester/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Renewal could not be submitted.')
      setSubmitted(true)
      setCode('')
      await refresh()
    } catch (renewalError) {
      setFormError(renewalError instanceof Error ? renewalError.message : 'Renewal could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  const waiting = submitted || access?.reason === 'dues_required' || access?.reason === 'pending_approval'

  return (
    <div className="min-h-screen bg-background px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <section className="flex flex-col justify-between bg-[#221f1c] p-8 text-white sm:p-12">
            <div>
              <div className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-orange-200">
                <ShieldCheck className="h-5 w-5" /> BOSSO MEMBER PORTAL
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
                {access?.term_name || 'New semester'}
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">Welcome back.</h1>
            </div>

            <p className="mt-10 text-base leading-7 text-stone-300">
              Your account and history are safe. We only need to confirm your position and dues coverage for the new semester.
            </p>

            <div className="mt-10 space-y-4 text-sm text-stone-300">
              <div className="flex items-center gap-3"><BadgeCheck className="h-5 w-5 text-orange-300" /> No new email verification for returning accounts</div>
              <div className="flex items-center gap-3"><CircleDollarSign className="h-5 w-5 text-orange-300" /> One-semester and full-year dues are supported</div>
            </div>
          </section>

          <section className="p-8 sm:p-12">
            <p className="text-sm font-medium text-primary">Semester renewal</p>
            <h2 className="mt-2 text-3xl font-semibold">Confirm your access</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{getRenewalMessage(access)}</p>

            {error && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
            )}

            {waiting ? (
              <div className="mt-8 rounded-xl border border-orange-200 bg-orange-50 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-primary">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">Renewal received</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Your account will unlock automatically after dues and your position are approved.
                </p>
                <button onClick={() => void refresh()} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  <RefreshCw className="h-4 w-4" /> Refresh status
                </button>
              </div>
            ) : (
              <form onSubmit={submitRenewal} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">New position code</span>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="off"
                    placeholder="Enter the code shared by the board"
                    className="portal-input w-full"
                    required
                  />
                </label>
                {formError && <p className="text-sm text-red-700">{formError}</p>}
                <button disabled={submitting} className="portal-button w-full justify-center">
                  {submitting ? 'Submitting…' : 'Continue renewal'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            <button onClick={() => void signOut()} className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
