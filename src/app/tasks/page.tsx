'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  Link2,
  ListChecks,
  Loader2,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import { hasMinimumRole } from '@/lib/admin'
import { POINT_CATEGORY_OPTIONS } from '@/lib/semester'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import SectionPageHeader from '@/components/SectionPageHeader'
import {
  fetchCurrentMemberDirectory,
  type CommunicationMember,
  type CommunicationMemberGroup,
} from '@/lib/communication-recipients'
import type {
  AssigneeStatus,
  EventCategory,
  PersonalTask,
  Task,
  TaskStatusHistory,
  TaskUpdate,
} from '@/types/database.types'

const supabase = createClient()

type TeamTask = Task & { archived_at?: string | null; term_id?: string | null }
type TaskReferenceLink = { label: string; url: string }
type TaskTab = 'mine' | 'review' | 'assigned' | 'personal' | 'completed'
type WorkflowStatus = 'todo' | 'in_progress' | 'submitted' | 'approved'

const workflow: Array<{ value: WorkflowStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
]

function getWorkflowStatus(task: TeamTask): WorkflowStatus {
  if (task.status === 'completed' || task.status === ('approved' as any)) return 'approved'
  if (task.assignee_status === 'completed' || ['in_review', 'not_reviewed'].includes(task.status as string)) return 'submitted'
  if (task.assignee_status === 'in_progress' || task.status === 'in_progress') return 'in_progress'
  return 'todo'
}

function workflowLabel(status: WorkflowStatus) {
  return workflow.find((item) => item.value === status)?.label || status
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return 'No due date'
  const due = new Date(dueAt)
  const today = new Date()
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function missingReferenceLinksColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && /reference_links/i.test(error.message))
}

function normalizedReferenceLinks(links: TaskReferenceLink[]) {
  return links
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.url)
    .map((link) => {
      const parsed = new URL(link.url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Links must use http:// or https://.')
      return { label: link.label || parsed.hostname.replace(/^www\./, ''), url: parsed.toString() }
    })
}

export default function TasksPage() {
  const { user, profile } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id)
  const [tasks, setTasks] = useState<TeamTask[]>([])
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([])
  const [profiles, setProfiles] = useState<CommunicationMember[]>([])
  const [memberGroups, setMemberGroups] = useState<CommunicationMemberGroup[]>([])
  const [memberTermName, setMemberTermName] = useState('')
  const [memberDirectoryLoading, setMemberDirectoryLoading] = useState(false)
  const [memberDirectoryError, setMemberDirectoryError] = useState('')
  const [tab, setTab] = useState<TaskTab>('mine')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null)
  const [updates, setUpdates] = useState<TaskUpdate[]>([])
  const [history, setHistory] = useState<TaskStatusHistory[]>([])
  const [groupTasks, setGroupTasks] = useState<TeamTask[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [updateNote, setUpdateNote] = useState('')
  const [updateLink, setUpdateLink] = useState('')
  const [saving, setSaving] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showPersonalCreate, setShowPersonalCreate] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignees: [] as string[],
    pointValue: '',
    pointsCategory: 'membership' as EventCategory,
    autoApprove: false,
    referenceLinks: [] as TaskReferenceLink[],
  })
  const [newPersonal, setNewPersonal] = useState({ title: '', description: '', dueDate: '' })

  const isPortalAdmin = user?.email?.toLowerCase() === 'internal@txbosso.com'
  const canManage = isPortalAdmin || hasMinimumRole(profile?.role, 'project_manager')

  const loadMemberDirectory = useCallback(async () => {
    if (!canManage) {
      setProfiles([])
      return
    }

    setMemberDirectoryLoading(true)
    setMemberDirectoryError('')
    try {
      const { members, groups, termName } = await fetchCurrentMemberDirectory()
      const assignableMembers = members.filter((member) => member.role !== 'admin')
      const eligibleIds = new Set(assignableMembers.map((member) => member.id))
      setProfiles(assignableMembers)
      setMemberGroups(groups)
      setMemberTermName(termName)
      setNewTask((current) => ({
        ...current,
        assignees: current.assignees.filter((id) => eligibleIds.has(id)),
      }))
    } catch (directoryError) {
      setProfiles([])
      setMemberGroups([])
      setMemberDirectoryError(
        directoryError instanceof Error
          ? directoryError.message
          : 'Eligible current-semester members could not be loaded.'
      )
    } finally {
      setMemberDirectoryLoading(false)
    }
  }, [canManage])

  const loadTasks = useCallback(async () => {
    if (!profile || accessLoading) return
    setLoading(true)
    setError('')

    const baseCommonSelect = `
      id, title, description, status, assignee_status, priority, due_at,
      assigned_to, assigned_by, created_at, point_value, points_category,
      auto_approve, points_awarded, group_task_id, assigned_to_role,
      assignee:profiles!tasks_assigned_to_fkey(id, full_name, role),
      assigner:profiles!tasks_assigned_by_fkey(id, full_name, role)
    `
    const commonSelect = `${baseCommonSelect}, reference_links`
    const termSelect = `${commonSelect}, term_id, archived_at`
    const baseTermSelect = `${baseCommonSelect}, term_id, archived_at`
    let taskResult: any

    if (schemaReady && access?.term_id) {
      taskResult = await (supabase as any)
        .from('tasks')
        .select(termSelect)
        .eq('term_id', access.term_id)
        .is('archived_at', null)
        .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(500)
    } else {
      taskResult = await supabase
        .from('tasks')
        .select(commonSelect)
        .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(500)
    }

    // Keep the local preview usable before the new migration is applied.
    if (missingReferenceLinksColumn(taskResult.error)) {
      if (schemaReady && access?.term_id) {
        taskResult = await (supabase as any)
          .from('tasks')
          .select(baseTermSelect)
          .eq('term_id', access.term_id)
          .is('archived_at', null)
          .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(500)
      } else {
        taskResult = await supabase
          .from('tasks')
          .select(baseCommonSelect)
          .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(500)
      }
    }

    const personalResult = await supabase
      .from('personal_tasks')
      .select('*')
      .eq('owner_id', profile.id)
      .order('due_at', { ascending: true })

    const firstError = taskResult.error || personalResult.error
    if (firstError) {
      setError(`Failed to load action items: ${firstError.message}`)
      setLoading(false)
      return
    }

    const normalized = ((taskResult.data || []) as any[]).map((row) => ({
      ...row,
      assignee: Array.isArray(row.assignee) ? row.assignee[0] || null : row.assignee,
      assigner: Array.isArray(row.assigner) ? row.assigner[0] || null : row.assigner,
      assignee_status:
        row.assignee_status || (row.status === 'in_progress' ? 'in_progress' : row.status === 'completed' ? 'completed' : 'not_started'),
    })) as TeamTask[]

    setTasks(normalized)
    setPersonalTasks((personalResult.data || []) as PersonalTask[])
    setSelectedTask((current) => (current ? normalized.find((item) => item.id === current.id) || null : null))
    setLoading(false)
  }, [access?.term_id, profile, schemaReady, accessLoading])

  const loadDetails = useCallback(async (task: TeamTask) => {
    setDetailLoading(true)
    const [updatesResult, historyResult, groupResult] = await Promise.all([
      supabase
        .from('task_updates')
        .select('id, task_id, note, link, created_by, created_at, author:profiles!task_updates_created_by_fkey(id, full_name, role)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(100),
      schemaReady
        ? supabase.from('task_status_history').select('*').eq('task_id', task.id).order('created_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      task.group_task_id && task.assigned_by === profile?.id
        ? supabase
            .from('tasks')
            .select('id, title, status, assignee_status, assigned_to, assigned_by, due_at, assignee:profiles!tasks_assigned_to_fkey(id, full_name, role)')
            .eq('group_task_id', task.group_task_id)
            .limit(250)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (updatesResult.error) setError(`Updates could not be loaded: ${updatesResult.error.message}`)
    setUpdates(
      ((updatesResult.data || []) as any[]).map((row) => ({
        ...row,
        author: Array.isArray(row.author) ? row.author[0] || null : row.author,
      })) as TaskUpdate[]
    )
    setHistory((historyResult.data || []) as TaskStatusHistory[])
    setGroupTasks(
      ((groupResult.data || []) as any[]).map((row) => ({
        ...row,
        assignee: Array.isArray(row.assignee) ? row.assignee[0] || null : row.assignee,
      })) as TeamTask[]
    )
    setDetailLoading(false)
  }, [profile?.id, schemaReady])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  useEffect(() => {
    void loadMemberDirectory()
  }, [loadMemberDirectory])

  useEffect(() => {
    if (selectedTask) void loadDetails(selectedTask)
  }, [loadDetails, selectedTask?.id])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`action-items:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        void loadTasks()
        if (selectedTask) void loadDetails(selectedTask)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_updates' }, () => {
        if (selectedTask) void loadDetails(selectedTask)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_status_history' }, () => {
        if (selectedTask) void loadDetails(selectedTask)
      })
      .subscribe()

    const refresh = () => {
      void loadTasks()
      if (selectedTask) void loadDetails(selectedTask)
    }
    const visible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
      void supabase.removeChannel(channel)
    }
  }, [loadDetails, loadTasks, profile, selectedTask])

  const tabCounts = useMemo(() => {
    if (!profile) return { mine: 0, review: 0, assigned: 0, personal: 0, completed: 0 }
    return {
      mine: tasks.filter((task) => task.assigned_to === profile.id && getWorkflowStatus(task) !== 'approved').length,
      review: tasks.filter((task) => task.assigned_by === profile.id && getWorkflowStatus(task) === 'submitted').length,
      assigned: tasks.filter((task) => task.assigned_by === profile.id && getWorkflowStatus(task) !== 'approved').length,
      personal: personalTasks.filter((task) => task.status !== 'completed').length,
      completed:
        tasks.filter((task) => getWorkflowStatus(task) === 'approved').length,
    }
  }, [personalTasks, profile, tasks])

  const filteredTasks = useMemo(() => {
    if (!profile || tab === 'personal') return []
    let result = tasks
    if (tab === 'mine') result = result.filter((task) => task.assigned_to === profile.id && getWorkflowStatus(task) !== 'approved')
    if (tab === 'review') result = result.filter((task) => task.assigned_by === profile.id && getWorkflowStatus(task) === 'submitted')
    if (tab === 'assigned') result = result.filter((task) => task.assigned_by === profile.id && getWorkflowStatus(task) !== 'approved')
    if (tab === 'completed') result = result.filter((task) => getWorkflowStatus(task) === 'approved')
    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(normalizedQuery) ||
          task.description?.toLowerCase().includes(normalizedQuery) ||
          task.assignee?.full_name?.toLowerCase().includes(normalizedQuery)
      )
    }
    return result
  }, [profile, query, tab, tasks])

  const filteredPersonal = useMemo(() => {
    let result = [...personalTasks]
    if (query.trim()) result = result.filter((task) => task.title.toLowerCase().includes(query.trim().toLowerCase()))
    return result
  }, [personalTasks, query, tab])

  const notify = async (task: TeamTask, recipientId: string, message: string, type: string) => {
    if (!profile || recipientId === profile.id) return
    await (supabase as any).from('task_notifications').insert({ task_id: task.id, user_id: recipientId, type, message })
  }

  const updateWorkflow = async (task: TeamTask, next: WorkflowStatus) => {
    if (!profile) return
    setSaving(`status-${task.id}`)
    setError('')
    const isAssignee = task.assigned_to === profile.id
    const isReviewer = task.assigned_by === profile.id || canManage
    let payload: Record<string, unknown>

    if (next === 'todo' && (isAssignee || isReviewer)) payload = { assignee_status: 'not_started', status: 'not_started' }
    else if (next === 'in_progress' && (isAssignee || isReviewer)) payload = { assignee_status: 'in_progress', status: 'in_progress' }
    else if (next === 'submitted' && isAssignee) {
      payload = { assignee_status: 'completed', status: task.auto_approve ? 'completed' : 'in_review' }
    } else if (next === 'approved' && isReviewer) payload = { assignee_status: 'completed', status: 'completed' }
    else {
      setError('That workflow change is not available for your role on this item.')
      setSaving('')
      return
    }

    const { error: updateError } = await supabase.from('tasks').update(payload as any).eq('id', task.id)
    if (updateError) {
      setError(`Status could not be saved: ${updateError.message}`)
      setSaving('')
      return
    }

    if (next === 'submitted') {
      await notify(task, task.assigned_by, `${profile.full_name} submitted “${task.title}” for review.`, 'status_changed')
    } else if (next === 'approved') {
      await notify(task, task.assigned_to, `“${task.title}” was approved.`, 'status_changed')
    }

    if ((next === 'approved' || (next === 'submitted' && task.auto_approve)) && task.point_value && !task.points_awarded) {
      const response = await fetch('/api/tasks/award-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        setError(result.error || 'The status saved, but task points could not be awarded.')
      }
    }

    setSaving('')
    await loadTasks()
    if (selectedTask?.id === task.id || (task.group_task_id && selectedTask?.group_task_id === task.group_task_id)) {
      await loadDetails(selectedTask)
    }
  }

  const createTeamTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile || newTask.assignees.length === 0) return
    const eligibleIds = new Set(profiles.map((member) => member.id))
    const assignees = newTask.assignees.filter((id) => eligibleIds.has(id))
    if (assignees.length === 0) {
      setError('Select at least one member approved for the current semester.')
      return
    }
    let referenceLinks: TaskReferenceLink[]
    try {
      referenceLinks = normalizedReferenceLinks(newTask.referenceLinks)
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Check the reference links and try again.')
      return
    }
    setError('')
    setSaving('create-team')
    const groupId = assignees.length > 1 ? crypto.randomUUID() : null
    const pointValue = newTask.pointValue ? Number(newTask.pointValue) : null
    const payload = assignees.map((assigneeId) => ({
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      status: 'not_started' as const,
      assignee_status: 'not_started' as AssigneeStatus,
      due_at: newTask.dueDate ? new Date(`${newTask.dueDate}T23:59:00`).toISOString() : null,
      assigned_to: assigneeId,
      assigned_by: profile.id,
      point_value: pointValue && pointValue > 0 ? pointValue : null,
      points_category: pointValue && pointValue > 0 ? newTask.pointsCategory : null,
      auto_approve: newTask.autoApprove,
      points_awarded: false,
      group_task_id: groupId,
      assigned_to_role: null,
      reference_links: referenceLinks,
      ...(schemaReady && access?.term_id ? { term_id: access.term_id, archived_at: null } : {}),
    }))
    let createResult = await (supabase as any).from('tasks').insert(payload).select('id')
    let linksStoredAsUpdates = false
    if (missingReferenceLinksColumn(createResult.error)) {
      const fallbackPayload = payload.map(({ reference_links: _referenceLinks, ...task }) => task)
      createResult = await (supabase as any).from('tasks').insert(fallbackPayload).select('id')
      linksStoredAsUpdates = true
    }
    const createError = createResult.error
    if (createError) setError(`Action items could not be assigned: ${createError.message}`)
    else {
      if (linksStoredAsUpdates && referenceLinks.length > 0) {
        const linkUpdates = (createResult.data || []).flatMap((task: { id: string }) =>
          referenceLinks.map((link) => ({
            task_id: task.id,
            note: `Reference: ${link.label}`,
            link: link.url,
            created_by: profile.id,
          }))
        )
        const { error: linkUpdateError } = await supabase.from('task_updates').insert(linkUpdates)
        if (linkUpdateError) setError(`The action items were assigned, but their links could not be saved: ${linkUpdateError.message}`)
      }
      setShowCreate(false)
      setNewTask({ title: '', description: '', dueDate: '', assignees: [], pointValue: '', pointsCategory: 'membership', autoApprove: false, referenceLinks: [] })
      await loadTasks()
    }
    setSaving('')
  }

  const createPersonalTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    setSaving('create-personal')
    const { error: createError } = await supabase.from('personal_tasks').insert({
      title: newPersonal.title.trim(),
      description: newPersonal.description.trim() || null,
      status: 'not_started',
      due_at: newPersonal.dueDate ? new Date(`${newPersonal.dueDate}T23:59:00`).toISOString() : null,
      owner_id: profile.id,
    })
    if (createError) setError(createError.message)
    else {
      setShowPersonalCreate(false)
      setNewPersonal({ title: '', description: '', dueDate: '' })
      await loadTasks()
    }
    setSaving('')
  }

  const togglePersonal = async (task: PersonalTask) => {
    const status = task.status === 'completed' ? 'not_started' : 'completed'
    const { error: updateError } = await supabase.from('personal_tasks').update({ status }).eq('id', task.id)
    if (updateError) setError(updateError.message)
    else await loadTasks()
  }

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile || !selectedTask || !updateNote.trim()) return
    setSaving(`update-${selectedTask.id}`)
    const { error: updateError } = await supabase.from('task_updates').insert({
      task_id: selectedTask.id,
      note: updateNote.trim(),
      link: updateLink.trim() || null,
      created_by: profile.id,
    })
    if (updateError) setError(updateError.message)
    else {
      const recipient = selectedTask.assigned_to === profile.id ? selectedTask.assigned_by : selectedTask.assigned_to
      await notify(selectedTask, recipient, `${profile.full_name} added an update to “${selectedTask.title}”.`, 'update_submitted')
      setUpdateNote('')
      setUpdateLink('')
      await loadDetails(selectedTask)
    }
    setSaving('')
  }

  const tabs: Array<{ value: TaskTab; label: string; count: number }> = [
    { value: 'mine', label: 'My tasks', count: tabCounts.mine },
    { value: 'review', label: 'Needs review', count: tabCounts.review },
    { value: 'assigned', label: 'Assigned by me', count: tabCounts.assigned },
    { value: 'personal', label: 'Personal', count: tabCounts.personal },
    { value: 'completed', label: 'Completed', count: tabCounts.completed },
  ]

  const currentList = tab === 'personal' ? filteredPersonal : filteredTasks

  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Organization"
        title="Action items"
        description="A focused queue for assigned work, progress updates, submission, and approval."
        icon={ListChecks}
        actions={<><button onClick={() => setShowPersonalCreate(true)} className="portal-button-secondary"><UserRound className="h-4 w-4" /> Personal item</button>{canManage && <button onClick={() => setShowCreate(true)} className="portal-button"><Plus className="h-4 w-4" /> Assign item</button>}</>}
      />

      {error && <div className="portal-alert-error">{error}</div>}

      <div className="portal-panel p-0 sm:p-0">
        <div className="portal-scroll-row flex gap-1 overflow-x-auto border-b border-border p-2">{tabs.map((item) => <button key={item.value} onClick={() => setTab(item.value)} className={`flex min-w-max items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === item.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.label}<span className={`rounded-full px-2 py-0.5 text-xs ${tab === item.value ? 'bg-background/15' : 'bg-muted'}`}>{item.count}</span></button>)}</div>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search action items" className="portal-input w-full pl-9" /></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" /> Live updates + focus refresh</div></div>

        {loading ? <div className="portal-loading"><Loader2 className="animate-spin" /> Loading action items…</div> : currentList.length === 0 ? <div className="portal-empty compact"><ListChecks className="h-8 w-8" /><h3>Nothing in this view</h3><p>{tab === 'review' ? 'Submitted work will appear here for approval.' : 'You are all caught up.'}</p></div> : tab === 'personal' ? (
          <div className="divide-y divide-border">{filteredPersonal.map((task) => <button key={task.id} onClick={() => void togglePersonal(task)} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-muted/50 sm:gap-4 sm:px-5"><span className="mt-0.5">{task.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</span><span className="min-w-0 flex-1"><span className={`block font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{task.title}</span>{task.description && <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">{task.description}</span>}<span className="mt-1 block text-xs text-muted-foreground sm:hidden">{dueLabel(task.due_at)}</span></span><span className="hidden text-xs text-muted-foreground sm:block">{dueLabel(task.due_at)}</span></button>)}</div>
        ) : (
          <div className="divide-y divide-border">{filteredTasks.map((task) => { const status = getWorkflowStatus(task); const overdue = task.due_at && new Date(task.due_at) < new Date() && status !== 'approved'; return <button key={task.id} onClick={() => setSelectedTask(task)} className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/50"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status === 'approved' ? 'bg-[hsl(var(--success-surface))] text-[hsl(var(--success))]' : status === 'submitted' ? 'bg-[hsl(var(--info-surface))] text-[hsl(var(--info))]' : status === 'in_progress' ? 'bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))]' : 'bg-muted text-muted-foreground'}`}>{status === 'approved' ? <Check className="h-4 w-4" /> : status === 'submitted' ? <FileCheck2 className="h-4 w-4" /> : status === 'in_progress' ? <Clock3 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{task.title}</span>{task.point_value ? <span className="badge-warning rounded-full px-2 py-0.5 text-[11px] font-medium">{task.point_value} pts</span> : null}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{workflowLabel(status)}</span><span>{tab === 'mine' ? `From ${task.assigner?.full_name || 'BOSSO'}` : task.assignee?.full_name || 'Member'}</span><span className={overdue ? 'font-medium text-destructive' : ''}>{dueLabel(task.due_at)}</span></div></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></button> })}</div>
        )}
      </div>

      {selectedTask && (
        <div className="portal-modal-backdrop z-[90] block p-0 backdrop-blur-none" onMouseDown={() => setSelectedTask(null)}>
          <aside onMouseDown={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Action item</p><p className="mt-1 text-sm text-muted-foreground">{selectedTask.assignee?.full_name}</p></div><button onClick={() => setSelectedTask(null)} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <div className="space-y-7 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-8 sm:p-8">
              <div><h2 className="break-words text-2xl font-semibold leading-tight sm:text-3xl">{selectedTask.title}</h2>{selectedTask.description && <p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">{selectedTask.description}</p>}<div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {dueLabel(selectedTask.due_at)}</span>{selectedTask.point_value ? <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> {selectedTask.point_value} points</span> : null}</div></div>

              {selectedTask.reference_links && selectedTask.reference_links.length > 0 && (
                <section>
                  <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Reference links</h3></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedTask.reference_links.map((link, index) => (
                      <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/50">
                        <span className="min-w-0 truncate">{link.label}</span><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              <section><h3 className="text-sm font-semibold">Workflow</h3><div className="mt-4 grid grid-cols-4 gap-2">{workflow.map((step, index) => { const currentIndex = workflow.findIndex((item) => item.value === getWorkflowStatus(selectedTask)); const reached = index <= currentIndex; return <div key={step.value}><div className={`h-1.5 rounded-full ${reached ? 'bg-primary' : 'bg-muted'}`} /><p className={`mt-2 text-[11px] font-medium ${reached ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p></div> })}</div><div className="mt-5 flex flex-wrap gap-2">{selectedTask.assigned_to === profile?.id && getWorkflowStatus(selectedTask) === 'todo' && <button disabled={saving.includes(selectedTask.id)} onClick={() => void updateWorkflow(selectedTask, 'in_progress')} className="portal-button"><ArrowRight className="h-4 w-4" /> Start work</button>}{selectedTask.assigned_to === profile?.id && ['todo', 'in_progress'].includes(getWorkflowStatus(selectedTask)) && <button disabled={saving.includes(selectedTask.id)} onClick={() => void updateWorkflow(selectedTask, 'submitted')} className="portal-button"><Send className="h-4 w-4" /> Submit for review</button>}{(selectedTask.assigned_by === profile?.id || canManage) && getWorkflowStatus(selectedTask) === 'submitted' && <><button disabled={saving.includes(selectedTask.id)} onClick={() => void updateWorkflow(selectedTask, 'approved')} className="portal-button"><ClipboardCheck className="h-4 w-4" /> Approve</button><button disabled={saving.includes(selectedTask.id)} onClick={() => void updateWorkflow(selectedTask, 'in_progress')} className="portal-button-secondary">Return to progress</button></>}</div></section>

              {selectedTask.assigned_by === profile?.id && groupTasks.length > 1 && <section><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Team progress</h3></div><div className="mt-3 divide-y divide-border rounded-xl border border-border">{groupTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 p-3 text-sm"><span>{task.assignee?.full_name || 'Member'}</span><span className="text-xs font-medium text-muted-foreground">{workflowLabel(getWorkflowStatus(task))}</span></div>)}</div></section>}

              <section><div className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Updates</h3></div><form onSubmit={submitUpdate} className="mt-4 rounded-xl border border-border bg-muted/40 p-3 sm:p-4"><textarea value={updateNote} onChange={(event) => setUpdateNote(event.target.value)} rows={3} className="portal-input w-full resize-none" placeholder="Share progress, context, or what is blocking you." required /><div className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={updateLink} onChange={(event) => setUpdateLink(event.target.value)} type="url" className="portal-input w-full pl-9" placeholder="Optional link" /></div><button disabled={saving === `update-${selectedTask.id}`} className="portal-button justify-center"><Send className="h-4 w-4" /> Add update</button></div></form>{detailLoading ? <div className="portal-loading min-h-28"><Loader2 className="animate-spin" /></div> : updates.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No updates yet.</p> : <div className="mt-4 space-y-3">{updates.map((update) => <article key={update.id} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><p className="text-sm font-medium">{update.author?.full_name || 'Member'}</p><p className="text-xs text-muted-foreground">{update.created_at ? new Date(update.created_at).toLocaleString() : ''}</p></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{update.note}</p>{update.link && <a href={update.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"><ExternalLink className="h-3.5 w-3.5" /> Open link</a>}</article>)}</div>}</section>

              {history.length > 0 && <section><h3 className="text-sm font-semibold">Status history</h3><div className="mt-3 space-y-3">{history.map((item) => <div key={item.id} className="flex gap-3 text-sm"><div className="mt-1.5 h-2 w-2 rounded-full bg-primary" /><div><p><span className="capitalize">{item.from_status?.replaceAll('_', ' ') || 'Created'}</span> <ArrowRight className="mx-1 inline h-3 w-3" /> <span className="capitalize">{item.to_status.replaceAll('_', ' ')}</span></p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div></div>)}</div></section>}
            </div>
          </aside>
        </div>
      )}

      {showCreate && (
        <div className="portal-modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form
            onSubmit={createTeamTask}
            onMouseDown={(event) => event.stopPropagation()}
            className="portal-modal"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="portal-eyebrow">Team assignment</p>
                <h2 className="text-2xl font-semibold">Assign an action item</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="portal-icon-button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-7 space-y-5">
              <label>
                <span className="portal-label">Title</span>
                <input
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                  className="portal-input w-full"
                  required
                />
              </label>
              <label>
                <span className="portal-label">Description</span>
                <textarea
                  value={newTask.description}
                  onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
                  rows={4}
                  className="portal-input w-full resize-none"
                />
              </label>
              <label>
                <span className="portal-label">Due date</span>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(event) => setNewTask({ ...newTask, dueDate: event.target.value })}
                  className="portal-input w-full"
                />
              </label>
              <fieldset>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <legend className="portal-label mb-1">Reference links</legend>
                    <p className="text-xs leading-5 text-muted-foreground">Add briefs, shared files, forms, or any page the assignees will need.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewTask((current) => ({ ...current, referenceLinks: [...current.referenceLinks, { label: '', url: '' }] }))}
                    className="portal-button-secondary small shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add link
                  </button>
                </div>
                {newTask.referenceLinks.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setNewTask((current) => ({ ...current, referenceLinks: [{ label: '', url: '' }] }))}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
                  >
                    <Link2 className="h-4 w-4" /> Attach a reference link
                  </button>
                ) : (
                  <div className="mt-3 space-y-3">
                    {newTask.referenceLinks.map((link, index) => (
                      <div key={index} className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[0.75fr_1.25fr_auto] sm:items-center">
                        <input
                          value={link.label}
                          onChange={(event) => setNewTask((current) => ({ ...current, referenceLinks: current.referenceLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))}
                          className="portal-input w-full"
                          placeholder="Label (optional)"
                        />
                        <input
                          type="url"
                          value={link.url}
                          onChange={(event) => setNewTask((current) => ({ ...current, referenceLinks: current.referenceLinks.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))}
                          className="portal-input w-full"
                          placeholder="https://…"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setNewTask((current) => ({ ...current, referenceLinks: current.referenceLinks.filter((_, itemIndex) => itemIndex !== index) }))}
                          className="portal-icon-button"
                          aria-label={`Remove link ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
              <fieldset>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <legend className="portal-label">Assignees</legend>
                    <p className="text-xs text-muted-foreground">
                      {memberTermName
                        ? `Everyone approved for ${memberTermName} is available, regardless of point progress.`
                        : 'Everyone approved for the current semester is available, regardless of point progress.'}
                    </p>
                  </div>
                  {memberDirectoryLoading && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading members
                    </span>
                  )}
                </div>
                {memberDirectoryError ? (
                  <div className="portal-alert-error">
                    {memberDirectoryError}{' '}
                    <button type="button" onClick={() => void loadMemberDirectory()} className="font-semibold underline">
                      Try again
                    </button>
                  </div>
                ) : (
                  <MemberGroupPicker
                    users={profiles}
                    groups={memberGroups}
                    value={newTask.assignees}
                    onChange={(assignees) => setNewTask((current) => ({ ...current, assignees }))}
                    disabled={memberDirectoryLoading}
                    placeholder="Search approved current-semester members..."
                  />
                )}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="portal-label">Points (optional)</span>
                  <input
                    type="number"
                    min="0"
                    value={newTask.pointValue}
                    onChange={(event) => setNewTask({ ...newTask, pointValue: event.target.value })}
                    className="portal-input w-full"
                  />
                </label>
                <label>
                  <span className="portal-label">Point category</span>
                  <select
                    value={newTask.pointsCategory}
                    onChange={(event) => setNewTask({ ...newTask, pointsCategory: event.target.value as EventCategory })}
                    className="portal-input w-full"
                  >
                    {POINT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={newTask.autoApprove}
                  onChange={(event) => setNewTask({ ...newTask, autoApprove: event.target.checked })}
                />
                Auto-approve when submitted
              </label>
            </div>
            <div className="portal-form-actions">
              <button type="button" onClick={() => setShowCreate(false)} className="portal-button-secondary">Cancel</button>
              <button
                disabled={saving === 'create-team' || memberDirectoryLoading || newTask.assignees.length === 0}
                className="portal-button"
              >
                {saving === 'create-team' && <Loader2 className="h-4 w-4 animate-spin" />}
                Assign to {newTask.assignees.length || 0}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPersonalCreate && <div className="portal-modal-backdrop" onMouseDown={() => setShowPersonalCreate(false)}><form onSubmit={createPersonalTask} onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-lg"><div className="portal-form-header"><div><p className="portal-eyebrow">Private to you</p><h2>New personal item</h2></div><button type="button" onClick={() => setShowPersonalCreate(false)} className="portal-icon-button"><X className="h-5 w-5" /></button></div><div className="space-y-5"><label><span className="portal-label">Title</span><input value={newPersonal.title} onChange={(event) => setNewPersonal({ ...newPersonal, title: event.target.value })} className="portal-input w-full" required /></label><label><span className="portal-label">Description</span><textarea value={newPersonal.description} onChange={(event) => setNewPersonal({ ...newPersonal, description: event.target.value })} rows={4} className="portal-input w-full resize-none" /></label><label><span className="portal-label">Due date</span><input type="date" value={newPersonal.dueDate} onChange={(event) => setNewPersonal({ ...newPersonal, dueDate: event.target.value })} className="portal-input w-full" /></label></div><div className="portal-form-actions"><button type="button" onClick={() => setShowPersonalCreate(false)} className="portal-button-secondary justify-center">Cancel</button><button disabled={saving === 'create-personal'} className="portal-button justify-center">Add item</button></div></form></div>}
    </div>
  )
}
