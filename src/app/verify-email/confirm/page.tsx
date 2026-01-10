'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          setStatus('error')
          setMessage('Unable to verify email. Please try again.')
          return
        }

        // Update the profile to mark email as verified
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email_verified: true,
            verified_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          setStatus('error')
          setMessage('Failed to verify email. Please contact support.')
          return
        }

        setStatus('success')
        setMessage('Email verified successfully! Your account is now pending admin approval.')
      } catch (err) {
        console.error('Verification error:', err)
        setStatus('error')
        setMessage('An unexpected error occurred. Please try again.')
      }
    }

    verifyEmail()
  }, [])

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Glowing card */}
        <div className="card-glow p-8 space-y-6">
          {/* Loading state */}
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <svg className="animate-spin h-12 w-12 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Verifying Email...
                </h1>
                <p className="text-sm text-muted-foreground">
                  Please wait while we verify your email address.
                </p>
              </div>
            </>
          )}

          {/* Success state */}
          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-gradient">
                  Email Verified!
                </h1>
                <p className="text-sm text-muted-foreground">
                  {message}
                </p>
              </div>

              <div className="bg-dark-100 border border-primary/20 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">What's next?</h3>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>A BOSSO admin will review your account</li>
                  <li>You'll receive an email when your account is approved</li>
                  <li>Once approved, you can sign in and access the portal</li>
                </ol>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground text-center">
                  Approval typically takes 1-2 business days. If you have urgent needs, contact the BOSSO board at internal@txbosso.com.
                </p>
              </div>

              <Link
                href="/login"
                className="block w-full text-center py-3 btn-neon"
              >
                Back to Sign In
              </Link>
            </>
          )}

          {/* Error state */}
          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 border border-destructive/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                  Verification Failed
                </h1>
                <p className="text-sm text-destructive">
                  {message}
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/verify-email"
                  className="block w-full text-center py-3 btn-neon"
                >
                  Try Again
                </Link>

                <Link
                  href="/login"
                  className="block w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
                >
                  Back to Sign In
                </Link>
              </div>
            </>
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
