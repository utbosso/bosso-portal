'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserRole } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    registrationCode: '',
    email: '',
    password: '',
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingCode, setValidatingCode] = useState(false)
  const [codeValidated, setCodeValidated] = useState(false)
  const [intendedRole, setIntendedRole] = useState<UserRole>('general_member')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for error in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'no_profile') {
      setError('No account found. Please sign up first before trying to log in.')
    } else if (errorParam === 'invalid_domain') {
      setError('Only @utexas.edu, @eid.utexas.edu, @my.utexas.edu, and @txbosso.com email addresses are allowed.')
    }
  }, [searchParams])

  const validateRegistrationCode = async () => {
    if (!formData.registrationCode) {
      setError('Please enter a position code')
      return
    }

    setValidatingCode(true)
    setError('')

    try {
      const response = await fetch('/api/semester/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formData.registrationCode }),
      })
      const result = await response.json()

      if (response.ok && result.valid) {
        setCodeValidated(true)
        setIntendedRole(result.intendedRole)
        setError('')
      } else {
        setError('Invalid or expired position code. Please contact the BOSSO board at internal@txbosso.com.')
      }
    } catch (err) {
      console.error('Error validating code:', err)
      setError('Failed to validate the position code. Please try again.')
    } finally {
      setValidatingCode(false)
    }
  }

  const handleGoogleSignIn = async () => {
    // Check if code is validated
    if (!codeValidated) {
      setError('Please validate your position code first')
      return
    }

    // Check if full name is provided
    if (!formData.fullName.trim()) {
      setError('Please enter your full name')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Store signup data in session storage for callback
      const signupData = JSON.stringify({
        fullName: formData.fullName,
        registrationCode: formData.registrationCode,
        intendedRole: intendedRole,
      })
      sessionStorage.setItem('signup_data', signupData)
      localStorage.setItem('signup_data', signupData)

      // Initiate Google OAuth sign in
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: 'utexas.edu', // Restrict to UT Austin domain
          },
        },
      })

      if (error) {
        console.error('Google sign in error:', error)
        setError('Failed to initiate Google sign in. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleEmailPasswordSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if code is validated
    if (!codeValidated) {
      setError('Please validate your position code first')
      return
    }

    // Check if full name is provided
    if (!formData.fullName.trim()) {
      setError('Please enter your full name')
      return
    }

    // Validate email domain
    const email = formData.email.toLowerCase().trim()
    if (!email.endsWith('@eid.utexas.edu') && !email.endsWith('@my.utexas.edu')) {
      setError('Only @eid.utexas.edu and @my.utexas.edu email addresses are allowed for email/password signup')
      return
    }

    // Validate password
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)
    setError('')

    try {
      const signupData = JSON.stringify({
        fullName: formData.fullName,
        registrationCode: formData.registrationCode,
        intendedRole,
      })
      sessionStorage.setItem('signup_data', signupData)
      localStorage.setItem('signup_data', signupData)

      // New email/password accounts must confirm the automated Supabase email.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('No user returned from signup')

      if (!authData.session) {
        router.push('/verify-email?email=' + encodeURIComponent(email))
        return
      }

      // Create or update profile
      // Check if profile already exists (in case auth trigger created it)
      console.log('[signup] Checking if profile exists for user:', authData.user.id)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      console.log('[signup] Existing profile:', existingProfile ? 'found' : 'not found')
      console.log('[signup] Setting up profile with role:', intendedRole)

      if (existingProfile) {
        // Profile exists (created by auth trigger), update it with correct role
        console.log('[signup] Profile exists, updating with correct role:', intendedRole)
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            account_status: 'pending_approval',
            email_verified: false,
          })
          .eq('id', authData.user.id)
          .select()

        if (updateError) {
          console.error('[signup] Profile update error:', updateError)
          throw updateError
        }

        console.log('[signup] Profile updated successfully:', updatedProfile)
        console.log('[signup] ROLE CHECK - Expected:', intendedRole, 'Got:', updatedProfile?.[0]?.role)
      } else {
        // Profile doesn't exist, create it
        console.log('[signup] Profile does not exist, creating new profile')
        const profileData = {
          id: authData.user.id,
          email: email,
          full_name: formData.fullName,
          account_status: 'pending_approval',
          role: 'general_member' as const,
          email_verified: false,
        }
        console.log('[signup] Profile data being inserted:', profileData)

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()

        if (insertError) {
          console.error('[signup] Profile insert error:', insertError)
          throw insertError
        }

        console.log('[signup] Profile inserted successfully:', insertedProfile)
        console.log('[signup] ROLE CHECK - Expected:', intendedRole, 'Got:', insertedProfile?.[0]?.role)
      }

      // The code is claimed after authentication and remains pending until an
      // administrator approves the new term membership.
      await fetch('/api/semester/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formData.registrationCode }),
      })

      // Sign out immediately so they need to verify email first
      await supabase.auth.signOut()

      // Redirect to verify email page
      router.push('/verify-email?email=' + encodeURIComponent(email))
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      
      <div className="relative w-full max-w-md">
        {/* Glowing card */}
        <div className="card-glow p-8 space-y-6">
          {/* Logo/Title */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gradient">
              Join BOSSO Portal
            </h1>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Signup form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="registrationCode" className="text-sm font-medium text-foreground">
                Position Code
              </label>
              <div className="flex gap-2">
                <input
                  id="registrationCode"
                  name="registrationCode"
                  type="text"
                  value={formData.registrationCode}
                  onChange={handleChange}
                  required
                  disabled={codeValidated}
                  className="portal-input min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Enter position code"
                />
                {!codeValidated && (
                  <button
                    type="button"
                    onClick={validateRegistrationCode}
                    disabled={validatingCode || !formData.registrationCode}
                    className="portal-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {validatingCode ? 'Validating...' : 'Validate'}
                  </button>
                )}
                {codeValidated && (
                  <div className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Valid
                  </div>
                )}
              </div>
              {codeValidated && (
                <p className="text-xs text-emerald-700">
                  Code accepted. Requested position: <span className="font-semibold">{intendedRole.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>. An admin will review it before access opens.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="portal-input w-full"
                placeholder="First Last"
              />
            </div>

            {/* Email/Password Form for @eid.utexas.edu / @my.utexas.edu */}
            {showPasswordForm && codeValidated && formData.fullName.trim() && (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="portal-input w-full"
                    placeholder="yourname@eid.utexas.edu or @my.utexas.edu"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be an @eid.utexas.edu or @my.utexas.edu email address
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="portal-input w-full"
                    placeholder="Minimum 8 characters"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEmailPasswordSignup}
                  disabled={loading || !formData.email.trim() || !formData.password.trim()}
                  className="w-full btn-neon py-3 font-semibold"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="w-full text-center py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to other sign-up options
                </button>
              </>
            )}

            {/* OAuth Sign In Buttons */}
            {!showPasswordForm && (
              <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || !codeValidated || !formData.fullName.trim()}
              className="google-auth-button flex w-full items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 font-semibold shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:px-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-gray-700" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-gray-700">Redirecting...</span>
                </span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="whitespace-nowrap">Sign up with Google</span>
                </>
              )}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              Use your <span className="text-primary font-medium">@utexas.edu</span> Google account
            </p>

            {/* Or Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-dark-200 text-muted-foreground">
                  OR
                </span>
              </div>
            </div>

            {/* Email/Password Option for @eid.utexas.edu / @my.utexas.edu */}
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              disabled={loading || !codeValidated || !formData.fullName.trim()}
              className="w-full py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign up with UT email
            </button>
            <p className="text-center text-xs text-muted-foreground">For @eid.utexas.edu or @my.utexas.edu accounts</p>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-dark-200 text-muted-foreground">
                Already in BOSSO?
              </span>
            </div>
          </div>

          {/* Sign in link */}
          <Link
            href="/login"
            className="block w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
          >
            Sign in instead
          </Link>
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-secondary rounded-full" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent rounded-full" />
        </div>
      </div>
    </div>
  )
}
