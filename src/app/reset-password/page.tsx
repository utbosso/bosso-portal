'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setValidSession(true)
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.')
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      console.error('Error resetting password:', err)
      setError('Failed to reset password. Please try again.')
    } finally {
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
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gradient">
              Set New Password
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your new password below.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {success ? (
            <div className="space-y-4">
              <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">Password reset successful!</p>
                <p className="text-xs">You can now sign in with your new password. Redirecting to login...</p>
              </div>

              <Link
                href="/login"
                className="block w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
              >
                Go to Login
              </Link>
            </div>
          ) : validSession ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Resetting password...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <Link
                href="/forgot-password"
                className="block w-full text-center py-3 btn-neon"
              >
                Request New Reset Link
              </Link>

              <Link
                href="/login"
                className="block w-full text-center py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all hover-glow"
              >
                Back to Login
              </Link>
            </div>
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
