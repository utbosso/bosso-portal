'use client'

import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import { createClient } from '@/lib/supabase/client'
import { FeedbackSubmission, FeedbackCategory, FeedbackStatus } from '@/types/database.types'
import { useState, useEffect } from 'react'
import {
  MessageSquare,
  PlusCircle,
  Search,
  Filter,
  Star,
  CheckCircle,
  Clock,
  Archive,
  Eye,
  Download,
  X,
  AlertCircle,
  Sparkles,
  Calendar,
  Globe,
  Lightbulb,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import SectionPageHeader from '@/components/SectionPageHeader'

const supabase = createClient()

export default function FeedbackPage() {
  const { user, profile, hasMinimumRole } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id)
  const [feedbackList, setFeedbackList] = useState<FeedbackSubmission[]>([])
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    category: 'general' as FeedbackCategory,
    event_name: '',
    subject: '',
    feedback: '',
    rating: null as number | null,
    is_anonymous: false,
  })

  const isAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  useEffect(() => {
    fetchFeedback()
  }, [profile?.role, access?.term_id, schemaReady, accessLoading])

  useEffect(() => {
    filterFeedback()
  }, [feedbackList, searchQuery, selectedCategory, selectedStatus])

  const fetchFeedback = async () => {
    if (accessLoading) return
    setLoading(true)
    setError(null)
    try {
      let feedbackQuery: any = supabase
        .from('feedback_submissions')
        .select(`
          *,
          submitter:profiles!feedback_submissions_submitted_by_fkey(id, full_name, email)
        `)
      if (schemaReady && access?.term_id) {
        feedbackQuery = feedbackQuery.eq('term_id', access.term_id).is('archived_at', null)
      }
      const { data, error: fetchError } = await feedbackQuery.order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Board members see all, regular users see only their own
      const visibleFeedback = isAdmin
        ? (data || [])
        : (data || []).filter((f: any) => f.submitted_by === profile?.id)

      setFeedbackList(visibleFeedback)
    } catch (err) {
      console.error('Error fetching feedback:', err)
      setError('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const filterFeedback = () => {
    let filtered = [...feedbackList]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(fb =>
        fb.subject.toLowerCase().includes(query) ||
        fb.feedback.toLowerCase().includes(query) ||
        fb.event_name?.toLowerCase().includes(query)
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(fb => fb.category === selectedCategory)
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(fb => fb.status === selectedStatus)
    }

    setFilteredFeedback(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setError(null)
    setSuccess(null)

    try {
      const payload = {
        category: formData.category,
        event_name: formData.event_name || null,
        subject: formData.subject,
        feedback: formData.feedback,
        rating: formData.rating,
        is_anonymous: formData.is_anonymous,
        submitted_by: formData.is_anonymous ? null : profile.id,
        status: 'new' as FeedbackStatus,
        admin_notes: null,
        ...(schemaReady && access?.term_id ? { term_id: access.term_id, archived_at: null } : {}),
      }

      const { error: insertError } = await supabase
        .from('feedback_submissions')
        .insert([payload])

      if (insertError) throw insertError

      setSuccess('Feedback submitted successfully! Thank you for helping us improve.')
      setShowForm(false)
      resetForm()
      await fetchFeedback()

      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Error submitting feedback:', err)
      setError('Failed to submit feedback')
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: FeedbackStatus) => {
    if (!isAdmin) return

    try {
      const { error: updateError } = await supabase
        .from('feedback_submissions')
        .update({ status: newStatus })
        .eq('id', id)

      if (updateError) throw updateError
      await fetchFeedback()
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update status')
    }
  }

  const handleAddAdminNotes = async (id: string, notes: string) => {
    if (!isAdmin) return

    try {
      const { error: updateError } = await supabase
        .from('feedback_submissions')
        .update({ admin_notes: notes })
        .eq('id', id)

      if (updateError) throw updateError
      await fetchFeedback()
    } catch (err) {
      console.error('Error updating notes:', err)
      setError('Failed to update notes')
    }
  }

  const exportToCSV = () => {
    if (!isAdmin) return

    const headers = ['Date', 'Category', 'Event', 'Subject', 'Feedback', 'Rating', 'Submitted By', 'Status', 'Admin Notes']
    const rows = filteredFeedback.map(fb => [
      new Date(fb.created_at || '').toLocaleDateString(),
      fb.category,
      fb.event_name || '',
      fb.subject,
      fb.feedback.replace(/"/g, '""'), // Escape quotes
      fb.rating || '',
      fb.is_anonymous ? 'Anonymous' : (fb.submitter?.full_name || ''),
      fb.status,
      fb.admin_notes?.replace(/"/g, '""') || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setFormData({
      category: 'general',
      event_name: '',
      subject: '',
      feedback: '',
      rating: null,
      is_anonymous: false,
    })
  }

  const handleCancelForm = () => {
    setShowForm(false)
    resetForm()
    setError(null)
  }

  const getCategoryIcon = (category: FeedbackCategory) => {
    switch (category) {
      case 'event':
        return <Calendar className="w-4 h-4" />
      case 'portal':
        return <Globe className="w-4 h-4" />
      case 'suggestion':
        return <Lightbulb className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const getCategoryLabel = (category: FeedbackCategory) => {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  const getStatusLabel = (status: FeedbackStatus) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'reviewed':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'in_progress':
        return 'bg-primary/20 text-primary border-primary/30'
      case 'resolved':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'archived':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-muted/20 text-muted-foreground border-muted/30'
    }
  }

  if (!profile) return null

  const categories: (FeedbackCategory | 'all')[] = ['all', 'event', 'portal', 'general', 'suggestion', 'other']
  const statuses: (FeedbackStatus | 'all')[] = ['all', 'new', 'reviewed', 'in_progress', 'resolved', 'archived']

  return (
    <div className="portal-page max-w-7xl space-y-6">
      <SectionPageHeader
        eyebrow="Member tools"
        title="Feedback"
        description="Share ideas, event feedback, and concerns with the BOSSO team. Anonymous submissions stay anonymous."
        icon={MessageSquare}
        actions={<>
          {isAdmin && filteredFeedback.length > 0 && (
            <button
              onClick={exportToCSV}
              className="portal-button-secondary"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="portal-button"
          >
            <PlusCircle className="w-4 h-4" />
            Submit Feedback
          </button>
        </>}
      />

      {error && (
        <div className="portal-alert-error flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="portal-alert-success flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Search and Filters */}
      {(isAdmin || feedbackList.length > 0) && (
        <div className="portal-panel space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="portal-input w-full pl-10"
              />
            </div>
          </div>

          {/* Desktop filters */}
          <div className="hidden md:flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Category:</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-primary text-dark-300'
                    : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
                }`}
              >
                {cat !== 'all' && getCategoryIcon(cat)}
                {cat === 'all' ? 'All' : getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="hidden md:flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Status:</span>
              {statuses.map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedStatus === status
                      ? 'bg-primary text-dark-300'
                      : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
                  }`}
                >
                  {status === 'all' ? 'All' : getStatusLabel(status)}
                </button>
              ))}
            </div>
          )}

          {/* Mobile dropdowns */}
          <div className={`grid gap-3 md:hidden ${isAdmin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="portal-input w-full"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All' : getCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="portal-input w-full"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'All' : getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Form */}
      {showForm && (
        <div className="portal-modal-backdrop" onMouseDown={handleCancelForm}>
          <div className="portal-modal max-w-3xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="portal-form-header">
            <div><p className="portal-eyebrow">Member feedback</p><h2>Submit feedback</h2><p>Give enough context for the team to understand and act on your submission.</p></div>
            <button
              onClick={handleCancelForm}
              className="portal-icon-button"
              aria-label="Close feedback form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="portal-form-section">
              <div className="portal-form-section-heading"><span>1</span><div><h3>Context</h3><p>Tell the team what your feedback is about and optionally add a rating.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="portal-label">Category</span>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as FeedbackCategory })}
                    className="portal-input w-full"
                    required
                  >
                    <option value="event">Event feedback</option>
                    <option value="portal">Portal feedback</option>
                    <option value="general">General feedback</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                {formData.category === 'event' && (
                  <label>
                    <span className="portal-label">Event name</span>
                    <input
                      type="text"
                      value={formData.event_name}
                      onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                      className="portal-input w-full"
                      placeholder="Example: Speaker Series"
                    />
                  </label>
                )}

                <div className="sm:col-span-2">
                  <p className="portal-label">Rating <span className="font-normal text-muted-foreground">(optional)</span></p>
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating })}
                        aria-label={`${rating} out of 5 stars`}
                        aria-pressed={formData.rating === rating}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                          formData.rating && formData.rating >= rating
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
                        }`}
                      >
                        <Star className={`h-5 w-5 ${formData.rating && formData.rating >= rating ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                    {formData.rating && (
                      <button type="button" onClick={() => setFormData({ ...formData, rating: null })} className="portal-button-ghost small">Clear rating</button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="portal-form-section">
              <div className="portal-form-section-heading"><span>2</span><div><h3>Your feedback</h3><p>Lead with a short summary, then include the details the team needs.</p></div></div>
              <div className="space-y-4">
                <label><span className="portal-label">Subject</span><input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="portal-input w-full" placeholder="Brief summary of your feedback" required /></label>
                <label><span className="portal-label">Details</span><textarea value={formData.feedback} onChange={(e) => setFormData({ ...formData, feedback: e.target.value })} className="portal-input w-full resize-none" rows={6} placeholder="Share what happened, what worked, or what you would change." required /></label>
              </div>
            </section>

            <section className="portal-form-section">
              <div className="portal-form-section-heading"><span>3</span><div><h3>Privacy</h3><p>Choose whether your name should be attached to this submission.</p></div></div>
              <label className={`portal-choice-card ${formData.is_anonymous ? 'selected' : ''}`}>
                <input type="checkbox" id="anonymous" checked={formData.is_anonymous} onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 rounded border-primary/30 text-primary focus:ring-primary" />
                <span><strong className="block text-sm">Submit anonymously</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Your identity will not be shown with the feedback entry.</span></span>
              </label>
            </section>

            <div className="portal-form-actions">
              <button
                type="button"
                onClick={handleCancelForm}
                className="portal-button-secondary justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="portal-button justify-center"
              >
                Submit Feedback
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Feedback List */}
      {loading ? (
        <div className="portal-loading flex-col">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading feedback...</p>
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="portal-empty">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? 'No feedback matches your filters'
              : 'No feedback submissions yet. Be the first to share your thoughts!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((fb) => (
            <div key={fb.id} className="portal-panel space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1 text-primary">
                    {getCategoryIcon(fb.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground">{fb.subject}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(fb.status)}`}>
                        {getStatusLabel(fb.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{getCategoryLabel(fb.category)}</span>
                      {fb.event_name && (
                        <>
                          <span>•</span>
                          <span>{fb.event_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(fb.created_at || '').toLocaleDateString()}</span>
                      {fb.rating && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current text-primary" />
                            <span>{fb.rating}/5</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedFeedback(expandedFeedback === fb.id ? null : fb.id)}
                  className="portal-icon-button border-0"
                  aria-label={expandedFeedback === fb.id ? 'Collapse feedback' : 'Expand feedback'}
                >
                  {expandedFeedback === fb.id ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>
              </div>

              {expandedFeedback === fb.id && (
                <div className="space-y-3 pt-3 border-t border-dark-200">
                  <div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{fb.feedback}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Submitted by: {fb.is_anonymous ? 'Anonymous' : (fb.submitter?.full_name || 'Unknown')}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="space-y-3 pt-3 border-t border-dark-200">
                      <div>
                        <label className="block text-sm font-medium mb-2">Admin Notes</label>
                        <textarea
                          defaultValue={fb.admin_notes || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (fb.admin_notes || '')) {
                              handleAddAdminNotes(fb.id, e.target.value)
                            }
                          }}
                          className="input-neon w-full"
                          rows={2}
                          placeholder="Internal notes (only visible to board members)..."
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Update Status:</span>
                        {(['new', 'reviewed', 'in_progress', 'resolved', 'archived'] as FeedbackStatus[]).map(status => (
                          <button
                            key={status}
                            onClick={() => handleUpdateStatus(fb.id, status)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                              fb.status === status
                                ? getStatusColor(status)
                                : 'bg-dark-200 text-muted-foreground border-dark-100 hover:bg-dark-100'
                            }`}
                          >
                            {getStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
