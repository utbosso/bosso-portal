
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants'
import type { PersonalTask, Profile, Task, TaskStatus, TaskUpdate } from '@/types/database.types'
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Link as LinkIcon,
  Pencil,
  PlusCircle,
  Trash2,
  Users,
  X,
} from 'lucide-react'

const supabase = createClient()

type TaskFormState = {
  title: string
  description: string
  dueDate: string
  assignedTo: string
  status: TaskStatus
}

type PersonalTaskFormState = {
  title: string
  description: string
  dueDate: string
  status: TaskStatus
}

const emptyTaskForm: TaskFormState = {
  title: '',
  description: '',
  dueDate: '',
  assignedTo: '',
  status: 'not_started',
}

const emptyPersonalForm: PersonalTaskFormState = {
  title: '',
  description: '',
  dueDate: '',
  status: 'not_started',
}

export default function TasksPage() {
  const { profile, hasMinimumRole } = useAuth()
  const canManage = hasMinimumRole('project_manager')
  const isGeneralMember = profile?.role === 'general_member'

  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team')
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([])
  const [personalLoading, setPersonalLoading] = useState(true)
  const [personalError, setPersonalError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm)

  const [personalFormOpen, setPersonalFormOpen] = useState(false)
  const [personalEditingId, setPersonalEditingId] = useState<string | null>(null)
  const [personalForm, setPersonalForm] = useState<PersonalTaskFormState>(emptyPersonalForm)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { note: string; link: string }>>({})

  const visibleAssignees = profiles.filter((person) => person.role !== 'general_member')

  const taskUpdatesById = useMemo(() => {
    const map = new Map<string, TaskUpdate[]>()
    taskUpdates.forEach((update) => {
      const list = map.get(update.task_id) ?? []
      list.push(update)
      map.set(update.task_id, list)
    })
    return map
  }, [taskUpdates])

  const statusOptions: TaskStatus[] = ['not_started', 'in_progress', 'in_review', 'completed']

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

  const fetchTasks = async () => {
    if (isGeneralMember) {
      setTasks([])
      setTaskUpdates([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `
          id,
          title,
          description,
          status,
          due_at,
          assigned_to,
          assigned_by,
          created_at,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, role),
          assigner:profiles!tasks_assigned_by_fkey(id, full_name, role)
        `
        )
        .order('due_at', { ascending: true })

      if (error) throw error

      const rows = ((data as any[]) ?? []).map((row) => ({
        ...row,
        assignee: Array.isArray(row.assignee) ? row.assignee[0] ?? null : row.assignee ?? null,
        assigner: Array.isArray(row.assigner) ? row.assigner[0] ?? null : row.assigner ?? null,
      })) as Task[]
      const visible = canManage && profile
        ? rows
        : rows.filter((task) => task.assigned_to === profile?.id)

      setTasks(visible)

      if (visible.length > 0) {
        const { data: updates, error: updateError } = await supabase
          .from('task_updates')
          .select(
            `
            id,
            task_id,
            note,
            link,
            created_by,
            created_at,
            author:profiles!task_updates_created_by_fkey(id, full_name, role)
          `
          )
          .in('task_id', visible.map((task) => task.id))
          .order('created_at', { ascending: false })

        if (updateError) throw updateError
        const normalizedUpdates = ((updates as any[]) ?? []).map((row) => ({
          ...row,
          author: Array.isArray(row.author) ? row.author[0] ?? null : row.author ?? null,
        })) as TaskUpdate[]
        setTaskUpdates(normalizedUpdates)
      } else {
        setTaskUpdates([])
      }
    } catch (err: any) {
      console.error('Error loading tasks', err)
      setError('Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }

  const fetchPersonalTasks = async () => {
    setPersonalLoading(true)
    setPersonalError(null)
    try {
      const { data, error } = await supabase
        .from('personal_tasks')
        .select('*')
        .order('due_at', { ascending: true })

      if (error) throw error
      const rows = (data as PersonalTask[]) ?? []
      setPersonalTasks(rows.filter((task) => task.owner_id === profile?.id))
    } catch (err: any) {
      console.error('Error loading personal tasks', err)
      setPersonalError('Failed to load personal tasks.')
    } finally {
      setPersonalLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchPersonalTasks()
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (isGeneralMember) {
      setViewMode('personal')
    }
  }, [isGeneralMember])

  const resetTaskForm = () => {
    setEditingId(null)
    setForm(emptyTaskForm)
    setFormOpen(false)
  }

  const resetPersonalForm = () => {
    setPersonalEditingId(null)
    setPersonalForm(emptyPersonalForm)
    setPersonalFormOpen(false)
  }

  const openCreate = () => {
    setFormOpen(true)
    setEditingId(null)
    setForm({
      ...emptyTaskForm,
      assignedTo: profiles[0]?.id ?? '',
    })
  }

  const openEdit = (task: Task) => {
    setFormOpen(true)
    setEditingId(task.id)
    setForm({
      title: task.title,
      description: task.description ?? '',
      dueDate: task.due_at ? task.due_at.slice(0, 10) : '',
      assignedTo: task.assigned_to,
      status: task.status,
    })
  }

  const openPersonalCreate = () => {
    setPersonalFormOpen(true)
    setPersonalEditingId(null)
    setPersonalForm(emptyPersonalForm)
  }

  const openPersonalEdit = (task: PersonalTask) => {
    setPersonalFormOpen(true)
    setPersonalEditingId(task.id)
    setPersonalForm({
      title: task.title,
      description: task.description ?? '',
      dueDate: task.due_at ? task.due_at.slice(0, 10) : '',
      status: task.status,
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (!form.assignedTo) {
      setError('Select an assignee.')
      return
    }

    setError(null)

    const payload = {
      title: form.title,
      description: form.description || null,
      due_at: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null,
      assigned_to: form.assignedTo,
      status: form.status,
      assigned_by: profile.id,
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: payload.title,
            description: payload.description,
            due_at: payload.due_at,
            assigned_to: payload.assigned_to,
            status: payload.status,
          })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert(payload)
        if (error) throw error
      }

      resetTaskForm()
      await fetchTasks()
    } catch (err: any) {
      console.error('Error saving task', err)
      setError('Failed to save task. You may not have permission.')
    }
  }

  const handleDelete = async (taskId: string) => {
    const confirmDelete = window.confirm('Delete this task? This cannot be undone.')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
      if (error) throw error
      await fetchTasks()
    } catch (err: any) {
      console.error('Error deleting task', err)
      setError('Failed to delete task.')
    }
  }

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
      await fetchTasks()
    } catch (err: any) {
      console.error('Error updating status', err)
      setError('Failed to update task status.')
    }
  }

  const handleUpdateSubmit = async (taskId: string) => {
    if (!profile) return
    const draft = updateDrafts[taskId]
    if (!draft?.note?.trim()) {
      setError('Add a note before submitting an update.')
      return
    }

    try {
      const payload = {
        task_id: taskId,
        note: draft.note,
        link: draft.link || null,
        created_by: profile.id,
      }

      const { error } = await supabase
        .from('task_updates')
        .insert(payload)

      if (error) throw error

      setUpdateDrafts((prev) => ({ ...prev, [taskId]: { note: '', link: '' } }))
      await fetchTasks()
    } catch (err: any) {
      console.error('Error adding update', err)
      setError('Failed to submit update.')
    }
  }

  const handlePersonalSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setPersonalError(null)

    const payload = {
      title: personalForm.title,
      description: personalForm.description || null,
      due_at: personalForm.dueDate ? new Date(`${personalForm.dueDate}T23:59:00`).toISOString() : null,
      status: personalForm.status,
      owner_id: profile.id,
    }

    try {
      if (personalEditingId) {
        const { error } = await supabase
          .from('personal_tasks')
          .update(payload)
          .eq('id', personalEditingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('personal_tasks')
          .insert(payload)
        if (error) throw error
      }

      resetPersonalForm()
      await fetchPersonalTasks()
    } catch (err: any) {
      console.error('Error saving personal task', err)
      setPersonalError('Failed to save personal task.')
    }
  }

  const handlePersonalStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('personal_tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
      await fetchPersonalTasks()
    } catch (err: any) {
      console.error('Error updating personal task status', err)
      setPersonalError('Failed to update task status.')
    }
  }

  const handlePersonalDelete = async (taskId: string) => {
    const confirmDelete = window.confirm('Delete this task?')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('personal_tasks')
        .delete()
        .eq('id', taskId)
      if (error) throw error
      await fetchPersonalTasks()
    } catch (err: any) {
      console.error('Error deleting personal task', err)
      setPersonalError('Failed to delete personal task.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Action Items
          </h1>
          <p className="text-muted-foreground text-sm">
            Track projects, assign tasks, and share progress updates.
          </p>
        </div>

        {viewMode === 'team' ? (
          canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
            >
              <PlusCircle className="w-4 h-4" />
              New task
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={openPersonalCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
          >
            <PlusCircle className="w-4 h-4" />
            New personal task
          </button>
        )}
      </div>

      {!isGeneralMember && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`px-3 py-1 rounded-md border ${
              viewMode === 'team' ? 'border-primary text-primary bg-primary/10' : 'border-primary/20 text-muted-foreground'
            }`}
          >
            Team tasks
          </button>
          <button
            type="button"
            onClick={() => setViewMode('personal')}
            className={`px-3 py-1 rounded-md border ${
              viewMode === 'personal' ? 'border-primary text-primary bg-primary/10' : 'border-primary/20 text-muted-foreground'
            }`}
          >
            My tasks
          </button>
        </div>
      )}

      {viewMode === 'team' && !isGeneralMember && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {viewMode === 'personal' && personalError && (
        <p className="text-sm text-destructive">{personalError}</p>
      )}

      {viewMode === 'team' && !isGeneralMember ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
            {!loading && tasks.length === 0 && (
              <div className="card-glow p-4 text-sm text-muted-foreground">
                No team tasks yet.
              </div>
            )}
            {!loading && tasks.map((task) => {
              const updates = taskUpdatesById.get(task.id) ?? []
              const canUpdate = canManage || task.assigned_to === profile?.id
              return (
                <div key={task.id} className="card-glow p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{task.title}</h2>
                        <span className={`px-2 py-0.5 rounded-md text-xs uppercase tracking-wide ${TASK_STATUS_COLORS[task.status]}`}>
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {task.assignee?.full_name ?? 'Unassigned'}
                        </span>
                        {task.due_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Due {new Date(task.due_at).toLocaleDateString()}
                          </span>
                        )}
                        {task.assigner?.full_name && (
                          <span className="inline-flex items-center gap-1">
                            <ClipboardCheck className="w-3 h-3" />
                            Assigned by {task.assigner.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canUpdate && (
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                          className="px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-xs text-foreground"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {TASK_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(task)}
                            className="p-2 rounded-md text-primary hover:bg-primary/10"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-primary/10 pt-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Updates
                    </div>

                    {updates.length === 0 && (
                      <p className="text-sm text-muted-foreground">No updates yet.</p>
                    )}

                    {updates.slice(0, 3).map((update) => (
                      <div key={update.id} className="rounded-lg border border-primary/10 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{update.author?.full_name ?? 'Team member'}</span>
                          {update.created_at && (
                            <span>{new Date(update.created_at).toLocaleString()}</span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{update.note}</p>
                        {update.link && (
                          <a
                            href={update.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                          >
                            <LinkIcon className="w-3 h-3" />
                            {update.link}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {canUpdate && (
                    <div className="border-t border-primary/10 pt-3 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Add update</p>
                      <textarea
                        value={updateDrafts[task.id]?.note ?? ''}
                        onChange={(e) =>
                          setUpdateDrafts((prev) => ({
                            ...prev,
                            [task.id]: { note: e.target.value, link: prev[task.id]?.link ?? '' },
                          }))
                        }
                        rows={3}
                        placeholder="Share progress notes, blockers, or next steps."
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      />
                      <input
                        type="url"
                        value={updateDrafts[task.id]?.link ?? ''}
                        onChange={(e) =>
                          setUpdateDrafts((prev) => ({
                            ...prev,
                            [task.id]: { note: prev[task.id]?.note ?? '', link: e.target.value },
                          }))
                        }
                        placeholder="Document link (optional)"
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateSubmit(task.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
                      >
                        <FileText className="w-4 h-4" />
                        Submit update
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="card-glow p-4 space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Team workflow</h3>
              <p className="text-sm text-muted-foreground">
                PMs and Board members assign tasks, track progress, and keep updates in one place. Analysts can update
                status and submit notes or document links as they complete work.
              </p>
            </div>

            {canManage && formOpen && (
              <div className="card-glow p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    {editingId ? 'Edit task' : 'Create task'}
                  </h3>
                  <button
                    type="button"
                    onClick={resetTaskForm}
                    className="p-2 text-muted-foreground hover:text-primary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
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
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Assign to</label>
                    <select
                      value={form.assignedTo}
                      onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    >
                      <option value="">Select member</option>
                      {visibleAssignees.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.full_name} ({person.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Due date</label>
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {TASK_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
                  >
                    {editingId ? 'Save changes' : 'Create task'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            {personalLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
            {!personalLoading && personalTasks.length === 0 && (
              <div className="card-glow p-4 text-sm text-muted-foreground">
                No personal tasks yet.
              </div>
            )}
            {!personalLoading && personalTasks.map((task) => (
              <div key={task.id} className="card-glow p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{task.title}</h2>
                      <span className={`px-2 py-0.5 rounded-md text-xs uppercase tracking-wide ${TASK_STATUS_COLORS[task.status]}`}>
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                    {task.due_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Due {new Date(task.due_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => handlePersonalStatusChange(task.id, e.target.value as TaskStatus)}
                      className="px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-xs text-foreground"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openPersonalEdit(task)}
                      className="p-2 rounded-md text-primary hover:bg-primary/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePersonalDelete(task.id)}
                      className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="card-glow p-4 space-y-2">
              <h3 className="text-lg font-semibold text-foreground">My tasks</h3>
              <p className="text-sm text-muted-foreground">
                Track your own checklist items and deadlines.
              </p>
            </div>

            {personalFormOpen && (
              <div className="card-glow p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    {personalEditingId ? 'Edit task' : 'Create task'}
                  </h3>
                  <button
                    type="button"
                    onClick={resetPersonalForm}
                    className="p-2 text-muted-foreground hover:text-primary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handlePersonalSave} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Title</label>
                    <input
                      type="text"
                      value={personalForm.title}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, title: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Due date</label>
                    <input
                      type="date"
                      value={personalForm.dueDate}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Status</label>
                    <select
                      value={personalForm.status}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
                    <textarea
                      value={personalForm.description}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
                  >
                    {personalEditingId ? 'Save changes' : 'Create task'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
