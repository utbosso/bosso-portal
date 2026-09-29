'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, Mail, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import SendEmailModal, { type SendEmailRequest, type NewsletterStoryInput } from '@/components/SendEmailModal'

const ADMIN_EMAIL = 'internal@txbosso.com'

const emptyStory: NewsletterStoryInput = { tag: '', headline: '', byline: '', body: '', imageUrl: '' }

export default function AdminNewsletterPage() {
  const { user } = useAuth()
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  const [subscriberCount, setSubscriberCount] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [lead, setLead] = useState('')
  const [stories, setStories] = useState<NewsletterStoryInput[]>([{ ...emptyStory }])
  const [emailRequest, setEmailRequest] = useState<SendEmailRequest | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedFrom, setImportedFrom] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/newsletter-subscribers')
      .then((response) => response.json())
      .then((payload) => setSubscriberCount(typeof payload.count === 'number' ? payload.count : null))
      .catch(() => setSubscriberCount(null))
  }, [isAdmin])

  const updateStory = (index: number, field: keyof NewsletterStoryInput, value: string) => {
    setStories((prev) => prev.map((story, i) => (i === index ? { ...story, [field]: value } : story)))
  }

  const addStory = () => setStories((prev) => [...prev, { ...emptyStory }])
  const removeStory = (index: number) => setStories((prev) => prev.filter((_, i) => i !== index))

  const importFromUrl = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError('')
    try {
      const response = await fetch('/api/admin/newsletter-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'That page could not be imported.')

      setTitle(payload.title || '')
      setDate(payload.date || '')
      setLead(payload.lead || '')
      setStories(
        (payload.stories || []).map((story: NewsletterStoryInput) => ({
          tag: story.tag || '',
          headline: story.headline || '',
          byline: story.byline || '',
          body: story.body || '',
          imageUrl: story.imageUrl || '',
        }))
      )
      setImportedFrom(importUrl.trim())
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'That page could not be imported.')
    } finally {
      setImporting(false)
    }
  }

  const canSend = title.trim().length > 0 && stories.some((story) => story.headline.trim() && story.body.trim())

  const openSend = () => {
    setEmailRequest({
      kind: 'newsletter',
      title: title.trim(),
      date: date.trim(),
      lead: lead.trim() || undefined,
      stories: stories
        .filter((story) => story.headline.trim() && story.body.trim())
        .map((story) => ({
          tag: story.tag?.trim() || undefined,
          headline: story.headline.trim(),
          byline: story.byline?.trim() || undefined,
          body: story.body.trim(),
          imageUrl: story.imageUrl?.trim() || undefined,
        })),
    })
  }

  if (!isAdmin) {
    return (
      <div className="portal-page">
        <div className="portal-empty">
          <ShieldCheck className="h-8 w-8" />
          <h1>Administrator access only</h1>
          <p>Sending the newsletter is restricted to {ADMIN_EMAIL}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-page space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Admin dashboard
          </Link>
          <p className="portal-eyebrow">Communications</p>
          <h1 className="portal-title">Newsletter</h1>
        </div>
        <div className="portal-stat-card">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-5 text-sm text-muted-foreground">Active subscribers</p>
          <p className="mt-1 text-xl font-semibold">{subscriberCount === null ? '—' : subscriberCount}</p>
        </div>
      </header>

      <section className="portal-panel space-y-4">
        <div>
          <p className="portal-label">Import from the website</p>
          <p className="text-sm text-muted-foreground">
            Paste the live newsletter issue URL and everything below fills in automatically.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            className="portal-input w-full"
            placeholder="https://txbosso.com/pages/newsletters/newsletter_issue_5.html"
          />
          <button onClick={importFromUrl} disabled={importing || !importUrl.trim()} className="portal-button-secondary whitespace-nowrap">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
        {importError && <div className="portal-alert-error">{importError}</div>}
        {importedFrom && !importError && (
          <p className="text-sm text-muted-foreground">Imported {stories.length} stor{stories.length === 1 ? 'y' : 'ies'} from {importedFrom}.</p>
        )}
      </section>

      <section className="portal-panel space-y-5">
        <label>
          <span className="portal-label">Issue title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="portal-input w-full"
            placeholder="Welcome Back, BOSSO!"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span className="portal-label">Date <span className="font-normal text-muted-foreground">(optional, defaults to today)</span></span>
            <input
              type="text"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="portal-input w-full"
              placeholder="September 29, 2026"
            />
          </label>
        </div>

        <label>
          <span className="portal-label">Lead paragraph <span className="font-normal text-muted-foreground">(optional)</span></span>
          <textarea
            value={lead}
            onChange={(event) => setLead(event.target.value)}
            rows={2}
            className="portal-input w-full"
            placeholder="One or two sentences summarizing the issue."
          />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stories</h2>
          <button onClick={addStory} className="portal-button-secondary small">
            <Plus className="h-4 w-4" /> Add story
          </button>
        </div>

        {stories.map((story, index) => (
          <div key={index} className="portal-panel space-y-4">
            <div className="flex items-center justify-between">
              <p className="portal-label">Story {index + 1}</p>
              {stories.length > 1 && (
                <button onClick={() => removeStory(index)} className="portal-button-ghost small text-destructive">
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="portal-label">Category tag <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input
                  type="text"
                  value={story.tag}
                  onChange={(event) => updateStory(index, 'tag', event.target.value)}
                  className="portal-input w-full"
                  placeholder="NFL"
                />
              </label>
              <label>
                <span className="portal-label">Byline <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input
                  type="text"
                  value={story.byline}
                  onChange={(event) => updateStory(index, 'byline', event.target.value)}
                  className="portal-input w-full"
                  placeholder="By Jane Doe"
                />
              </label>
            </div>

            <label>
              <span className="portal-label">Headline</span>
              <input
                type="text"
                value={story.headline}
                onChange={(event) => updateStory(index, 'headline', event.target.value)}
                className="portal-input w-full"
                placeholder="Story headline"
              />
            </label>

            <label>
              <span className="portal-label">Body <span className="font-normal text-muted-foreground">(separate paragraphs with a blank line)</span></span>
              <textarea
                value={story.body}
                onChange={(event) => updateStory(index, 'body', event.target.value)}
                rows={6}
                className="portal-input w-full"
                placeholder={'First paragraph.\n\nSecond paragraph.'}
              />
            </label>

            <label>
              <span className="portal-label">Image URL <span className="font-normal text-muted-foreground">(optional, must be a full https:// link)</span></span>
              <input
                type="text"
                value={story.imageUrl}
                onChange={(event) => updateStory(index, 'imageUrl', event.target.value)}
                className="portal-input w-full"
                placeholder="https://txbosso.com/assets/images/newsletters/..."
              />
            </label>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <button onClick={openSend} disabled={!canSend} className="portal-button">
          <Mail className="h-4 w-4" /> Preview &amp; send
        </button>
      </div>

      <SendEmailModal request={emailRequest} onClose={() => setEmailRequest(null)} />
    </div>
  )
}
