'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DEMOGRAPHIC_SCHOOLS, CLASS_STANDING_LABELS } from '@/lib/demographics'

// One-time, mandatory survey shown to every fully-approved member until
// they complete it - deliberately a standalone overlay rather than wired
// into PortalAccessGate's access-status state machine, since this is a
// temporary data-collection effort, not a permanent access rule.
const SCHOOLS = DEMOGRAPHIC_SCHOOLS
const CLASS_STANDINGS = Object.entries(CLASS_STANDING_LABELS).map(([value, label]) => ({ value, label }))

export default function DemographicsGate({ onComplete }: { onComplete: () => void }) {
  const [schools, setSchools] = useState<string[]>([])
  const [classStanding, setClassStanding] = useState('')
  const [major, setMajor] = useState('')
  const [hasMinor, setHasMinor] = useState<'yes' | 'no' | ''>('')
  const [minor, setMinor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggleSchool = (school: string) =>
    setSchools((prev) => (prev.includes(school) ? prev.filter((item) => item !== school) : [...prev, school]))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (schools.length === 0) {
      setError('Select at least one school/college.')
      return
    }
    if (!classStanding) {
      setError('Select your class standing.')
      return
    }
    if (!major.trim()) {
      setError('Enter your major.')
      return
    }
    if (!hasMinor) {
      setError('Let us know whether you have a minor or certificate.')
      return
    }
    if (hasMinor === 'yes' && !minor.trim()) {
      setError('Enter your minor or certificate.')
      return
    }

    setSubmitting(true)
    setError('')
    const response = await fetch('/api/profile/demographics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schools,
        classStanding,
        major: major.trim(),
        hasMinor: hasMinor === 'yes',
        minor: minor.trim(),
      }),
    })
    const result = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) {
      setError(result.error || 'This could not be saved. Please try again.')
      return
    }
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/70 p-4 py-10">
      <form onSubmit={submit} className="portal-modal w-full max-w-lg">
        <div className="portal-form-header">
          <div>
            <p className="portal-eyebrow">One-time survey</p>
            <h2>Tell us about your studies</h2>
            <p>We're collecting this once from every member. It only takes a minute, and you won't see this again.</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <span className="portal-label">School / college <span className="font-normal text-muted-foreground">(select all that apply)</span></span>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SCHOOLS.map((school) => (
                <label key={school} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                  <input type="checkbox" checked={schools.includes(school)} onChange={() => toggleSchool(school)} />
                  {school}
                </label>
              ))}
            </div>
          </div>

          <label>
            <span className="portal-label">Class standing</span>
            <select value={classStanding} onChange={(event) => setClassStanding(event.target.value)} className="portal-input w-full">
              <option value="">Select...</option>
              {CLASS_STANDINGS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="portal-label">Major</span>
            <input
              value={major}
              onChange={(event) => setMajor(event.target.value)}
              className="portal-input w-full"
              placeholder="e.g. Finance (or Finance and Economics if double majoring)"
            />
          </label>

          <div>
            <span className="portal-label">Do you have a minor or certificate?</span>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setHasMinor('yes')} className={hasMinor === 'yes' ? 'portal-button-secondary small' : 'portal-button-ghost small'}>Yes</button>
              <button type="button" onClick={() => setHasMinor('no')} className={hasMinor === 'no' ? 'portal-button-secondary small' : 'portal-button-ghost small'}>No</button>
            </div>
          </div>

          {hasMinor === 'yes' && (
            <label>
              <span className="portal-label">Which one(s)?</span>
              <input value={minor} onChange={(event) => setMinor(event.target.value)} className="portal-input w-full" placeholder="e.g. Analytics & Sports minor" />
            </label>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="portal-form-actions">
          <button disabled={submitting} className="portal-button w-full justify-center">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </button>
        </div>
      </form>
    </div>
  )
}
