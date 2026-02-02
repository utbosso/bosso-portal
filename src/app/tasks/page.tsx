
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants'
import type { AssigneeStatus, EventCategory, PersonalTask, Profile, ReviewStatus, Task, TaskStatus, TaskUpdate, UserRole } from '@/types/database.types'
import { EVENT_CATEGORIES } from '@/lib/bosso-points'
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
  Award,
} from 'lucide-react'
import UserSearch from '@/components/UserSearch'

const supabase = createClient()

type AssignmentType = 'individual' | 'role' | 'everyone'

type TaskFormState = {
  title: string
  description: string
  dueDate: string
  assignedTo: string
  assignmentType: AssignmentType
  assignToRole: UserRole | ''
  allowDuplicates: boolean
  status: TaskStatus
  pointValue: string
  pointsCategory: EventCategory
  autoApprove: boolean
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
  assignmentType: 'individual',
  assignToRole: '',
  allowDuplicates: false,
  status: 'not_started',
  pointValue: '',
  pointsCategory: 'membership',
  autoApprove: false,
}

const emptyPersonalForm: PersonalTaskFormState = {
  title: '',
  description: '',
  dueDate: '',
  status: 'not_started',
}

export default function TasksPage() {
  const { profile, hasMinimumRole } = useAuth()
  const canManage = hasMinimumRole('project_manager') // PM, Board Member, or Admin can assign tasks
  const isGeneralMember = profile?.role === 'general_member'

  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team')
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

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

  const assigneeStatusOptions: AssigneeStatus[] = ['not_started', 'in_progress', 'completed']
  const creatorStatusOptions: ReviewStatus[] = ['not_reviewed', 'in_review', 'approved']

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
          assignee_status,
          due_at,
          assigned_to,
          assigned_by,
          created_at,
          point_value,
          points_category,
          auto_approve,
          points_awarded,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, role),
          assigner:profiles!tasks_assigned_by_fkey(id, full_name, role)
        `
        )
        .order('due_at', { ascending: true })

      if (error) throw error

      const rows = ((data as any[]) ?? []).map((row) => {
        return {
          ...row,
          assignee: Array.isArray(row.assignee) ? row.assignee[0] ?? null : row.assignee ?? null,
          assigner: Array.isArray(row.assigner) ? row.assigner[0] ?? null : row.assigner ?? null,
          // Fallback: if assignee_status doesn't exist in DB yet, derive it from status
          assignee_status: row.assignee_status ?? (
            ['not_started', 'in_progress'].includes(row.status)
              ? row.status
              : 'completed'
          ) as AssigneeStatus,
        }
      }) as Task[]
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
      setError(`Failed to load tasks: ${err.message || 'Unknown error'}`)
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
      assignmentType: 'individual',
      assignToRole: '',
      allowDuplicates: false,
      status: task.status,
      pointValue: task.point_value?.toString() ?? '',
      pointsCategory: task.points_category ?? 'membership',
      autoApprove: task.auto_approve ?? false,
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

    // Validate assignment
    if (form.assignmentType === 'individual' && !form.assignedTo) {
      setError('Select an assignee.')
      return
    }
    if (form.assignmentType === 'role' && !form.assignToRole) {
      setError('Select a role to assign to.')
      return
    }

    setError(null)

    const pointVal = form.pointValue ? parseInt(form.pointValue, 10) : null

    try {
      if (editingId) {
        // Editing existing task - always individual
        const currentTask = tasks.find(t => t.id === editingId)
        const assigneeChanged = currentTask && currentTask.assigned_to !== form.assignedTo

        const updatePayload: any = {
          title: form.title,
          description: form.description || null,
          due_at: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null,
          assigned_to: form.assignedTo,
          status: form.status,
        }

        // If reassigning, reset both statuses
        if (assigneeChanged) {
          updatePayload.assignee_status = 'not_started'
          updatePayload.status = 'not_started'
        }

        const { error } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        // Creating new task(s)
        if (form.assignmentType === 'role' || form.assignmentType === 'everyone') {
          // Bulk create: one task per matching user
          const targetUsers = form.assignmentType === 'role'
            ? profiles.filter((p) => p.role === form.assignToRole)
            : profiles

          if (targetUsers.length === 0) {
            setError(form.assignmentType === 'role' ? 'No users found with the selected role.' : 'No users found to assign.')
            return
          }

          // Generate a unique group_task_id to link all tasks from this assignment
          const groupTaskId = crypto.randomUUID()

          let usersToAssign = targetUsers
          if (!form.allowDuplicates) {
            // Check for existing tasks to prevent duplicates for bulk assignments.
            let existingTasksQuery = supabase
              .from('tasks')
              .select('assigned_to')
              .eq('title', form.title)
              .eq('assigned_by', profile.id)
              .in('assigned_to', targetUsers.map((u) => u.id))

            if (form.assignmentType === 'role') {
              existingTasksQuery = existingTasksQuery.eq('assigned_to_role', form.assignToRole)
            }

            const { data: existingTasks } = await existingTasksQuery
            const usersWithExistingTask = new Set(existingTasks?.map(t => t.assigned_to) ?? [])

            // Filter out users who already have this task
            usersToAssign = targetUsers.filter(user => !usersWithExistingTask.has(user.id))

            if (usersToAssign.length === 0) {
              setError(form.assignmentType === 'role'
                ? 'All users in this role already have this task.'
                : 'All users already have this task.')
              return
            }
          }

          const tasksToInsert = usersToAssign.map(user => ({
            title: form.title,
            description: form.description || null,
            due_at: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null,
            assigned_to: user.id,
            status: form.status,
            assigned_by: profile.id,
            point_value: pointVal && pointVal > 0 ? pointVal : null,
            points_category: pointVal && pointVal > 0 ? form.pointsCategory : null,
            auto_approve: form.autoApprove,
            group_task_id: groupTaskId,
            assigned_to_role: form.assignmentType === 'role' ? form.assignToRole : null,
          }))

          const { error } = await supabase
            .from('tasks')
            .insert(tasksToInsert)
          if (error) throw error

          // Show feedback if some users were skipped
          const skippedCount = targetUsers.length - usersToAssign.length
          if (skippedCount > 0) {
            // Task created, but some users skipped - we'll show this in UI later
            console.log(`Created ${usersToAssign.length} tasks, skipped ${skippedCount} users who already had this task`)
          }
        } else {
          // Single task creation
          if (!form.allowDuplicates) {
            const { data: existingTask } = await supabase
              .from('tasks')
              .select('id')
              .eq('title', form.title)
              .eq('assigned_by', profile.id)
              .eq('assigned_to', form.assignedTo)
              .limit(1)
              .maybeSingle()

            if (existingTask) {
              setError('This user already has this task title from you. Enable duplicates to assign again.')
              return
            }
          }

          const payload = {
            title: form.title,
            description: form.description || null,
            due_at: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null,
            assigned_to: form.assignedTo,
            status: form.status,
            assigned_by: profile.id,
            point_value: pointVal && pointVal > 0 ? pointVal : null,
            points_category: pointVal && pointVal > 0 ? form.pointsCategory : null,
            auto_approve: form.autoApprove,
          }

          const { error } = await supabase
            .from('tasks')
            .insert(payload)
          if (error) throw error
        }
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

  const handleAssigneeStatusChange = async (taskId: string, status: AssigneeStatus) => {
    if (!profile) return

    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      // Update the assignee_status field
      // When assignee marks as completed, set review status to 'not_reviewed' (or 'completed' if auto_approve)
      const updateData: any = {
        assignee_status: status,
      }

      if (status === 'completed') {
        if (task.auto_approve) {
          // Auto-approve: mark as completed and award points immediately
          updateData.status = 'completed'
        } else {
          // Manual approval: set to not_reviewed for creator to review
          updateData.status = 'not_reviewed'
        }
      } else {
        // If not completed, keep status in sync with assignee progress
        updateData.status = status
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()

      if (error) {
        setError(`Failed to update task status: ${error.message}`)
        throw error
      }

      if (!data || data.length === 0) {
        setError('Failed to update task status - you may not have permission')
        return
      }

      // If auto-approved and has points, award them
      if (status === 'completed' && task.auto_approve && task.point_value && task.point_value > 0 && !task.points_awarded) {
        await awardTaskPoints(task)
      }

      await fetchTasks()
    } catch (err: any) {
      console.error('Error updating assignee status:', err)
      setError(`Failed to update task status: ${err.message || 'Unknown error'}`)
    }
  }

  const awardTaskPoints = async (task: Task) => {
    if (!profile || !task.point_value || task.point_value <= 0 || task.points_awarded) return

    const response = await fetch('/api/tasks/award-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId: task.id }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to award task points.')
    }
  }

  const handleReviewStatusChange = async (taskId: string, status: ReviewStatus) => {
    if (!profile) return

    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      const updateData: any = { status }

      // If approving a task with points that hasn't been awarded yet, mark as completed
      if (status === 'approved' && task.point_value && task.point_value > 0 && !task.points_awarded) {
        updateData.status = 'completed' // Mark as fully completed when approved
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()

      if (error) throw error

      // Award points if approving
      if (status === 'approved' && task.point_value && task.point_value > 0 && !task.points_awarded) {
        await awardTaskPoints(task)
      }

      await fetchTasks()
    } catch (err: any) {
      console.error('Error updating review status:', err)
      setError(`Failed to update review status: ${err.message || 'Unknown error'}`)
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

      // Create notification for task creator if assignee submitted update
      const task = tasks.find(t => t.id === taskId)
      if (task && task.assigned_to === profile.id && task.assigned_by !== profile.id) {
        await supabase
          .from('task_notifications')
          .insert({
            task_id: taskId,
            user_id: task.assigned_by,
            type: 'update_submitted',
            message: `${profile.full_name} submitted an update on "${task.title}"`,
          })
      }

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
          <div className="space-y-6">
            {loading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
            {!loading && tasks.length === 0 && (
              <div className="card-glow p-4 text-sm text-muted-foreground">
                No team tasks yet.
              </div>
            )}

            {!loading && (() => {
              // Filter tasks into active and completed
              const assignedToMe = tasks.filter(t => t.assigned_to === profile?.id && t.assigned_by !== profile?.id && t.status !== 'completed')
              const assignedByMe = tasks.filter(t => t.assigned_by === profile?.id && t.status !== 'completed')
              const completedTasks = tasks.filter(t =>
                (t.assigned_to === profile?.id || t.assigned_by === profile?.id) &&
                t.status === 'completed'
              )

              const renderTask = (task: Task, section: 'assigned' | 'created') => {
                const updates = taskUpdatesById.get(task.id) ?? []
                const isAssignee = task.assigned_to === profile?.id
                const isCreator = task.assigned_by === profile?.id
                const isApproved = task.status === 'completed'

                // Determine which status field to use and which handler to call
                let statusValue: AssigneeStatus | ReviewStatus
                let availableStatuses: AssigneeStatus[] | ReviewStatus[] = []
                let statusHandler: ((taskId: string, status: any) => void) | null = null

                if (isApproved) {
                  // Approved tasks are read-only
                  statusValue = task.status as ReviewStatus
                  availableStatuses = []
                  statusHandler = null
                } else if (section === 'assigned' && isAssignee && !isCreator) {
                  // Assignee working on task: always show assignee_status dropdown
                  statusValue = task.assignee_status || 'not_started'
                  availableStatuses = assigneeStatusOptions
                  statusHandler = handleAssigneeStatusChange
                } else if (isCreator) {
                  // Creator viewing task
                  if (task.assignee_status === 'completed') {
                    // Assignee completed work, creator can review
                    statusValue = task.status as ReviewStatus
                    availableStatuses = creatorStatusOptions
                    statusHandler = handleReviewStatusChange
                  } else {
                    // Still in progress, creator sees assignee's status (read-only)
                    statusValue = task.assignee_status || 'not_started'
                    availableStatuses = []
                    statusHandler = null
                  }
                } else {
                  // Fallback
                  statusValue = task.status
                  availableStatuses = []
                  statusHandler = null
                }

                const canChangeStatus = availableStatuses.length > 0 && statusHandler !== null

                // Highlight tasks waiting for creator review
                const needsReview = isCreator && task.assignee_status === 'completed' && task.status === 'in_review'
                const taskCardClass = needsReview
                  ? "card-glow p-4 space-y-4 border-2 border-primary/40 bg-primary/5"
                  : "card-glow p-4 space-y-4"

                return (
                <div key={task.id} className={taskCardClass}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-foreground">{task.title}</h2>
                        {/* Show assignee status badge */}
                        <span className={`px-2 py-0.5 rounded-md text-xs uppercase tracking-wide ${TASK_STATUS_COLORS[task.assignee_status || 'not_started']}`}>
                          Work: {TASK_STATUS_LABELS[task.assignee_status || 'not_started']}
                        </span>
                        {/* Show review status badge if assignee completed */}
                        {task.assignee_status === 'completed' && (
                          <span className={`px-2 py-0.5 rounded-md text-xs uppercase tracking-wide ${TASK_STATUS_COLORS[task.status]}`}>
                            Review: {TASK_STATUS_LABELS[task.status]}
                          </span>
                        )}
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
                        {task.point_value && task.point_value > 0 && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            task.points_awarded
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-primary/20 text-primary'
                          }`}>
                            <Award className="w-3 h-3" />
                            {task.point_value} pts
                            {task.points_awarded && ' (awarded)'}
                            {!task.points_awarded && task.auto_approve && ' (auto)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canChangeStatus && statusHandler && (
                        <select
                          value={statusValue}
                          onChange={(e) => statusHandler(task.id, e.target.value as any)}
                          className="px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-xs text-foreground"
                        >
                          {availableStatuses.map((status) => (
                            <option key={status} value={status}>
                              {TASK_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                      {isCreator && !isApproved && (
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

                  {(isAssignee || isCreator) && !isApproved && (
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
            }

            return (
              <>
                {/* Section 1: Tasks Assigned to Me */}
                {assignedToMe.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Tasks Assigned to Me ({assignedToMe.length})
                    </h3>
                    {assignedToMe.map(task => renderTask(task, 'assigned'))}
                  </div>
                )}

                {/* Section 2: Tasks I Assigned */}
                {assignedByMe.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                      Tasks I Assigned ({assignedByMe.length})
                    </h3>
                    {assignedByMe.map(task => renderTask(task, 'created'))}
                  </div>
                )}

                {/* Section 3: Completed Tasks */}
                {completedTasks.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      Completed Tasks ({completedTasks.length})
                      <span className="text-xs text-muted-foreground ml-2">
                        {showCompleted ? '(Click to hide)' : '(Click to show)'}
                      </span>
                    </button>
                    {showCompleted && (
                      <div className="space-y-3">
                        {completedTasks.map(task => renderTask(task, task.assigned_by === profile?.id ? 'created' : 'assigned'))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })()}
          </div>

          <div className="space-y-4">
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

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Assign to</label>

                    {/* Assignment type toggle */}
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignmentType"
                          value="individual"
                          checked={form.assignmentType === 'individual'}
                          onChange={() => setForm((prev) => ({ ...prev, assignmentType: 'individual', assignToRole: '' }))}
                          className="accent-primary"
                        />
                        <span className="text-foreground">Individual</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignmentType"
                          value="role"
                          checked={form.assignmentType === 'role'}
                          onChange={() => setForm((prev) => ({ ...prev, assignmentType: 'role', assignedTo: '' }))}
                          className="accent-primary"
                        />
                        <span className="text-foreground">Role Group</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignmentType"
                          value="everyone"
                          checked={form.assignmentType === 'everyone'}
                          onChange={() => setForm((prev) => ({ ...prev, assignmentType: 'everyone', assignedTo: '', assignToRole: '' }))}
                          className="accent-primary"
                        />
                        <span className="text-foreground">Everyone</span>
                      </label>
                    </div>

                    {form.assignmentType === 'individual' ? (
                      <UserSearch
                        users={visibleAssignees}
                        value={form.assignedTo}
                        onChange={(value) => setForm((prev) => ({ ...prev, assignedTo: value as string }))}
                        placeholder="Search by name..."
                      />
                    ) : form.assignmentType === 'role' ? (
                      <div className="space-y-1">
                        <select
                          value={form.assignToRole}
                          onChange={(e) => setForm((prev) => ({ ...prev, assignToRole: e.target.value as UserRole | '' }))}
                          className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                        >
                          <option value="">Select a role...</option>
                          <option value="analyst">Analysts ({profiles.filter(p => p.role === 'analyst').length})</option>
                          <option value="project_manager">Project Managers ({profiles.filter(p => p.role === 'project_manager').length})</option>
                          <option value="board_member">Board Members ({profiles.filter(p => p.role === 'board_member').length})</option>
                        </select>
                        {form.assignToRole && (
                          <p className="text-xs text-muted-foreground">
                            Will create {profiles.filter(p => p.role === form.assignToRole).length} individual tasks
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Will create {profiles.length} individual tasks for everyone (including general members).
                      </p>
                    )}

                    {!editingId && (
                      <label className="flex items-start gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={form.allowDuplicates}
                          onChange={(e) => setForm((prev) => ({ ...prev, allowDuplicates: e.target.checked }))}
                          className="accent-primary mt-0.5"
                        />
                        <span className="text-xs text-muted-foreground">
                          Allow duplicates (assign again even if they already have this task title)
                        </span>
                      </label>
                    )}
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
                        {assigneeStatusOptions.map((status) => (
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

                  {/* Points Section */}
                  <div className="border-t border-primary/20 pt-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                      <Award className="w-4 h-4 text-primary" />
                      Points (Optional)
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Point Value</label>
                        <input
                          type="number"
                          min="0"
                          value={form.pointValue}
                          onChange={(e) => setForm((prev) => ({ ...prev, pointValue: e.target.value }))}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Points Category</label>
                        <select
                          value={form.pointsCategory}
                          onChange={(e) => setForm((prev) => ({ ...prev, pointsCategory: e.target.value as EventCategory }))}
                          className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                        >
                          {Object.entries(EVENT_CATEGORIES).map(([key, info]) => (
                            <option key={key} value={key}>
                              {info.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.autoApprove}
                          onChange={(e) => setForm((prev) => ({ ...prev, autoApprove: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-dark-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500/50 peer-checked:after:bg-green-400"></div>
                      </label>
                      <div className="text-sm">
                        <span className="text-foreground font-medium">Auto-approve</span>
                        <p className="text-xs text-muted-foreground">
                          {form.autoApprove
                            ? 'Points awarded automatically when assignee marks complete'
                            : 'Requires manual approval before points are awarded'}
                        </p>
                      </div>
                    </div>
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
                      {assigneeStatusOptions.map((status) => (
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
                      {assigneeStatusOptions.map((status) => (
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
