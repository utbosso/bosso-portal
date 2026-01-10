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
  saved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  applied: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  not_applied: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  interviewing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  offered: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  withdrawn: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Applications
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
        >
          <PlusCircle className="w-4 h-4" />
          Add Application
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Statistics */}
      {!loading && applications.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card-glow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{statistics.total}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="card-glow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saved</p>
                <p className="text-2xl font-bold text-blue-400">{statistics.saved}</p>
              </div>
              <Bookmark className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="card-glow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applied</p>
                <p className="text-2xl font-bold text-yellow-400">{statistics.applied}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          <div className="card-glow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interviewing</p>
                <p className="text-2xl font-bold text-purple-400">{statistics.interviewing}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      {!loading && applications.length > 0 && (
        <div className="card-glow p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-neon w-full pl-10"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status:</span>
            {(['all', 'saved', 'applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn'] as const).map(status => {
              const StatusIcon = status !== 'all' ? statusIcons[status] : Filter
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                    statusFilter === status
                      ? 'bg-primary text-dark-300'
                      : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
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
        <div className="card-glow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gradient">
              {editingId ? 'Edit Application' : 'New Application'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
              className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-dark-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">From Opportunities (Optional)</label>
              <select
                value={form.opportunityId}
                onChange={(e) => handleOpportunitySelect(e.target.value)}
                className="input-neon w-full"
              >
                <option value="">Select an opportunity or add manually</option>
                {opportunities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} {item.company ? `— ${item.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  className="input-neon w-full"
                  placeholder="Position title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                  className="input-neon w-full"
                  placeholder="Company name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Link</label>
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
                className="input-neon w-full"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ApplicationStatus }))}
                className="input-neon w-full"
              >
                {Object.keys(statusLabels).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status as ApplicationStatus]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
              >
                {editingId ? 'Save Changes' : 'Add Application'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setEditingId(null)
                  setForm(emptyForm)
                }}
                className="px-4 py-2 rounded-lg bg-dark-200 text-foreground text-sm font-medium hover:bg-dark-100 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading applications...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && applications.length === 0 && (
        <div className="card-glow p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No applications yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start tracking your applications by adding one manually or saving opportunities from the Opportunities page.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
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
              <div key={app.id} className="card-glow p-4 sm:p-5 space-y-4">
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
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dark-200 hover:bg-dark-100 text-sm text-primary transition flex-1 sm:flex-none"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View</span>
                      </a>
                    )}
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                      className="input-neon text-sm px-3 py-2 flex-1 sm:flex-none min-w-[140px] sm:min-w-[160px]"
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
                      className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-dark-200 hover:bg-dark-100 text-primary transition inline-flex items-center justify-center gap-2 text-sm min-w-[110px]"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(app.id)}
                      className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-dark-200 hover:bg-red-500/10 text-red-400 transition inline-flex items-center justify-center gap-2 text-sm min-w-[110px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="rounded-lg border border-primary/10 p-4 space-y-3 bg-dark-300/50">
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
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/30 text-sm text-primary hover:bg-primary/10 transition"
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
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-dark-200 text-sm group"
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
                            className="p-1 hover:bg-red-500/10 rounded text-red-400 hover:text-red-300 transition flex-shrink-0"
                            title="Delete document"
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
              </div>
            )
          })}
        </div>
      )}

      {/* No Results */}
      {!loading && applications.length > 0 && filteredApplications.length === 0 && (
        <div className="card-glow p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No applications match your filters</p>
        </div>
      )}

      {/* Add Document Link Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card-glow p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">Add Document Link</h3>
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
                className="p-1 hover:bg-dark-100 rounded transition"
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
                  className="w-full px-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                  className="w-full px-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                  className="w-full px-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                  className="w-full px-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddDocument}
                disabled={!newDocument.url || uploadingId !== null}
                className="flex-1 btn-neon py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingId ? 'Adding...' : 'Add Document'}
              </button>
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
                className="px-6 py-2 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
