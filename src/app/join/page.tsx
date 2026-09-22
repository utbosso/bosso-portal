'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  eid: '',
  graduationYear: '',
  major: '',
  howHeard: '',
  note: '',
  website: '', // honeypot - real visitors never see or fill this in
}

export default function JoinPage() {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/membership-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
            <h1 className="text-3xl font-bold text-gradient">Join BOSSO</h1>
            <p className="text-sm text-muted-foreground">
              Tell us a bit about yourself and we'll follow up by email with how to join as a general member.
            </p>
          </div>

          {submitted ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Thanks for your interest!</h2>
              <p className="text-sm text-muted-foreground">
                We got your submission. A board member will reach out by email with next steps to join the portal.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input
                type="text"
                value={form.website}
                onChange={set('website')}
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
                <label htmlFor="fullName" className="text-sm font-medium text-foreground">Full name</label>
                <input id="fullName" required value={form.fullName} onChange={set('fullName')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="Jane Smith" />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <input id="email" type="email" required value={form.email} onChange={set('email')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="jane@utexas.edu" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</label>
                  <input id="phone" type="tel" required value={form.phone} onChange={set('phone')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="(512) 555-0100" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="graduationYear" className="text-sm font-medium text-foreground">Grad year <span className="text-muted-foreground">(optional)</span></label>
                  <input id="graduationYear" value={form.graduationYear} onChange={set('graduationYear')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="2028" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="major" className="text-sm font-medium text-foreground">Major <span className="text-muted-foreground">(optional)</span></label>
                  <input id="major" value={form.major} onChange={set('major')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="Finance" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="eid" className="text-sm font-medium text-foreground">UT EID <span className="text-muted-foreground">(optional)</span></label>
                  <input id="eid" value={form.eid} onChange={set('eid')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="abc1234" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="howHeard" className="text-sm font-medium text-foreground">How did you hear about us? <span className="text-muted-foreground">(optional)</span></label>
                <input id="howHeard" value={form.howHeard} onChange={set('howHeard')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon" placeholder="A friend, an event, Instagram..." />
              </div>

              <div className="space-y-2">
                <label htmlFor="note" className="text-sm font-medium text-foreground">Anything else? <span className="text-muted-foreground">(optional)</span></label>
                <textarea id="note" rows={3} value={form.note} onChange={set('note')} className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon resize-none" placeholder="Tell us why you're interested" />
              </div>

              <button type="submit" disabled={submitting} className="w-full btn-neon py-3 font-semibold flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
