'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const { signOut, user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data)
      setProfileLoading(false)
    }

    if (user) void fetchProfile()
    else if (!loading) setProfileLoading(false)
  }, [user, loading])

  useEffect(() => {
    if (profileLoading) return
    if (!profile && user) {
      void signOut()
      router.push('/signup?error=no_profile')
      return
    }
    if (profile?.account_status === 'approved' || profile?.account_status === 'active') {
      router.push('/dashboard')
    }
  }, [profile, profileLoading, user, router, signOut])

  const isEmailVerified = Boolean(profile?.email_verified || user?.email_confirmed_at)
  const isUserDataReady = !loading && !profileLoading && user

  if (!isUserDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="portal-loading"><RefreshCw className="h-5 w-5 animate-spin" /> Checking your account…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <Clock3 className="h-6 w-6" />
        </div>
        <p className="portal-eyebrow mt-6">New member review</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Account pending approval</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Your permanent BOSSO account has been created. Portal access opens after your position and dues are reviewed.</p>

        {user.email && <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Signed in as</p><p className="mt-1 font-medium text-foreground">{user.email}</p></div>}

        <div className="mt-6 space-y-3">
          <div className="flex gap-3 rounded-xl border border-border p-4"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${isEmailVerified ? 'text-emerald-600' : 'text-muted-foreground'}`} /><div><p className="text-sm font-medium">Email verification</p><p className="mt-1 text-sm text-muted-foreground">{isEmailVerified ? 'Verified automatically.' : 'Use the verification link sent to your email.'}</p></div></div>
          <div className="flex gap-3 rounded-xl border border-border p-4"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Dues and position review</p><p className="mt-1 text-sm text-muted-foreground">An administrator will confirm both before granting access.</p></div></div>
        </div>

        <p className="mt-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">Returning members do not repeat email verification. They use the semester renewal screen and keep their account history.</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => window.location.reload()} className="portal-button"><RefreshCw className="h-4 w-4" /> Refresh status</button><button onClick={() => void signOut()} className="portal-button-secondary"><LogOut className="h-4 w-4" /> Sign out</button></div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Need help? <a href="mailto:internal@txbosso.com" className="font-medium text-primary hover:underline">internal@txbosso.com</a></p>
      </div>
    </div>
  )
}
