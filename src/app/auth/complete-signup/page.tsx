'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function CompleteSignupPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  console.log('[complete-signup] Component mounted/re-rendered, status:', status)

  useEffect(() => {
    const completeSignup = async () => {
      try {
        console.log('[complete-signup] Starting completeSignup function')
        // Get signup data from session storage
        const signupDataStr = sessionStorage.getItem('signup_data')
        console.log('[complete-signup] signupDataStr:', signupDataStr ? 'exists' : 'null')

        if (!signupDataStr) {
          // No signup data - this might be a regular login, not signup
          // Check if user already has a profile
          const { data: { user } } = await supabase.auth.getUser()

          console.log('[complete-signup] No signup data, user:', user?.email)

          if (!user) {
            console.log('[complete-signup] No user, setting error')
            setErrorMessage('Authentication failed. Please try again.')
            setStatus('error')
            return
          }

          // Check if user has a profile
          console.log('[complete-signup] Querying profile for user:', user.id)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle() // Use maybeSingle() instead of single() to avoid error when no rows

          console.log('[complete-signup] Profile:', profile)
          console.log('[complete-signup] Profile error:', profileError)
          console.log('[complete-signup] Profile error code:', profileError?.code)
          console.log('[complete-signup] Profile error message:', profileError?.message)

          // If there's an error or no profile, user hasn't signed up
          if (profileError || !profile) {
            console.log('[complete-signup] No profile found or error, checking if profile exists with admin query')

            // Try to check if profile exists by querying the profiles table
            // This will tell us if the user has a profile but RLS is blocking it (pending)
            // or if they truly don't have a profile (never signed up)
            const { count, error: countError } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('id', user.id)

            console.log('[complete-signup] Profile count check:', count, 'error:', countError)

            // If count is 1 or there's a permission error, profile exists but is pending
            if (count === 1 || countError?.code === '42501' || countError?.code === 'PGRST301') {
              console.log('[complete-signup] Permission denied or count=1 - profile exists but is pending')
              router.push('/pending-approval')
              return
            }

            // No profile found - user tried to login without signing up
            console.log('[complete-signup] No profile found, user never signed up')
            console.log('[complete-signup] About to sign out')
            await supabase.auth.signOut()
            console.log('[complete-signup] Signed out, setting error state')
            setErrorMessage('No account found. Please sign up first with a valid registration code.')
            setStatus('error')
            console.log('[complete-signup] Error state set')
            return
          }

          // Existing user logging in - support both old and new status values
          console.log('[complete-signup] Profile found, status:', profile.account_status)

          // For Google OAuth users, ensure email_verified is true (in case it wasn't set before)
          const isGoogleUser = user.app_metadata?.provider === 'google' ||
                               user.app_metadata?.providers?.includes('google') ||
                               user.identities?.some((identity: any) => identity.provider === 'google')

          if (isGoogleUser && profile.email_verified !== true) {
            console.log('[complete-signup] Google user without email_verified, updating...')
            await supabase
              .from('profiles')
              .update({ email_verified: true })
              .eq('id', user.id)
          }

          if (profile.account_status === 'pending_approval' || profile.account_status === 'pending') {
            console.log('[complete-signup] Redirecting to pending-approval')
            router.push('/pending-approval')
          } else if (profile.account_status === 'approved' || profile.account_status === 'active') {
            console.log('[complete-signup] Redirecting to dashboard')
            router.push('/dashboard')
          } else {
            console.log('[complete-signup] Unknown status, signing out')
            await supabase.auth.signOut()
            router.push('/login?error=account_not_approved')
          }
          return
        }

        const signupData = JSON.parse(signupDataStr)
        const { fullName, registrationCode, intendedRole } = signupData

        // Clear signup data from session storage
        sessionStorage.removeItem('signup_data')

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || !user.email) {
          setErrorMessage('Failed to get user information.')
          setStatus('error')
          return
        }

        // Validate email domain again (extra safety check)
        const email = user.email.toLowerCase()
        if (!email.endsWith('@utexas.edu') && !email.endsWith('@eid.utexas.edu') && !email.endsWith('@txbosso.com')) {
          await supabase.auth.signOut()
          setErrorMessage('Only @utexas.edu, @eid.utexas.edu, and @txbosso.com email addresses are allowed.')
          setStatus('error')
          return
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (existingProfile) {
          // Profile exists, update it
          console.log('[complete-signup] Updating existing profile')
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              account_status: 'pending_approval',
              role: intendedRole,
              email_verified: true, // Google OAuth verifies email
            })
            .eq('id', user.id)

          if (updateError) {
            console.error('Profile update error:', updateError)
            setErrorMessage('Failed to complete signup. Please contact support.')
            setStatus('error')
            return
          }
        } else {
          // Profile doesn't exist, create it
          console.log('[complete-signup] Creating new profile')
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: fullName,
              account_status: 'pending_approval',
              role: intendedRole,
              email_verified: true, // Google OAuth verifies email
            })

          if (insertError) {
            console.error('Profile insert error:', insertError)
            setErrorMessage('Failed to create profile. Please contact support.')
            setStatus('error')
            return
          }
        }

        // Increment code usage
        try {
          await supabase.rpc('increment_code_usage', {
            code_text: registrationCode,
            user_uuid: user.id
          })
        } catch (codeError) {
          console.error('Error incrementing code usage:', codeError)
          // Don't fail the signup if code increment fails
        }

        // Success! Redirect to pending approval page
        setStatus('success')
        setTimeout(() => {
          router.push('/pending-approval')
        }, 1500)

      } catch (err) {
        console.error('Complete signup error:', err)
        setErrorMessage('An unexpected error occurred.')
        setStatus('error')
      }
    }

    completeSignup()
  }, [router])

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
        <div className="card-glow p-8 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <svg className="animate-spin h-12 w-12 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gradient">Completing Your Signup...</h1>
          <p className="text-muted-foreground">Please wait while we set up your account.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
        <div className="card-glow p-8 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gradient">Signup Successful!</h1>
          <p className="text-muted-foreground">
            Your account has been created. Redirecting to pending approval page...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      <div className="card-glow p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-destructive">Signup Error</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>
        <button
          onClick={() => router.push('/signup')}
          className="w-full btn-neon py-3"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
