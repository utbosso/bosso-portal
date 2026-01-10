'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for error parameters in URL
    const errorParam = searchParams.get('error')
    if (errorParam === 'account_rejected') {
      setError('Your account has been rejected. Please contact the BOSSO board at internal@txbosso.com for more information.')
    } else if (errorParam === 'auth_failed') {
      setError('Authentication failed. Please try again.')
    } else if (errorParam === 'no_email') {
      setError('Unable to retrieve email from Google account.')
    } else if (errorParam === 'invalid_domain') {
      setError('Only @utexas.edu, @eid.utexas.edu, and @txbosso.com email addresses are allowed.')
    } else if (errorParam === 'account_not_approved') {
      setError('Your account is not approved. Please wait for admin approval.')
    }
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account', // Allow user to select which Google account
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

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      })

      if (signInError) throw signInError

      // Check profile for manual email verification status
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email_verified, account_status')
        .eq('id', data.user.id)
        .single()

      if (profileData && profileData.email_verified === false) {
        await supabase.auth.signOut()
        setError('Your email has not been verified yet. Please wait for an admin to send you a verification email.')
        setLoading(false)
        return
      }

      // Success - will redirect via auth hook
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in. Please check your credentials.')
      setLoading(false)
    }
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
              BOSSO Member Portal
            </h1>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Email/Password Login Form */}
          {showPasswordForm && (
            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
                  placeholder="yourname@eid.utexas.edu"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-3 font-semibold"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="w-full text-center py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to other sign-in options
              </button>
            </form>
          )}

          {/* Login with Google or Microsoft */}
          {!showPasswordForm && (
            <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-4 rounded-lg border-2 border-gray-300 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
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

            {/* Email/Password Login Option */}
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              disabled={loading}
              className="w-full py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign in with Email/Password
            </button>
          </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-dark-200 text-muted-foreground">
                New to BOSSO Portal?
              </span>
            </div>
          </div>

          {/* Sign up link */}
          <Link
            href="/signup"
            className="block w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
          >
            Create BOSSO account
          </Link>
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-secondary rounded-full" />
        </div>
      </div>
    </div>
  )
}
