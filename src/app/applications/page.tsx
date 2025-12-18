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
  FileText,
  Link as LinkIcon,
  Paperclip,
  PlusCircle,
  Pencil,
  Trash2,
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
  not_applied: 'Not applied',
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

  const documentsByApplication = useMemo(() => {
    const map = new Map<string, ApplicationDocument[]>()
    documents.forEach((doc) => {
      const list = map.get(doc.application_id) ?? []
      list.push(doc)
      map.set(doc.application_id, list)
    })
    return map
  }, [documents])

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
          .order('uploaded_at', { ascending: false })

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

  const handleUpload = async (appId: string, file: File) => {
    if (!profile) return
    setUploadingId(appId)
    setError(null)

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${profile.id}/${appId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase
        .storage
        .from('applications')
        .upload(path, file)

      if (uploadError) throw uploadError

      const payload = {
        application_id: appId,
        file_path: path,
        file_name: file.name,
        uploaded_by: profile.id,
      }

      const { error } = await supabase
        .from('application_documents')
        .insert(payload)
      if (error) throw error

      await fetchApplications()
    } catch (err: any) {
      console.error('Error uploading document', err)
      setError('Failed to upload document.')
    } finally {
      setUploadingId(null)
    }
  }

  const handleOpenDoc = async (doc: ApplicationDocument) => {
    const { data, error } = await supabase
      .storage
      .from('applications')
      .createSignedUrl(doc.file_path, 60 * 60)

    if (error) {
      console.error('Error creating signed URL', error)
      setError('Failed to open document.')
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            My Applications
          </h1>
          <p className="text-muted-foreground text-sm">
            Track internships and job applications, upload documents, and keep status up to date.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
        >
          <PlusCircle className="w-4 h-4" />
          Add application
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading applications...</p>}

      {formOpen && (
        <div className="card-glow p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {editingId ? 'Edit application' : 'New application'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
              className="p-2 text-muted-foreground hover:text-primary"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">From opportunities</label>
              <select
                value={form.opportunityId}
                onChange={(e) => handleOpportunitySelect(e.target.value)}
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
              >
                <option value="">Select an opportunity (optional)</option>
                {opportunities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} {item.company ? `— ${item.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Link</label>
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ApplicationStatus }))}
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
              >
                {Object.keys(statusLabels).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status as ApplicationStatus]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
            >
              {editingId ? 'Save changes' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {!loading && applications.length === 0 && (
        <div className="card-glow p-4 text-sm text-muted-foreground">
          No applications yet.
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="card-glow p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{app.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {app.company && <span>{app.company}</span>}
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[10px]">
                      {statusLabels[app.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {app.link && (
                    <a
                      href={app.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </a>
                  )}
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                    className="px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-xs text-foreground"
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
                    className="p-2 rounded-md text-primary hover:bg-primary/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(app.id)}
                    className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-primary/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Paperclip className="w-4 h-4 text-primary" />
                  Documents
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-sm text-primary hover:bg-primary/10 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleUpload(app.id, file)
                        }
                      }}
                    />
                    <FileText className="w-4 h-4" />
                    {uploadingId === app.id ? 'Uploading...' : 'Upload'}
                  </label>
                  <span className="text-xs text-muted-foreground">Resume, cover letter, etc.</span>
                </div>

                {(documentsByApplication.get(app.id) ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}

                {(documentsByApplication.get(app.id) ?? []).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleOpenDoc(doc)}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <LinkIcon className="w-4 h-4" />
                    {doc.file_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
