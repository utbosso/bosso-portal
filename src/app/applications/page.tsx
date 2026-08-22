'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type {
  Application,
  ApplicationDocument,
  ApplicationStatus,
  Opportunity,
} from '@/types/database.types'
import {
  ClipboardCheck,
  ExternalLink,
  Link as LinkIcon,
  Paperclip,
  PlusCircle,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  Bookmark,
  CheckCircle2,
  X,
  Clock,
  BarChart3,
  Sparkles,
  FileText
} from 'lucide-react'
import SectionPageHeader from '@/components/SectionPageHeader'

const supabase = createClient()

type ApplicationFormState = {
  opportunityId: string
  title: string
  company: string
  link: string
  status: ApplicationStatus
}

const emptyForm: ApplicationFormState = {
  opportunityId: '',
  title: '',
  company: '',
  link: '',
  status: 'saved',
}

const statusLabels: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  not_applied: 'Not Applied',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
}

const statusColors: Record<ApplicationStatus, string> = {
  saved: 'badge-info',
  applied: 'badge-warning',
  not_applied: 'bg-muted text-muted-foreground border-border',
  interviewing: 'bg-primary/10 text-primary border-primary/30',
  offered: 'badge-success',
  rejected: 'badge-error',
  accepted: 'badge-success',
  withdrawn: 'bg-muted text-muted-foreground border-border',
}

const statusIcons: Record<ApplicationStatus, any> = {
  saved: Bookmark,
  applied: CheckCircle2,
  not_applied: FileText,
  interviewing: TrendingUp,
  offered: Sparkles,
  rejected: X,
  accepted: CheckCircle2,
  withdrawn: Clock,
}

export default function ApplicationsPage() {
  const { profile } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ApplicationFormState>(emptyForm)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [showAddDocModal, setShowAddDocModal] = useState(false)
  const [currentAppId, setCurrentAppId] = useState<string | null>(null)
  const [newDocument, setNewDocument] = useState({
    type: 'resume' as 'resume' | 'cover_letter' | 'portfolio' | 'other',
    name: '',
    url: '',
    notes: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')

  const documentsByApplication = useMemo(() => {
    const map = new Map<string, ApplicationDocument[]>()
    documents.forEach((doc) => {
      const list = map.get(doc.application_id) ?? []
      list.push(doc)
      map.set(doc.application_id, list)
    })
    return map
  }, [documents])

  const filteredApplications = useMemo(() => {
    let filtered = applications

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(app =>
        app.title.toLowerCase().includes(query) ||
        app.company?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter)
    }

    return filtered
  }, [applications, searchQuery, statusFilter])

  const statistics = useMemo(() => {
    const total = applications.length
    const saved = applications.filter(app => app.status === 'saved').length
    const applied = applications.filter(app => app.status === 'applied').length
    const interviewing = applications.filter(app => app.status === 'interviewing').length
    const active = applications.filter(app =>
      app.status === 'saved' || app.status === 'applied' || app.status === 'interviewing' || app.status === 'offered'
    ).length

    return { total, saved, applied, interviewing, active }
  }, [applications])

  const fetchApplications = async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = (data as Application[]) ?? []
      setApplications(rows)

      if (rows.length > 0) {
        const { data: docs, error: docError } = await supabase
          .from('application_documents')
          .select('*')
          .in('application_id', rows.map((row) => row.id))
          .order('created_at', { ascending: false })

        if (docError) throw docError
        setDocuments((docs as ApplicationDocument[]) ?? [])
      } else {
        setDocuments([])
      }
    } catch (err: any) {
      console.error('Error loading applications', err)
      setError('Failed to load applications.')
    } finally {
      setLoading(false)
    }
  }

  const fetchOpportunities = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, title, company, link')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading opportunities', error)
      return
    }

    setOpportunities((data as Opportunity[]) ?? [])
  }

  useEffect(() => {
    fetchApplications()
    fetchOpportunities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (app: Application) => {
    setEditingId(app.id)
    setForm({
      opportunityId: app.opportunity_id ?? '',
      title: app.title,
      company: app.company ?? '',
      link: app.link ?? '',
      status: app.status,
    })
    setFormOpen(true)
  }

  const closeApplicationForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleOpportunitySelect = (id: string) => {
    const found = opportunities.find((item) => item.id === id)
    if (!found) {
      setForm((prev) => ({ ...prev, opportunityId: id }))
      return
    }
    setForm((prev) => ({
      ...prev,
      opportunityId: id,
      title: found.title,
      company: found.company ?? '',
      link: found.link ?? '',
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setError(null)

    const payload = {
      user_id: profile.id,
      opportunity_id: form.opportunityId || null,
      title: form.title,
      company: form.company || null,
      link: form.link || null,
      status: form.status,
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('applications')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('applications')
          .insert(payload)
        if (error) throw error
      }

      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchApplications()
    } catch (err: any) {
      console.error('Error saving application', err)
      setError('Failed to save application.')
    }
  }

  const handleDelete = async (appId: string) => {
    const confirmDelete = window.confirm('Delete this application?')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', appId)
      if (error) throw error
      await fetchApplications()
    } catch (err: any) {
      console.error('Error deleting application', err)
      setError('Failed to delete application.')
    }
  }

  const handleStatusChange = async (appId: string, status: ApplicationStatus) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', appId)
      if (error) throw error
      await fetchApplications()
    } catch (err: any) {
      console.error('Error updating status', err)
      setError('Failed to update application status.')
    }
  }

  const handleAddDocument = async () => {
    if (!profile || !currentAppId) return

    // Validate URL
    if (!newDocument.url) {
      setError('Please enter a document URL')
      return
    }

    // Basic URL validation
    try {
      new URL(newDocument.url)
    } catch {
      setError('Please enter a valid URL (e.g., https://drive.google.com/...)')
      return
    }

    setUploadingId(currentAppId)
    setError(null)

    try {
      const payload = {
        application_id: currentAppId,
        user_id: profile.id,
        document_type: newDocument.type,
        document_name: newDocument.name || `${newDocument.type.replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
        document_url: newDocument.url,
        notes: newDocument.notes || null,
      }

      const { error } = await supabase
        .from('application_documents')
        .insert(payload)
      if (error) throw error

      await fetchApplications()

      // Reset form
      setNewDocument({
        type: 'resume',
        name: '',
        url: '',
        notes: ''
      })
      setShowAddDocModal(false)
      setCurrentAppId(null)
    } catch (err: any) {
      console.error('Error adding document', err)
      setError('Failed to add document.')
    } finally {
      setUploadingId(null)
    }
  }

  const handleOpenDoc = (doc: ApplicationDocument) => {
    // Simply open the external link in a new tab
    window.open(doc.document_url, '_blank')
  }

  const handleDeleteDoc = async (doc: ApplicationDocument) => {
    const confirmDelete = window.confirm(`Delete "${doc.document_name}"?`)
    if (!confirmDelete) return

    try {
      // Only delete from database (no storage to delete from)
      const { error: dbError } = await supabase
        .from('application_documents')
        .delete()
        .eq('id', doc.id)

      if (dbError) throw dbError

      await fetchApplications()
    } catch (err: any) {
      console.error('Error deleting document', err)
      setError('Failed to delete document.')
    }
  }

  if (!profile) return null

  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Career"
        title="My applications"
        description="Track every opportunity from saved lead through interview and offer, with your working documents close by."
        icon={ClipboardCheck}
        actions={<button
          type="button"
          onClick={openCreate}
          className="portal-button"
        >
          <PlusCircle className="w-4 h-4" />
          Add application
        </button>}
      />

      {error && (
        <div className="portal-alert-error">{error}</div>
      )}

      {/* Statistics */}
      {!loading && applications.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <div className="portal-stat-card min-h-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{statistics.total}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="portal-stat-card min-h-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saved</p>
                <p className="text-2xl font-bold text-foreground">{statistics.saved}</p>
              </div>
              <Bookmark className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="portal-stat-card min-h-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applied</p>
                <p className="text-2xl font-bold text-foreground">{statistics.applied}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="portal-stat-card min-h-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interviewing</p>
                <p className="text-2xl font-bold text-foreground">{statistics.interviewing}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Search and status */}
      {!loading && applications.length > 0 && (
        <div className="portal-panel space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="portal-input w-full pl-10"
              />
            </div>
          </div>

          <label className="sm:hidden">
            <span className="portal-label">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus | 'all')}
              className="portal-input w-full"
            >
              <option value="all">All statuses</option>
              {(['saved', 'applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn'] as const).map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>

          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status:</span>
            {(['all', 'saved', 'applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn'] as const).map(status => {
              const StatusIcon = status !== 'all' ? statusIcons[status] : Filter
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {status === 'all' ? 'All' : statusLabels[status]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Form */}
      {formOpen && (
        <div className="portal-modal-backdrop" onMouseDown={closeApplicationForm}>
          <div className="portal-modal max-w-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="portal-form-header"><div><p className="portal-eyebrow">Application pipeline</p><h2>{editingId ? 'Edit application' : 'Track an application'}</h2><p>Start from a saved opportunity or enter the role manually.</p></div><button type="button" onClick={closeApplicationForm} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSave} className="space-y-5">
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>1</span><div><h3>Role</h3><p>Selecting an opportunity fills in the details for you.</p></div></div>
                <div className="space-y-4">
                  <label><span className="portal-label">From opportunities <span className="font-normal text-muted-foreground">(optional)</span></span><select value={form.opportunityId} onChange={(e) => handleOpportunitySelect(e.target.value)} className="portal-input w-full"><option value="">Enter a role manually</option>{opportunities.map((item) => <option key={item.id} value={item.id}>{item.title} {item.company ? `— ${item.company}` : ''}</option>)}</select></label>
                  <div className="grid gap-4 sm:grid-cols-2"><label><span className="portal-label">Position title</span><input type="text" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required className="portal-input w-full" placeholder="Business analyst intern" /></label><label><span className="portal-label">Company <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={form.company} onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))} className="portal-input w-full" placeholder="Company name" /></label></div>
                  <label><span className="portal-label">Job posting <span className="font-normal text-muted-foreground">(optional)</span></span><input type="url" value={form.link} onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))} className="portal-input w-full" placeholder="https://…" /></label>
                </div>
              </section>
              <section className="portal-form-section"><div className="portal-form-section-heading"><span>2</span><div><h3>Pipeline status</h3><p>You can update this quickly from the application card later.</p></div></div><label><span className="portal-label">Current stage</span><select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ApplicationStatus }))} className="portal-input w-full">{Object.keys(statusLabels).map((status) => <option key={status} value={status}>{statusLabels[status as ApplicationStatus]}</option>)}</select></label></section>
              <div className="portal-form-actions"><button type="button" onClick={closeApplicationForm} className="portal-button-secondary justify-center">Cancel</button><button type="submit" className="portal-button justify-center"><ClipboardCheck className="h-4 w-4" /> {editingId ? 'Save changes' : 'Add to pipeline'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="portal-loading flex-col">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading applications...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && applications.length === 0 && (
        <div className="portal-empty">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No applications yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start tracking your applications by adding one manually or saving opportunities from the Opportunities page.
          </p>
          <button
            onClick={openCreate}
            className="portal-button mt-5"
          >
            <PlusCircle className="w-4 h-4" />
            Add Your First Application
          </button>
        </div>
      )}

      {/* Applications List */}
      {!loading && filteredApplications.length > 0 && (
        <div className="space-y-4">
          {filteredApplications.map((app) => {
            const StatusIcon = statusIcons[app.status]
            return (
              <article key={app.id} className="portal-panel space-y-4">
                {/* Title, status, and actions */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <StatusIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base sm:text-lg font-semibold text-foreground break-words">{app.title}</h2>
                      {app.company && (
                        <p className="text-sm text-muted-foreground mt-0.5">{app.company}</p>
                      )}
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[app.status]}`}>
                          {statusLabels[app.status]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end w-full sm:w-auto">
                    {app.link && (
                      <a
                        href={app.link}
                        target="_blank"
                        rel="noreferrer"
                        className="portal-button-secondary small flex-1 justify-center sm:flex-none"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View</span>
                      </a>
                    )}
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                      className="portal-input min-w-[140px] flex-1 text-sm sm:min-w-[160px] sm:flex-none"
                    >
                      {Object.keys(statusLabels).map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status as ApplicationStatus]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openEdit(app)}
                      className="portal-button-secondary small min-w-[110px] flex-1 justify-center sm:flex-none"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(app.id)}
                      className="portal-button-secondary small min-w-[110px] flex-1 justify-center text-destructive hover:text-destructive sm:flex-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Paperclip className="w-4 h-4 text-primary" />
                      Documents
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentAppId(app.id)
                        setShowAddDocModal(true)
                      }}
                      className="portal-button-secondary small"
                    >
                      <Plus className="w-4 h-4" />
                      Add Link
                    </button>
                  </div>

                  {(documentsByApplication.get(app.id) ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents added yet. Add links to your resume, cover letter, etc.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(documentsByApplication.get(app.id) ?? []).map((doc) => (
                        <div
                          key={doc.id}
                          className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenDoc(doc)}
                            className="flex items-center gap-2 flex-1 min-w-0 hover:text-primary transition text-left"
                          >
                            <LinkIcon className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-foreground">{doc.document_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{doc.document_type?.replace('_', ' ')}</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="portal-icon-button border-0 text-destructive hover:text-destructive"
                            title="Delete document"
                            aria-label={`Delete ${doc.document_name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Added {new Date(app.created_at || '').toLocaleDateString()}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* No Results */}
      {!loading && applications.length > 0 && filteredApplications.length === 0 && (
        <div className="portal-empty">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No applications match your search or status</p>
        </div>
      )}

      {/* Add Document Link Modal */}
      {showAddDocModal && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal max-w-lg">
            <div className="portal-form-header">
              <div><p className="portal-eyebrow">Application materials</p><h2>Add a document link</h2><p>Keep the resume, cover letter, or portfolio used for this application close by.</p></div>
              <button
                onClick={() => {
                  setShowAddDocModal(false)
                  setCurrentAppId(null)
                  setNewDocument({
                    type: 'resume',
                    name: '',
                    url: '',
                    notes: ''
                  })
                }}
                className="portal-icon-button"
                aria-label="Close document form"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Document Type</label>
                <select
                  value={newDocument.type}
                  onChange={(e) => setNewDocument({ ...newDocument, type: e.target.value as any })}
                  className="portal-input w-full bg-dark-100"
                >
                  <option value="resume">Resume</option>
                  <option value="cover_letter">Cover Letter</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Document Name (Optional)</label>
                <input
                  type="text"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                  placeholder="e.g., Resume - Updated Jan 2025"
                  className="portal-input w-full bg-dark-100"
                />
                <p className="text-xs text-muted-foreground">Leave blank to auto-generate</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Document URL</label>
                <input
                  type="url"
                  value={newDocument.url}
                  onChange={(e) => setNewDocument({ ...newDocument, url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                  className="portal-input w-full bg-dark-100"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste a link from Google Drive, Dropbox, OneDrive, etc.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes (Optional)</label>
                <textarea
                  value={newDocument.notes}
                  onChange={(e) => setNewDocument({ ...newDocument, notes: e.target.value })}
                  placeholder="Any additional notes about this document..."
                  rows={3}
                  className="portal-input w-full resize-none bg-dark-100"
                />
              </div>
            </div>

            <div className="portal-form-actions">
              <button
                onClick={() => {
                  setShowAddDocModal(false)
                  setCurrentAppId(null)
                  setNewDocument({
                    type: 'resume',
                    name: '',
                    url: '',
                    notes: ''
                  })
                }}
                className="portal-button-secondary justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocument}
                disabled={!newDocument.url || uploadingId !== null}
                className="portal-button justify-center"
              >
                {uploadingId ? 'Adding...' : 'Add document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
