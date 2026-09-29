'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function NewsletterSubscribePage() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot - real visitors never see or fill this in
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Your submission could not be sent. Please try again.')
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your submission could not be sent. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <div className="relative w-full max-w-lg">
        <div className="card-glow p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gradient">Subscribe to the Newsletter</h1>
            <p className="text-sm text-muted-foreground">
              Get new BOSSO newsletter issues sent straight to your inbox.
            </p>
          </div>

          {submitted ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">You&rsquo;re subscribed!</h2>
              <p className="text-sm text-muted-foreground">
                We&rsquo;ll email you when the next issue is out.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input
                type="text"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              {error && (
                <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
                  placeholder="jane@utexas.edu"
                />
              </div>

              <button type="submit" disabled={submitting} className="w-full btn-neon py-3 font-semibold flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
