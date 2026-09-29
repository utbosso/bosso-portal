'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function NewsletterUnsubscribePage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .catch(() => {})
      .finally(() => setDone(true))
  }, [token])

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <div className="relative w-full max-w-lg">
        <div className="card-glow p-8 space-y-6 text-center">
          {done ? (
            <div className="space-y-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h1 className="text-lg font-semibold text-foreground">You&rsquo;ve been unsubscribed</h1>
              <p className="text-sm text-muted-foreground">
                You won&rsquo;t receive any more newsletter emails from BOSSO.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-6">
              <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
              <p className="text-sm text-muted-foreground">Unsubscribing…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
