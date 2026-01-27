'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const { signOut, user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Fetch profile directly to avoid RLS/caching issues
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(data)
      setProfileLoading(false)
    }

    if (user) {
      fetchProfile()
    } else if (!loading) {
      setProfileLoading(false)
    }
  }, [user, loading])

  // Check if user signed in with Google OAuth (email is auto-verified)
  // Multiple detection methods:
  // 1. Supabase metadata/identities
  // 2. Email domain: @utexas.edu (non-eid, non-my) = Google OAuth, @eid.utexas.edu / @my.utexas.edu = email/password
  const email = (user?.email || profile?.email || '').toLowerCase()
  const isGoogleByEmail = email.endsWith('@utexas.edu') && !email.endsWith('@eid.utexas.edu') && !email.endsWith('@my.utexas.edu')
  const isGoogleByMetadata =
    user?.app_metadata?.provider === 'google' ||
    user?.app_metadata?.providers?.includes('google') ||
    user?.identities?.some((identity: any) => identity.provider === 'google')

  const isGoogleUser = isGoogleByEmail || isGoogleByMetadata
  const isEmailVerified = profile?.email_verified === true || isGoogleUser

  useEffect(() => {
    // Wait for profile loading to complete before making decisions
    if (profileLoading) return

    // If no profile exists after loading, sign out and redirect to signup
    if (!profile && user) {
      signOut()
      router.push('/signup?error=no_profile')
      return
    }

    // If account is approved, redirect to dashboard
    if (profile?.account_status === 'approved' || profile?.account_status === 'active') {
      router.push('/dashboard')
    }
  }, [profile, profileLoading, user, router, signOut])

  const handleSignOut = async () => {
    await signOut()
  }

  // Show loading while auth or profile is loading
  const isUserDataReady = !loading && !profileLoading && user

  if (!isUserDataReady) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
        <div className="card-glow p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Glowing card */}
        <div className="card-glow p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gradient">
              Account Pending Approval
            </h1>
            <p className="text-sm text-muted-foreground">
              Your account is awaiting approval from a BOSSO administrator.
            </p>
          </div>

          {/* User info */}
          {user?.email && (
            <div className="bg-dark-100 border border-primary/20 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
              <p className="text-foreground font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Email verified: {isEmailVerified ? (
                  <span className="text-green-400 font-semibold">Yes ✓</span>
                ) : (
                  <span className="text-amber-400 font-semibold">No - Pending Admin</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Account status: <span className="text-yellow-400 font-semibold">Pending</span>
              </p>
            </div>
          )}

          {/* Information */}
          <div className="bg-dark-100 border border-primary/20 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">What's happening?</h3>
            {isEmailVerified ? (
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Your email has been verified successfully</li>
                <li>A BOSSO admin is reviewing your account</li>
                <li>You'll receive an email when your account is approved</li>
                <li>Once approved, you can access the full portal</li>
              </ol>
            ) : (
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>A BOSSO admin will send you an email verification request</li>
                <li>Reply to that email to verify your account</li>
                <li>Once the admin receives your reply, they'll mark your email as verified</li>
                <li>Your account will then be reviewed and approved</li>
                <li>You'll be able to access the full portal once approved</li>
              </ol>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-semibold text-foreground">Typical approval time:</span> 1-2 business days
            </p>
            <p className="text-xs text-muted-foreground text-center mt-2">
              For urgent matters, contact the BOSSO board at internal@txbosso.com.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary/20 border border-primary/30 rounded-lg text-primary hover:bg-primary/30 hover:border-primary/50 transition-all font-medium"
            >
              Refresh Status
            </button>

            <button
              onClick={handleSignOut}
              className="w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
            >
              Sign Out
            </button>
          </div>

          {/* Help */}
          <div className="border-t border-primary/20 pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Need help? Contact{' '}
              <a href="mailto:internal@txbosso.com" className="text-primary hover:underline">
                internal@txbosso.com
              </a>
            </p>
          </div>
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-yellow-500 rounded-full" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent rounded-full" />
        </div>
      </div>
    </div>
  )
}
