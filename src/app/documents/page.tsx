'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type {
  DocumentAccess,
  DocumentItem,
  PersonalDocumentAccess,
  PersonalDocumentItem,
  Profile,
} from '@/types/database.types'
import {
  FileText,
  Folder,
  FolderPlus,
  Link as LinkIcon,
  Pencil,
  PlusCircle,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import UserSearch from '@/components/UserSearch'
import { isAdmin } from '@/lib/admin'
import {
  canAccessRoleScope,
  fromRoleScopePayload,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'

const supabase = createClient()

type DocFormState = {
  name: string
  type: 'folder' | 'file'
  url: string
  roleScope: RoleScopeOption | 'selected_people'
  sharedWith: string[]
}

type PersonalDocFormState = {
  name: string
  type: 'folder' | 'file'
  url: string
  sharedWith: string[]
}

const emptyForm: DocFormState = {
  name: '',
  type: 'folder',
  url: '',
  roleScope: 'all',
  sharedWith: [],
}

const emptyPersonalForm: PersonalDocFormState = {
  name: '',
  type: 'folder',
  url: '',
  sharedWith: [],
}

export default function DocumentsPage() {
  const { profile } = useAuth()
  const [viewMode, setViewMode] = useState<'org' | 'personal'>('org')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [accessRows, setAccessRows] = useState<DocumentAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DocFormState>(emptyForm)
  const [personalDocs, setPersonalDocs] = useState<PersonalDocumentItem[]>([])
  const [personalAccessRows, setPersonalAccessRows] = useState<PersonalDocumentAccess[]>([])
  const [personalLoading, setPersonalLoading] = useState(true)
  const [personalError, setPersonalError] = useState<string | null>(null)
  const [personalFolderId, setPersonalFolderId] = useState<string | null>(null)
  const [personalFormOpen, setPersonalFormOpen] = useState(false)
  const [personalEditingId, setPersonalEditingId] = useState<string | null>(null)
  const [personalForm, setPersonalForm] = useState<PersonalDocFormState>(emptyPersonalForm)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileSearch, setProfileSearch] = useState('')

  const isBoard = profile?.role === 'board_member'
  const isUserAdmin = isAdmin(profile?.role)

  const canManageDocument = (item: DocumentItem) => {
    if (!profile) return false
    if (isUserAdmin) return true
    if (isBoard) return true
    return item.created_by === profile.id
  }

  const canSeeDocument = (item: DocumentItem) => {
    if (!profile) return false
    if (isUserAdmin) return true
    if (item.created_by === profile.id) return true
    if (item.is_restricted) {
      return accessRows.some((row) => row.document_id === item.id)
    }
    if (canAccessRoleScope(profile.role, item.role_scope, item.role_scope_mode)) return true
    return accessRows.some((row) => row.document_id === item.id)
  }

  const canSeePersonalDocument = (item: PersonalDocumentItem) => {
    if (!profile) return false
    if (item.owner_id === profile.id) return true
    return personalAccessRows.some((row) => row.document_id === item.id)
  }

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const accessPromise = profile
        ? supabase
            .from('document_access')
            .select('document_id, user_id')
            .eq('user_id', profile.id)
        : Promise.resolve({ data: [] as DocumentAccess[], error: null })

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      const accessResult = await accessPromise
      if (accessResult.error) throw accessResult.error

      const access = (accessResult.data as DocumentAccess[]) ?? []
      setAccessRows(access)

      const docs = ((data as DocumentItem[]) ?? []).filter(canSeeDocument)
      setDocuments(docs)
    } catch (err: any) {
      console.error('Error loading documents', err)
      setError('Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }

  const fetchPersonalDocuments = async () => {
    setPersonalLoading(true)
    setPersonalError(null)
    try {
      const accessPromise = profile
        ? supabase
            .from('personal_document_access')
            .select('document_id, user_id')
            .eq('user_id', profile.id)
        : Promise.resolve({ data: [] as PersonalDocumentAccess[], error: null })

      const { data, error } = await supabase
        .from('personal_documents')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      const accessResult = await accessPromise
      if (accessResult.error) throw accessResult.error

      const access = (accessResult.data as PersonalDocumentAccess[]) ?? []
      setPersonalAccessRows(access)

      const docs = ((data as PersonalDocumentItem[]) ?? []).filter(canSeePersonalDocument)
      setPersonalDocs(docs)
    } catch (err: any) {
      console.error('Error loading personal documents', err)
      setPersonalError('Failed to load personal documents.')
    } finally {
      setPersonalLoading(false)
    }
  }

  const fetchProfiles = async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error loading profiles', error)
      return
    }

    setProfiles((data as Profile[]) ?? [])
  }

  useEffect(() => {
    fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role])

  useEffect(() => {
    fetchPersonalDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (formOpen || personalFormOpen) {
      fetchProfiles()
    }
  }, [formOpen, personalFormOpen])

  const docsById = useMemo(() => {
    const map = new Map<string, DocumentItem>()
    documents.forEach((doc) => map.set(doc.id, doc))
    return map
  }, [documents])

  const personalDocsById = useMemo(() => {
    const map = new Map<string, PersonalDocumentItem>()
    personalDocs.forEach((doc) => map.set(doc.id, doc))
    return map
  }, [personalDocs])

  const breadcrumbs = useMemo(() => {
    const path: DocumentItem[] = []
    let cursor = currentFolderId ? docsById.get(currentFolderId) : undefined
    while (cursor) {
      path.unshift(cursor)
      cursor = cursor.parent_id ? docsById.get(cursor.parent_id) : undefined
    }
    return path
  }, [currentFolderId, docsById])

  const personalBreadcrumbs = useMemo(() => {
    const path: PersonalDocumentItem[] = []
    let cursor = personalFolderId ? personalDocsById.get(personalFolderId) : undefined
    while (cursor) {
      path.unshift(cursor)
      cursor = cursor.parent_id ? personalDocsById.get(cursor.parent_id) : undefined
    }
    return path
  }, [personalFolderId, personalDocsById])

  const filtered = documents.filter((doc) =>
    currentFolderId ? doc.parent_id === currentFolderId : !doc.parent_id
  )

  const folders = filtered.filter((doc) => doc.type === 'folder')
  const files = filtered.filter((doc) => doc.type === 'file')

  const personalFiltered = personalDocs.filter((doc) =>
    personalFolderId ? doc.parent_id === personalFolderId : !doc.parent_id
  )
  const personalFolders = personalFiltered.filter((doc) => doc.type === 'folder')
  const personalFiles = personalFiltered.filter((doc) => doc.type === 'file')

  const openCreate = (type: 'folder' | 'file') => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      type,
    })
    setFormOpen(true)
  }

  const openEdit = (doc: DocumentItem) => {
    setEditingId(doc.id)
    setForm({
      name: doc.name,
      type: doc.type,
      url: doc.file_url ?? '',
      roleScope: doc.is_restricted
        ? 'selected_people'
        : fromRoleScopePayload(doc.role_scope, doc.role_scope_mode),
      sharedWith: accessRows
        .filter((row) => row.document_id === doc.id)
        .map((row) => row.user_id),
    })
    setFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (form.type === 'file' && !form.url.trim()) {
      setError('File link is required for documents.')
      return
    }
    if (form.roleScope === 'selected_people' && form.sharedWith.length === 0) {
      setError('Select at least one person for people-only sharing.')
      return
    }

    setError(null)

    const scopePayload = form.roleScope === 'selected_people'
      ? null
      : toRoleScopePayload(form.roleScope)

    const payload = {
      name: form.name,
      type: form.type,
      file_url: form.type === 'file' ? form.url : null,
      parent_id: currentFolderId,
      role_scope: scopePayload?.roleScope ?? null,
      ...(scopePayload?.roleScopeMode ? { role_scope_mode: scopePayload.roleScopeMode } : {}),
      is_restricted: form.roleScope === 'selected_people',
      created_by: profile.id,
    }

    try {
      let docId = editingId
      if (editingId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('documents')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        docId = data?.id ?? null
      }

      if (docId) {
        await supabase
          .from('document_access')
          .delete()
          .eq('document_id', docId)

        if (form.sharedWith.length > 0) {
          const accessPayload = form.sharedWith.map((userId) => ({
            document_id: docId,
            user_id: userId,
          }))
          const { error } = await supabase
            .from('document_access')
            .insert(accessPayload)
          if (error) throw error
        }
      }

      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchDocuments()
    } catch (err: any) {
      console.error('Error saving document', err)
      setError('Failed to save document. You may not have permission.')
    }
  }

  const handleDelete = async (doc: DocumentItem) => {
    const confirmDelete = window.confirm(`Delete "${doc.name}"? This cannot be undone.`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)
      if (error) throw error
      await fetchDocuments()
    } catch (err: any) {
      console.error('Error deleting document', err)
      setError('Failed to delete document. You may not have permission.')
    }
  }

  const openPersonalCreate = (type: 'folder' | 'file') => {
    setPersonalEditingId(null)
    setPersonalForm({
      ...emptyPersonalForm,
      type,
    })
    setPersonalFormOpen(true)
  }

  const openPersonalEdit = (doc: PersonalDocumentItem) => {
    setPersonalEditingId(doc.id)
    setPersonalForm({
      name: doc.name,
      type: doc.type,
      url: doc.file_url ?? '',
      sharedWith: personalAccessRows
        .filter((row) => row.document_id === doc.id)
        .map((row) => row.user_id),
    })
    setPersonalFormOpen(true)
  }

  const handlePersonalSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (personalForm.type === 'file' && !personalForm.url.trim()) {
      setPersonalError('File link is required for documents.')
      return
    }

    setPersonalError(null)

    const payload = {
      name: personalForm.name,
      type: personalForm.type,
      file_url: personalForm.type === 'file' ? personalForm.url : null,
      parent_id: personalFolderId,
      owner_id: profile.id,
    }

    try {
      let docId = personalEditingId
      if (personalEditingId) {
        const { error } = await supabase
          .from('personal_documents')
          .update(payload)
          .eq('id', personalEditingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('personal_documents')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        docId = data?.id ?? null
      }

      if (docId) {
        await supabase
          .from('personal_document_access')
          .delete()
          .eq('document_id', docId)

        if (personalForm.sharedWith.length > 0) {
          const accessPayload = personalForm.sharedWith.map((userId) => ({
            document_id: docId,
            user_id: userId,
          }))
          const { error } = await supabase
            .from('personal_document_access')
            .insert(accessPayload)
          if (error) throw error
        }
      }

      setPersonalFormOpen(false)
      setPersonalEditingId(null)
      setPersonalForm(emptyPersonalForm)
      await fetchPersonalDocuments()
    } catch (err: any) {
      console.error('Error saving personal document', err)
      setPersonalError('Failed to save personal document.')
    }
  }

  const handlePersonalDelete = async (doc: PersonalDocumentItem) => {
    const confirmDelete = window.confirm(`Delete "${doc.name}"? This cannot be undone.`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('personal_documents')
        .delete()
        .eq('id', doc.id)
      if (error) throw error
      await fetchPersonalDocuments()
    } catch (err: any) {
      console.error('Error deleting personal document', err)
      setPersonalError('Failed to delete personal document.')
    }
  }

  const visibleProfiles = profiles.filter((person) => {
    const value = `${person.full_name} ${person.email}`.toLowerCase()
    return value.includes(profileSearch.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Folder className="w-7 h-7 text-primary" />
            Internal Docs
          </h1>
        </div>

        {viewMode === 'org' ? (
          (isBoard || isUserAdmin) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreate('folder')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-sm text-primary hover:bg-primary/10"
              >
                <FolderPlus className="w-4 h-4" />
                New folder
              </button>
              <button
                type="button"
                onClick={() => openCreate('file')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
              >
                <PlusCircle className="w-4 h-4" />
                Add doc
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openPersonalCreate('folder')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-sm text-primary hover:bg-primary/10"
            >
              <FolderPlus className="w-4 h-4" />
              New folder
            </button>
            <button
              type="button"
              onClick={() => openPersonalCreate('file')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
            >
              <PlusCircle className="w-4 h-4" />
              Add doc
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setViewMode('org')}
          className={`px-3 py-1 rounded-md border ${
            viewMode === 'org' ? 'border-primary text-primary bg-primary/10' : 'border-primary/20 text-muted-foreground'
          }`}
        >
          Org docs
        </button>
        <button
          type="button"
          onClick={() => setViewMode('personal')}
          className={`px-3 py-1 rounded-md border ${
            viewMode === 'personal' ? 'border-primary text-primary bg-primary/10' : 'border-primary/20 text-muted-foreground'
          }`}
        >
          My docs
        </button>
      </div>

      {viewMode === 'org' && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {viewMode === 'personal' && personalError && (
        <p className="text-sm text-destructive">{personalError}</p>
      )}

      {viewMode === 'org' && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={`px-2 py-1 rounded-md ${!currentFolderId ? 'text-primary bg-primary/10' : 'hover:text-primary'}`}
        >
          All documents
        </button>
        {breadcrumbs.map((crumb) => (
          <button
            key={crumb.id}
            type="button"
            onClick={() => setCurrentFolderId(crumb.id)}
            className="px-2 py-1 rounded-md hover:text-primary"
          >
            / {crumb.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <div className="card-glow p-4 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Folders</h2>
            {loading && <p className="text-sm text-muted-foreground">Loading folders...</p>}
            {!loading && folders.length === 0 && (
              <p className="text-sm text-muted-foreground">No folders available.</p>
            )}
            {!loading && folders.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="card-glow p-4 text-left hover:border-primary/60 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-foreground">
                        <Folder className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold">{folder.name}</span>
                      </div>
                      {canManageDocument(folder) && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(folder)
                            }}
                            className="p-1 text-primary hover:bg-primary/10 rounded-md"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(folder)
                            }}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {folder.is_restricted
                        ? 'Only selected people'
                        : folder.role_scope
                          ? getRoleScopeLabel(folder.role_scope, folder.role_scope_mode)
                          : 'All members'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card-glow p-4 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Documents</h2>
            {loading && <p className="text-sm text-muted-foreground">Loading documents...</p>}
            {!loading && files.length === 0 && (
              <p className="text-sm text-muted-foreground">No documents available.</p>
            )}
            {!loading && files.length > 0 && (
              <div className="space-y-3">
                {files.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/10 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{doc.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {doc.is_restricted
                              ? 'Only selected people'
                              : doc.role_scope
                                ? getRoleScopeLabel(doc.role_scope, doc.role_scope_mode)
                                : 'All members'}
                          </span>
                          {accessRows.some((row) => row.document_id === doc.id) && (
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[10px]">
                              Shared
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-sm text-primary hover:bg-primary/10"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Open
                        </a>
                      )}
                      {canManageDocument(doc) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(doc)}
                            className="p-2 rounded-md text-primary hover:bg-primary/10"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {(isBoard || isUserAdmin) && formOpen && (
            <div className="card-glow p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingId ? 'Edit access' : 'Create item'}
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
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                  >
                    <option value="folder">Folder</option>
                    <option value="file">Document link</option>
                  </select>
                </div>

                {form.type === 'file' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Document link</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Audience</label>
                  <select
                    value={form.roleScope}
                    onChange={(e) => setForm((prev) => ({ ...prev, roleScope: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                  >
                    <option value="all">All BOSSO members</option>
                    <option value="selected_people">Selected people only</option>
                    <option value="general_member">General Members only</option>
                    <option value="analyst">Analysts and above</option>
                    <option value="analyst_only">Analysts only</option>
                    <option value="project_manager">PMs and Board</option>
                    <option value="board_member">Board only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Share with people</label>
                  {form.roleScope === 'selected_people' && (
                    <p className="text-xs text-muted-foreground">
                      This item will only be visible to the people you select below.
                    </p>
                  )}
                  <UserSearch
                    users={profiles}
                    value={form.sharedWith}
                    onChange={(value) => setForm((prev) => ({ ...prev, sharedWith: value as string[] }))}
                    placeholder="Search by name..."
                    multiple
                  />
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
        </div>
      </div>
        </>
      )}
      {viewMode === 'personal' && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setPersonalFolderId(null)}
              className={`px-2 py-1 rounded-md ${!personalFolderId ? 'text-primary bg-primary/10' : 'hover:text-primary'}`}
            >
              My documents
            </button>
            {personalBreadcrumbs.map((crumb) => (
              <button
                key={crumb.id}
                type="button"
                onClick={() => setPersonalFolderId(crumb.id)}
                className="px-2 py-1 rounded-md hover:text-primary"
              >
                / {crumb.name}
              </button>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="space-y-6">
              <div className="card-glow p-4 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Folders</h2>
                {personalLoading && <p className="text-sm text-muted-foreground">Loading folders...</p>}
                {!personalLoading && personalFolders.length === 0 && (
                  <p className="text-sm text-muted-foreground">No folders available.</p>
                )}
                {!personalLoading && personalFolders.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {personalFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setPersonalFolderId(folder.id)}
                        className="card-glow p-4 text-left hover:border-primary/60 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 text-foreground">
                            <Folder className="w-5 h-5 text-primary" />
                            <span className="text-sm font-semibold">{folder.name}</span>
                          </div>
                          {folder.owner_id === profile?.id && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openPersonalEdit(folder)
                                }}
                                className="p-1 text-primary hover:bg-primary/10 rounded-md"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handlePersonalDelete(folder)
                                }}
                                className="p-1 text-destructive hover:bg-destructive/10 rounded-md"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          Shared with selected people
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-glow p-4 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Documents</h2>
                {personalLoading && <p className="text-sm text-muted-foreground">Loading documents...</p>}
                {!personalLoading && personalFiles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents available.</p>
                )}
                {!personalLoading && personalFiles.length > 0 && (
                  <div className="space-y-3">
                    {personalFiles.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/10 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{doc.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Shared with selected people
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-sm text-primary hover:bg-primary/10"
                            >
                              <LinkIcon className="w-4 h-4" />
                              Open
                            </a>
                          )}
                          {doc.owner_id === profile?.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => openPersonalEdit(doc)}
                                className="p-2 rounded-md text-primary hover:bg-primary/10"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePersonalDelete(doc)}
                                className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card-glow p-4 space-y-3">
                <h3 className="text-lg font-semibold text-foreground">My storage</h3>
                <p className="text-sm text-muted-foreground">
                  Your personal workspace. Only you and the people you explicitly share with can view these items.
                </p>
              </div>

              {personalFormOpen && (
                <div className="card-glow p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      {personalEditingId ? 'Edit access' : 'Create item'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalFormOpen(false)
                        setPersonalEditingId(null)
                        setPersonalForm(emptyPersonalForm)
                      }}
                      className="p-2 text-muted-foreground hover:text-primary"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handlePersonalSave} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Name</label>
                      <input
                        type="text"
                        value={personalForm.name}
                        onChange={(e) => setPersonalForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Type</label>
                      <select
                        value={personalForm.type}
                        onChange={(e) => setPersonalForm((prev) => ({ ...prev, type: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      >
                        <option value="folder">Folder</option>
                        <option value="file">Document link</option>
                      </select>
                    </div>

                    {personalForm.type === 'file' && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground uppercase tracking-wide">Document link</label>
                        <input
                          type="url"
                          value={personalForm.url}
                          onChange={(e) => setPersonalForm((prev) => ({ ...prev, url: e.target.value }))}
                          required
                          className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Share with people</label>
                      <UserSearch
                        users={profiles}
                        value={personalForm.sharedWith}
                        onChange={(value) => setPersonalForm((prev) => ({ ...prev, sharedWith: value as string[] }))}
                        placeholder="Search by name..."
                        multiple
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
                    >
                      {personalEditingId ? 'Save changes' : 'Create'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
