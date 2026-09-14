'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function VerifyEmailPage() {
  const { user, profile, signOut, loading: authLoading } = useAuth()
  const [emailParam, setEmailParam] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if email was provided in URL (from signup)
    const email = searchParams.get('email')
    if (email) {
      setEmailParam(email)
    }
  }, [searchParams])

  useEffect(() => {
    // Don't redirect while still loading
    if (authLoading) return

    // Once email is verified, PortalAccessGate takes over from the dashboard
    // route and shows whatever's next (Pay Dues, a wait screen, etc.) - no
    // need to also wait for account_status here.
    if (profile && profile.email_verified !== false) {
      router.push('/dashboard')
    }
  }, [profile, router, authLoading])

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
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
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gradient">
              Account Created Successfully
            </h1>
            <p className="text-sm text-muted-foreground">
              {emailParam ? 'Your account is pending verification and admin approval' : 'Your email needs to be verified'}
            </p>
          </div>

          {/* User email */}
          {(user?.email || emailParam) && (
            <div className="bg-dark-100 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Email address</p>
              <p className="text-foreground font-medium">{user?.email || emailParam}</p>
            </div>
          )}

          {/* Email verification status - show for new signups */}
          {emailParam && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-amber-400 font-semibold text-sm">Email Not Verified</span>
              </div>
              <p className="text-xs text-muted-foreground">
                An administrator will email you to confirm this address.
              </p>
            </div>
          )}


          {/* Instructions */}
          {emailParam && (
            <div className="bg-dark-100 border border-primary/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">What happens next?</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>An administrator will email you to confirm this address</li>
                <li>Reply to confirm, and an administrator will mark it verified</li>
                <li>Your position code and dues status will be reviewed</li>
                <li>Portal access opens after administrator approval</li>
              </ol>
            </div>
          )}

          {/* Instructions for logged in users */}
          {!emailParam && (
            <div className="bg-dark-100 border border-primary/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">What happens next?</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>An administrator will email you to confirm this address</li>
                <li>Reply to confirm, and an administrator will mark it verified</li>
                <li>Your position and dues will be reviewed</li>
                <li>Portal access opens after approval</li>
              </ol>
            </div>
          )}

          {/* Action buttons */}
          {emailParam ? (
            <Link
              href="/login"
              className="block w-full text-center py-3 btn-neon"
            >
              Go to Login
            </Link>
          ) : user ? (
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full text-center py-3 btn-neon"
              >
                Refresh status
              </button>
              <button
                onClick={signOut}
                className="w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="block w-full text-center py-3 btn-neon"
            >
              Go to Login
            </Link>
          )}
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary rounded-full" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent rounded-full" />
        </div>
      </div>
    </div>
  )
}
