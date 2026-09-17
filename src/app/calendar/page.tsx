'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import type { Event, EventCategory, EventType, Task } from '@/types/database.types'
import type { UserOption } from '@/components/UserSearch'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import SectionPageHeader from '@/components/SectionPageHeader'
import { EVENT_CATEGORIES, getEventTypesByCategory, getDefaultPoints } from '@/lib/bosso-points'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  PlusCircle,
  Trash2,
  X,
  Calendar,
  Mail,
  Folder,
  Tag,
  CheckSquare,
  Info,
} from 'lucide-react'
import {
  canAccessAudience,
  fromRoleScopePayload,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'
import {
  fetchCurrentMemberDirectory,
  resolveCommunicationRecipients,
  type CommunicationMemberGroup,
} from '@/lib/communication-recipients'

const supabase = createClient()

type CalendarView = 'day' | 'week' | 'month'

type EventFormState = {
  title: string
  description: string
  location: string
  date: string
  startTime: string
  endTime: string
  audienceMode: 'role' | 'people'
  audience: RoleScopeOption
  selectedUserIds: string[]
  trackAttendance: boolean
  codeHasExpiry: boolean
  eventCategory: EventCategory | ''
  eventType: EventType | ''
  customEventType: string
  pointValue: string
  deliverableEnabled: boolean
  deliverableTitle: string
  deliverableDescription: string
  deliverablePointValue: string
  deliverableDueDate: string
  repeatEnabled: boolean
  repeatInterval: string
  repeatUnit: 'week' | 'month'
  repeatWeekdays: number[]
  repeatCount: string
}

const emptyForm: EventFormState = {
  title: '',
  description: '',
  location: '',
  date: '',
  startTime: '',
  endTime: '',
  audienceMode: 'role',
  audience: 'all',
  selectedUserIds: [],
  trackAttendance: false,
  codeHasExpiry: true,
  eventCategory: '',
  eventType: '',
  customEventType: '',
  pointValue: '',
  deliverableEnabled: false,
  deliverableTitle: '',
  deliverableDescription: '',
  deliverablePointValue: '0.5',
  deliverableDueDate: '',
  repeatEnabled: false,
  repeatInterval: '1',
  repeatUnit: 'week',
  repeatWeekdays: [],
  repeatCount: '4',
}

export default function CalendarPage() {
  const { user, profile, hasMinimumRole, loading: authLoading } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id, authLoading)
  const [events, setEvents] = useState<Event[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [peopleOptions, setPeopleOptions] = useState<UserOption[]>([])
  const [memberGroups, setMemberGroups] = useState<CommunicationMemberGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [calendarViewChosen, setCalendarViewChosen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [detailsDate, setDetailsDate] = useState<Date | null>(null)

  // Initialize form state from sessionStorage if available
  const [formOpen, setFormOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('calendarFormOpen')
      return saved === 'true'
    }
    return false
  })
  const [editingId, setEditingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('calendarEditingId')
    }
    return null
  })
  const [form, setForm] = useState<EventFormState>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('calendarForm')
      if (saved) {
        try {
          return { ...emptyForm, ...JSON.parse(saved) }
        } catch {
          return emptyForm
        }
      }
    }
    return emptyForm
  })

  const canManage = hasMinimumRole('project_manager')
  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  const canSeeEvent = (item: Event) => {
    return canAccessAudience(
      profile?.id,
      profile?.role,
      item.audience_scope,
      item.audience_scope_mode,
      item.target_user_ids
    )
  }

  const canAccessAttendanceCode = (event: Event) => {
    if (!profile) return false
    return isUserAdmin || event.created_by === profile.id
  }

  const toDateKey = (value: Date) => {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toTimeInput = (value: Date) => {
    const hours = `${value.getHours()}`.padStart(2, '0')
    const minutes = `${value.getMinutes()}`.padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatMonthYear = (value: Date) =>
    value.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1)
  const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0)

  const startOfWeek = (value: Date) => {
    const date = new Date(value)
    date.setDate(date.getDate() - date.getDay())
    date.setHours(0, 0, 0, 0)
    return date
  }

  const endOfWeek = (value: Date) => {
    const date = new Date(value)
    date.setDate(date.getDate() + (6 - date.getDay()))
    date.setHours(23, 59, 59, 999)
    return date
  }

  const addDays = (value: Date, amount: number) => {
    const date = new Date(value)
    date.setDate(date.getDate() + amount)
    return date
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [selectedDate])

  const daysInGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    const days: Date[] = []
    const cursor = new Date(start)

    while (cursor <= end) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    return days
  }, [currentMonth])

  const fetchEvents = async () => {
    if (accessLoading) return
    setLoading(true)
    setError(null)
    try {
      // Fetch events
      let eventsQuery: any = supabase
        .from('events')
        .select('*')
      if (schemaReady && access?.term_id) {
        eventsQuery = eventsQuery.eq('term_id', access.term_id).is('archived_at', null)
      }
      const { data: eventsData, error: eventsError } = await eventsQuery.order('start_at', { ascending: true })

      if (eventsError) throw eventsError
      const rows = (eventsData as Event[]) ?? []
      setEvents(rows.filter(canSeeEvent))

      // Fetch tasks assigned to current user with due dates
      if (profile?.id) {
        let tasksQuery: any = supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', profile.id)
          .not('due_at', 'is', null)
          .neq('status', 'completed')
        if (schemaReady && access?.term_id) {
          tasksQuery = tasksQuery.eq('term_id', access.term_id).is('archived_at', null)
        }
        const { data: tasksData, error: tasksError } = await tasksQuery.order('due_at', { ascending: true })

        if (tasksError) {
          console.error('Error loading tasks', tasksError)
        } else {
          setTasks((tasksData as Task[]) ?? [])
        }
      }
    } catch (err: any) {
      console.error('Error loading events', err)
      setError('Failed to load events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, access?.term_id, schemaReady, accessLoading])

  useEffect(() => {
    if (calendarViewChosen) return

    const setResponsiveDefault = () => {
      const width = window.innerWidth
      setCalendarView(width < 768 ? 'day' : width >= 1536 ? 'month' : 'week')
    }

    setResponsiveDefault()
    window.addEventListener('resize', setResponsiveDefault)
    return () => window.removeEventListener('resize', setResponsiveDefault)
  }, [calendarViewChosen])

  useEffect(() => {
    const fetchPeopleOptions = async () => {
      if (!canManage) return
      try {
        const { members, groups } = await fetchCurrentMemberDirectory()
        setPeopleOptions(members)
        setMemberGroups(groups)
      } catch (directoryError) {
        console.error('Error loading current-semester members for targeting', directoryError)
        setPeopleOptions([])
        setMemberGroups([])
      }
    }

    void fetchPeopleOptions()
  }, [access?.term_id, canManage])

  // Persist form state to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('calendarFormOpen', formOpen.toString())
    }
  }, [formOpen])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingId) {
        sessionStorage.setItem('calendarEditingId', editingId)
      } else {
        sessionStorage.removeItem('calendarEditingId')
      }
    }
  }, [editingId])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('calendarForm', JSON.stringify(form))
    }
  }, [form])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const event of events) {
      const key = toDateKey(new Date(event.start_at))
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (task.due_at) {
        const key = toDateKey(new Date(task.due_at))
        const list = map.get(key) ?? []
        list.push(task)
        map.set(key, list)
      }
    }
    return map
  }, [tasks])

  const selectedKey = toDateKey(selectedDate)
  const selectedEvents = eventsByDay.get(selectedKey) ?? []
  const selectedTasks = tasksByDay.get(selectedKey) ?? []
  const detailsKey = detailsDate ? toDateKey(detailsDate) : null
  const detailsEvents = detailsKey ? eventsByDay.get(detailsKey) ?? [] : []
  const detailsTasks = detailsKey ? tasksByDay.get(detailsKey) ?? [] : []

  const selectedScheduleItems = useMemo(() => {
    return [
      ...selectedEvents.map((event) => ({
        kind: 'event' as const,
        id: event.id,
        title: event.title,
        date: new Date(event.start_at),
        event,
      })),
      ...selectedTasks.map((task) => ({
        kind: 'task' as const,
        id: task.id,
        title: task.title,
        date: new Date(task.due_at as string),
        task,
      })),
    ].sort((first, second) => first.date.getTime() - second.date.getTime())
  }, [selectedEvents, selectedTasks])

  // Helper function to clear form state from sessionStorage
  const clearFormState = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('calendarFormOpen')
      sessionStorage.removeItem('calendarEditingId')
      sessionStorage.removeItem('calendarForm')
    }
  }

  const updateSelectedDate = (date: Date) => {
    setSelectedDate(date)
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  const navigateCalendar = (direction: -1 | 1) => {
    if (calendarView === 'day') {
      updateSelectedDate(addDays(selectedDate, direction))
      return
    }

    if (calendarView === 'week') {
      updateSelectedDate(addDays(selectedDate, direction * 7))
      return
    }

    const targetMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1)
    const targetDay = Math.min(
      selectedDate.getDate(),
      new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    )
    setCurrentMonth(targetMonth)
    setSelectedDate(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), targetDay))
  }

  const goToToday = () => {
    updateSelectedDate(new Date())
  }

  const changeCalendarView = (view: CalendarView) => {
    setCalendarViewChosen(true)
    setCalendarView(view)
    if (view === 'month') {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
  }

  const calendarTitle = (() => {
    if (calendarView === 'day') {
      return selectedDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }

    if (calendarView === 'week') {
      const start = weekDays[0]
      const end = weekDays[6]
      const sameYear = start.getFullYear() === end.getFullYear()
      const sameMonth = sameYear && start.getMonth() === end.getMonth()

      if (sameMonth) {
        const month = start.toLocaleDateString(undefined, { month: 'short' })
        return `${month} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
      }

      if (sameYear) {
        const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return `${startLabel} – ${endLabel}, ${end.getFullYear()}`
      }

      const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      return `${startLabel} – ${endLabel}`
    }

    return formatMonthYear(currentMonth)
  })()

  const closeCalendarDetails = () => {
    setSelectedEvent(null)
    setDetailsDate(null)
  }

  const openEventDetails = (event: Event) => {
    setDetailsDate(null)
    setSelectedEvent(event)
  }

  const openDayDetails = (date: Date) => {
    updateSelectedDate(date)
    setSelectedEvent(null)
    setDetailsDate(date)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      date: toDateKey(selectedDate),
    })
    setFormOpen(true)
  }

  const closeEventForm = () => {
    clearFormState()
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const openEdit = (event: Event) => {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      date: toDateKey(start),
      startTime: toTimeInput(start),
      endTime: toTimeInput(end),
      audienceMode: (event.target_user_ids?.length ?? 0) > 0 ? 'people' : 'role',
      audience: fromRoleScopePayload(event.audience_scope, event.audience_scope_mode),
      selectedUserIds: event.target_user_ids ?? [],
      trackAttendance: event.track_attendance ?? false,
      codeHasExpiry: Boolean(event.code_expires_at),
      eventCategory: event.event_category ?? '',
      eventType: event.event_type ?? '',
      customEventType: event.custom_event_type ?? '',
      pointValue: event.point_value?.toString() ?? '',
      deliverableEnabled: Boolean(event.deliverable_point_value),
      deliverableTitle: event.deliverable_title ?? '',
      deliverableDescription: event.deliverable_description ?? '',
      deliverablePointValue: event.deliverable_point_value?.toString() ?? '0.5',
      deliverableDueDate: event.deliverable_due_at ? toDateKey(new Date(event.deliverable_due_at)) : '',
      repeatEnabled: false,
      repeatInterval: '1',
      repeatUnit: 'week',
      repeatWeekdays: [],
      repeatCount: '4',
    })
    setFormOpen(true)
  }

  const combineDateTime = (dateStr: string, timeStr: string) => {
    const [year, month, day] = dateStr.split('-').map((v) => Number(v))
    const [hour, minute] = timeStr.split(':').map((v) => Number(v))
    return new Date(year, month - 1, day, hour, minute)
  }

  const generateAttendanceCode = () => {
    // Generate a random 6-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude ambiguous characters
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const addMonthsClamped = (value: Date, months: number) => {
    const date = new Date(value)
    const targetMonth = date.getMonth() + months
    const year = date.getFullYear() + Math.floor(targetMonth / 12)
    const month = ((targetMonth % 12) + 12) % 12
    const day = date.getDate()
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(
      year,
      month,
      Math.min(day, lastDay),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    )
  }

  const buildRecurringDates = (
    start: Date,
    end: Date,
    count: number,
    rule: { interval: number; unit: 'week' | 'month'; weekdays: number[] }
  ) => {
    const occurrences: Array<{ start: Date; end: Date }> = []
    if (count <= 0) return occurrences

    const durationMs = end.getTime() - start.getTime()

    if (rule.unit === 'month') {
      for (let i = 0; i < count; i++) {
        const occStart = addMonthsClamped(start, i * rule.interval)
        const occEnd = new Date(occStart.getTime() + durationMs)
        occurrences.push({ start: occStart, end: occEnd })
      }
      return occurrences
    }

    const weekdays = rule.weekdays.length > 0 ? rule.weekdays : [start.getDay()]
    let cursor = new Date(start)
    let safeguard = 0
    while (occurrences.length < count && safeguard < 2000) {
      const diffDays = Math.floor((cursor.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
      const weeksSinceStart = Math.floor(diffDays / 7)
      if (weeksSinceStart % rule.interval === 0 && weekdays.includes(cursor.getDay())) {
        const occStart = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          start.getHours(),
          start.getMinutes(),
          start.getSeconds(),
          start.getMilliseconds()
        )
        const occEnd = new Date(occStart.getTime() + durationMs)
        occurrences.push({ start: occStart, end: occEnd })
      }
      cursor.setDate(cursor.getDate() + 1)
      safeguard += 1
    }
    return occurrences
  }

  const openDuplicate = (event: Event) => {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    setEditingId(null)
    setFormOpen(true)
    setForm({
      title: event.title ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      date: toDateKey(start),
      startTime: toTimeInput(start),
      endTime: toTimeInput(end),
      audienceMode: (event.target_user_ids?.length ?? 0) > 0 ? 'people' : 'role',
      audience: fromRoleScopePayload(event.audience_scope, event.audience_scope_mode),
      selectedUserIds: event.target_user_ids ?? [],
      trackAttendance: Boolean(event.track_attendance),
      codeHasExpiry: Boolean(event.code_expires_at),
      eventCategory: event.event_category ?? '',
      eventType: event.event_type ?? '',
      customEventType: event.custom_event_type ?? '',
      pointValue: event.point_value?.toString() ?? '',
      deliverableEnabled: Boolean(event.deliverable_point_value),
      deliverableTitle: event.deliverable_title ?? '',
      deliverableDescription: event.deliverable_description ?? '',
      deliverablePointValue: event.deliverable_point_value?.toString() ?? '0.5',
      // A duplicated event's own date shifts, so a copied absolute due date
      // would silently point at the wrong week - leave it for the admin to
      // set again on the new date instead of carrying over a stale one.
      deliverableDueDate: '',
      repeatEnabled: false,
      repeatInterval: '1',
      repeatUnit: 'week',
      repeatWeekdays: [],
      repeatCount: '4',
    })
  }

  // Handle category change
  const handleCategoryChange = (category: EventCategory | '') => {
    setForm((prev) => ({
      ...prev,
      eventCategory: category,
      eventType: '', // Reset type when category changes
      customEventType: '',
      pointValue: '',
    }))
  }

  // Handle event type change and auto-fill points
  const handleEventTypeChange = (type: EventType | '') => {
    const defaultPoints = type ? getDefaultPoints(type as EventType) : null
    setForm((prev) => ({
      ...prev,
      eventType: type,
      pointValue: defaultPoints !== null ? defaultPoints.toString() : prev.pointValue,
      customEventType: type === 'other' ? prev.customEventType : '',
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSyncNotice(null)
    if (!profile) return
    if (!form.date || !form.startTime) return
    if (form.audienceMode === 'people' && form.selectedUserIds.length === 0) {
      setError('Please select at least one member.')
      return
    }

    // Validate point value if attendance tracking is enabled
    if (form.trackAttendance && (!form.pointValue || isNaN(Number(form.pointValue)) || Number(form.pointValue) < 0)) {
      setError('Please enter a valid point value (0 or greater)')
      return
    }

    // The deliverable task is created at check-in time, so it only makes
    // sense alongside attendance tracking.
    const deliverableActive = form.trackAttendance && form.deliverableEnabled
    if (deliverableActive && (!form.deliverablePointValue || isNaN(Number(form.deliverablePointValue)) || Number(form.deliverablePointValue) <= 0)) {
      setError('Please enter a valid deliverable point value (greater than 0)')
      return
    }
    if (deliverableActive && !form.deliverableDueDate) {
      setError('Please choose a due date for the deliverable')
      return
    }

    const start = combineDateTime(form.date, form.startTime)
    const end = form.endTime
      ? combineDateTime(form.date, form.endTime)
      : new Date(start.getTime() + 60 * 60 * 1000)

    const existingEvent = editingId ? events.find((event) => event.id === editingId) : null

    const scopePayload = toRoleScopePayload(form.audience)

    const basePayload: any = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      created_by: profile.id,
      audience_scope: form.audienceMode === 'role' ? scopePayload.roleScope : null,
      audience_scope_mode: form.audienceMode === 'role' ? scopePayload.roleScopeMode : null,
      target_user_ids: form.audienceMode === 'people' ? form.selectedUserIds : null,
      track_attendance: form.trackAttendance,
      point_value: form.trackAttendance ? Number(form.pointValue) : 0,
      event_category: form.eventCategory || null,
      event_type: form.eventType || null,
      custom_event_type: (form.eventType === 'other' && form.customEventType) ? form.customEventType : null,
      is_recurring: !editingId && form.repeatEnabled,
      max_occurrences: !editingId && form.repeatEnabled ? Number(form.repeatCount || 1) : null,
      deliverable_title: deliverableActive ? form.deliverableTitle.trim() || null : null,
      deliverable_description: deliverableActive ? form.deliverableDescription.trim() || null : null,
      deliverable_point_value: deliverableActive ? Number(form.deliverablePointValue) : null,
      deliverable_due_at: deliverableActive ? new Date(`${form.deliverableDueDate}T23:59:00`).toISOString() : null,
      ...(schemaReady && access?.term_id && !editingId ? { term_id: access.term_id, archived_at: null } : {}),
    }

    try {
      if (editingId) {
        const minimumExpiryFromNow = new Date(Date.now() + 5 * 60 * 1000)
        const codeExpiryFromEnd = new Date(end.getTime() + 5 * 60 * 1000)
        const codeExpiresAt = codeExpiryFromEnd > minimumExpiryFromNow ? codeExpiryFromEnd : minimumExpiryFromNow
        const payload = {
          ...basePayload,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          attendance_code: form.trackAttendance
            ? (existingEvent?.attendance_code ?? generateAttendanceCode())
            : null,
          code_expires_at: form.trackAttendance
            ? (form.codeHasExpiry ? codeExpiresAt.toISOString() : null)
            : null,
        }
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error

        // Check-in copies the event's point value into attendance_records at
        // that moment (see /api/attendance/check-in) rather than reading it
        // live, so correcting the value here otherwise leaves everyone who
        // already used the code stuck on the old amount. This runs through a
        // server route under the service role rather than a direct client
        // update - row-level security does not grant a bulk cross-user
        // update on attendance_records from a regular session, and that
        // failure is silent (0 rows matched, no error), which is exactly
        // what happened the first time this shipped.
        if (form.trackAttendance && existingEvent && existingEvent.point_value !== basePayload.point_value) {
          const syncResponse = await fetch('/api/events/sync-attendance-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: editingId, pointValue: basePayload.point_value }),
          })
          const syncResult = await syncResponse.json().catch(() => null)
          if (!syncResponse.ok) throw new Error(syncResult?.error || 'Could not update already-checked-in members.')
          if (syncResult?.updatedCount > 0) {
            setSyncNotice(`Updated points for ${syncResult.updatedCount} member${syncResult.updatedCount === 1 ? '' : 's'} who already checked in to this event.`)
          }
        }
      } else {
        const repeatCount = Math.max(1, Math.min(52, Number(form.repeatCount || 1)))
        const repeatInterval = Math.max(1, Math.min(12, Number(form.repeatInterval || 1)))
        const occurrences = form.repeatEnabled
          ? buildRecurringDates(start, end, repeatCount, {
              interval: repeatInterval,
              unit: form.repeatUnit,
              weekdays: form.repeatWeekdays,
            })
          : [{ start, end }]
        const payloads = occurrences.map(({ start: occStart, end: occEnd }) => {
          const minimumExpiryFromNow = new Date(Date.now() + 5 * 60 * 1000)
          const codeExpiryFromEnd = new Date(occEnd.getTime() + 5 * 60 * 1000)
          const codeExpiresAt = codeExpiryFromEnd > minimumExpiryFromNow ? codeExpiryFromEnd : minimumExpiryFromNow
          return {
            ...basePayload,
            start_at: occStart.toISOString(),
            end_at: occEnd.toISOString(),
            attendance_code: form.trackAttendance ? generateAttendanceCode() : null,
            code_expires_at: form.trackAttendance
              ? (form.codeHasExpiry ? codeExpiresAt.toISOString() : null)
              : null,
          }
        })
        const { error } = await supabase
          .from('events')
          .insert(payloads)
        if (error) throw error
      }

      clearFormState()
      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchEvents()
    } catch (err: any) {
      console.error('Error saving event', err)
      setError('Failed to save event. You may not have permission.')
    }
  }

  const handleDelete = async (eventId: string) => {
    const confirmDelete = window.confirm('Archive this event? It will remain in semester history.')
    if (!confirmDelete) return false

    try {
      const { error } = schemaReady
        ? await (supabase as any).from('events').update({ archived_at: new Date().toISOString() }).eq('id', eventId)
        : await supabase.from('events').delete().eq('id', eventId)
      if (error) throw error
      await fetchEvents()
      return true
    } catch (err: any) {
      console.error('Error deleting event', err)
      setError('Failed to delete event. You may not have permission.')
      return false
    }
  }

  const addToGoogleCalendar = (event: Event) => {
    const startDate = new Date(event.start_at)
    const endDate = new Date(event.end_at)
    const googleCalendarTitle = /^bosso\b/i.test(event.title) ? event.title : `BOSSO ${event.title}`

    // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '')
    }

    // Add note about checking portal for updates in the description
    const descriptionWithNote = event.description
      ? `${event.description}\n\n⚠️ Note: If this event is updated or cancelled, please check the BOSSO portal for the latest information.`
      : '⚠️ Note: If this event is updated or cancelled, please check the BOSSO portal for the latest information.'

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: googleCalendarTitle,
      dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
      details: descriptionWithNote,
      location: event.location || '',
    })

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`
    window.open(googleCalendarUrl, '_blank')
  }

  const sendCalendarInvites = async (eventId: string) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return

    try {
      const { recipients, termName } = await resolveCommunicationRecipients({
        roleScope: event.audience_scope,
        roleScopeMode: event.audience_scope_mode,
        targetUserIds: event.target_user_ids,
      })
      if (recipients.length === 0) {
        alert('No approved members in the current semester match this audience.')
        return
      }

      // Get list of email addresses for BCC
      const bccEmails = recipients.map((recipient) => recipient.email).join(',')

      // Format dates for Google Calendar link
      const startDate = new Date(event.start_at)
      const endDate = new Date(event.end_at)
      const googleCalendarTitle = /^bosso\b/i.test(event.title) ? event.title : `BOSSO ${event.title}`

      const formatGoogleDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '')
      }

      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(googleCalendarTitle)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`

      // Create email subject and body
      const subject = encodeURIComponent(`BOSSO Event: ${event.title}`)
      const emailBody = encodeURIComponent(`Come join us at our BOSSO event!

Event: ${event.title}
Location: ${event.location || 'TBA'}
Time: ${startDate.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
${event.description ? `\nNotes: ${event.description}\n` : ''}
Add to your calendar: ${calendarUrl}

View on portal: ${window.location.origin}/calendar`)

      // Open Gmail compose with BCC
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccEmails)}&su=${subject}&body=${emailBody}`

      window.open(gmailUrl, '_blank')
    } catch (error) {
      console.error('Error preparing calendar invite email:', error)
      alert(error instanceof Error ? error.message : 'Failed to prepare calendar invite. Please try again.')
    }
  }

  const renderEventDetailCard = (event: Event, showTitle = true) => (
    <article key={event.id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="space-y-4 p-4 sm:p-5">
        {showTitle && <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>}

        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{new Date(event.start_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {new Date(event.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–
              {new Date(event.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          {event.location && (
            <div className="flex min-w-0 items-start gap-2.5 sm:col-span-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            Audience: {event.target_user_ids?.length
              ? `${event.target_user_ids.length} selected member(s)`
              : getRoleScopeLabel(event.audience_scope, event.audience_scope_mode)}
          </span>
          {event.track_attendance && (
            <span className="badge-success rounded-full px-2.5 py-1 text-xs font-medium">
              ✓ Attendance: {event.point_value} pts
              {canAccessAttendanceCode(event) && (
                <span className="ml-2 font-mono text-[10px]">({event.attendance_code})</span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => addToGoogleCalendar(event)}
          className="portal-icon-button h-11 w-11"
          title="Add to Google Calendar"
          aria-label="Add to Google Calendar"
        >
          <Calendar className="h-5 w-5" />
        </button>
        {(isUserAdmin || event.created_by === profile?.id) && (
          <button
            type="button"
            onClick={() => sendCalendarInvites(event.id)}
            className="portal-icon-button h-11 w-11"
            title="Email calendar invite"
            aria-label="Email calendar invite"
          >
            <Mail className="h-5 w-5" />
          </button>
        )}
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => {
                closeCalendarDetails()
                openEdit(event)
              }}
              className="portal-icon-button h-11 w-11"
              title="Edit event"
              aria-label="Edit event"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                closeCalendarDetails()
                openDuplicate(event)
              }}
              className="portal-icon-button h-11 w-11"
              title="Duplicate event"
              aria-label="Duplicate event"
            >
              <CheckSquare className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await handleDelete(event.id)) closeCalendarDetails()
              }}
              className="portal-icon-button h-11 w-11 text-destructive hover:text-destructive"
              title="Archive event"
              aria-label="Archive event"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </article>
  )


  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Organization"
        title="Events & Calendar"
        note={(
          <span className="inline-flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 font-medium text-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>Google Calendar copies do not update automatically. Check the portal for changes or cancellations.</span>
          </span>
        )}
        icon={CalendarDays}
        actions={canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="portal-button"
          >
            <PlusCircle className="w-4 h-4" />
            New event
          </button>
        ) : undefined}
      />

      {error && (
        <div className="portal-alert-error">{error}</div>
      )}

      {syncNotice && (
        <div className="portal-alert-success flex items-start justify-between gap-3">
          <span>{syncNotice}</span>
          <button type="button" onClick={() => setSyncNotice(null)} className="portal-icon-button shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="space-y-6">
        <section className="portal-panel space-y-5 overflow-hidden">
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <h2 className="min-w-0 text-lg font-semibold text-foreground lg:order-2 lg:text-center xl:text-xl">
              {calendarTitle}
            </h2>

            <div className="flex items-center gap-2 lg:order-1">
              <button type="button" onClick={goToToday} className="portal-button-secondary small">
                Today
              </button>
              <button
                type="button"
                onClick={() => navigateCalendar(-1)}
                className="portal-icon-button"
                aria-label={`Previous ${calendarView}`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateCalendar(1)}
                className="portal-icon-button"
                aria-label={`Next ${calendarView}`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div
              className="grid w-full grid-cols-3 rounded-xl border border-border bg-muted/40 p-1 lg:order-3 lg:w-auto lg:justify-self-end"
              role="group"
              aria-label="Calendar view"
            >
              {(['day', 'week', 'month'] as CalendarView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => changeCalendarView(view)}
                  aria-pressed={calendarView === view}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors sm:text-sm ${
                    calendarView === view
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {calendarView === 'month' && (
            <div className="space-y-2">
              <div className="grid min-w-0 grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs sm:tracking-widest">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-2 text-center">
                    <span className="sm:hidden">{day.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </div>
                ))}
              </div>

              <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2 lg:gap-3">
                {daysInGrid.map((day) => {
                  const key = toDateKey(day)
                  const eventsForDay = eventsByDay.get(key) ?? []
                  const tasksForDay = tasksByDay.get(key) ?? []
                  const totalItems = eventsForDay.length + tasksForDay.length
                  const isOutside = day.getMonth() !== currentMonth.getMonth()
                  const isToday = key === toDateKey(new Date())
                  const displayItems: { type: 'event' | 'task'; id: string; title: string }[] = [
                    ...eventsForDay.map((event) => ({ type: 'event' as const, id: event.id, title: event.title })),
                    ...tasksForDay.map((task) => ({ type: 'task' as const, id: task.id, title: task.title })),
                  ].slice(0, 2)

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openDayDetails(day)}
                      aria-label={`Open schedule for ${day.toLocaleDateString()}`}
                      className={`flex min-h-16 min-w-0 flex-col justify-start rounded-lg border border-border p-1.5 text-left transition sm:min-h-[110px] sm:rounded-xl sm:p-3 md:min-h-[130px] lg:min-h-[150px] ${
                        isToday
                          ? 'border-primary/50 bg-primary/10 ring-2 ring-primary/10'
                          : 'bg-card hover:border-primary/40 hover:bg-muted/30'
                      } ${isOutside ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`shrink-0 whitespace-nowrap text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {day.getDate()}
                        </span>
                        {totalItems > 0 && (
                          <span className="hidden items-center text-primary sm:inline-flex" title="Open day details">
                            <Info className="h-3 w-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1 sm:hidden">
                        <div className="flex flex-wrap gap-1" aria-hidden="true">
                          {displayItems.map((item) => (
                            <span
                              key={`dot-${item.type}-${item.id}`}
                              className={`h-1.5 w-1.5 rounded-full ${item.type === 'task' ? 'bg-destructive' : 'bg-primary'}`}
                            />
                          ))}
                        </div>
                        {totalItems > 0 && (
                          <Info className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </div>
                      <div className="mt-3 hidden space-y-1 sm:block">
                        {displayItems.map((item) => (
                          <span
                            key={`${item.type}-${item.id}`}
                            className={`block truncate rounded-md px-2 py-1 text-[11px] ${
                              item.type === 'task'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {item.title}
                          </span>
                        ))}
                        {totalItems > 2 && (
                          <span className="block text-[11px] text-muted-foreground">+{totalItems - 2} more</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {calendarView === 'week' && (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-2xl border border-border bg-card">
                {weekDays.map((day) => {
                  const key = toDateKey(day)
                  const eventsForDay = eventsByDay.get(key) ?? []
                  const tasksForDay = tasksByDay.get(key) ?? []
                  const isToday = key === toDateKey(new Date())
                  const items = [
                    ...eventsForDay.map((event) => ({
                      kind: 'event' as const,
                      id: event.id,
                      title: event.title,
                      date: new Date(event.start_at),
                      event,
                    })),
                    ...tasksForDay.map((task) => ({
                      kind: 'task' as const,
                      id: task.id,
                      title: task.title,
                      date: new Date(task.due_at as string),
                    })),
                  ].sort((first, second) => first.date.getTime() - second.date.getTime())

                  return (
                    <div
                      key={key}
                      className={`min-w-0 border-r border-border last:border-r-0 ${isToday ? 'bg-primary/[0.045]' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updateSelectedDate(day)
                          changeCalendarView('day')
                        }}
                        aria-label={`Open day view for ${day.toLocaleDateString()}`}
                        className="flex w-full flex-col items-center gap-1 border-b border-border px-2 py-3 text-center transition-colors hover:bg-muted/40"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                        }`}>
                          {day.getDate()}
                        </span>
                      </button>

                      <div className="min-h-[360px] space-y-2 p-2">
                        {items.length === 0 && (
                          <span className="block py-4 text-center text-[11px] text-muted-foreground/70">Open</span>
                        )}
                        {items.map((item) => item.kind === 'event' ? (
                          <button
                            key={`week-event-${item.id}`}
                            type="button"
                            onClick={() => {
                              updateSelectedDate(day)
                              openEventDetails(item.event)
                            }}
                            aria-label={`View details for ${item.title}`}
                            className="block w-full rounded-lg border border-primary/20 bg-primary/10 px-2 py-2 text-left transition hover:border-primary/40 hover:bg-primary/15"
                          >
                            <span className="flex items-center justify-between gap-1 text-[10px] font-semibold text-primary">
                              <span>{item.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-4 text-foreground">{item.title}</span>
                          </button>
                        ) : (
                          <a
                            key={`week-task-${item.id}`}
                            href="/tasks"
                            className="block rounded-lg border border-destructive/20 bg-destructive/10 px-2 py-2 transition hover:border-destructive/40 hover:bg-destructive/15"
                          >
                            <span className="block text-[10px] font-semibold text-destructive">
                              Due {item.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-4 text-foreground">{item.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {calendarView === 'day' && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily schedule</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedScheduleItems.length} {selectedScheduleItems.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                {canManage && (
                  <button type="button" onClick={openCreate} className="portal-button-secondary small">
                    <PlusCircle className="h-4 w-4" />
                    Add event
                  </button>
                )}
              </div>

              {loading ? (
                <div className="portal-loading min-h-40">Loading schedule...</div>
              ) : selectedScheduleItems.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-foreground">Nothing scheduled</p>
                  <p className="mt-1 text-xs text-muted-foreground">This day is clear.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedScheduleItems.map((item) => (
                    <div key={`day-${item.kind}-${item.id}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:px-5">
                      <div className="pt-1 text-right text-xs font-semibold text-muted-foreground">
                        {item.kind === 'event'
                          ? item.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                          : `Due ${item.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                      </div>
                      {item.kind === 'event' ? (
                        <button
                          type="button"
                          onClick={() => openEventDetails(item.event)}
                          aria-label={`View details for ${item.title}`}
                          className="min-w-0 rounded-xl border-l-4 border-primary bg-primary/[0.07] px-4 py-3 text-left transition hover:bg-primary/10"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-foreground">{item.title}</span>
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {item.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–
                              {new Date(item.event.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            {item.event.location && <span>{item.event.location}</span>}
                          </div>
                        </button>
                      ) : (
                        <a
                          href="/tasks"
                          className="min-w-0 rounded-xl border-l-4 border-destructive bg-destructive/[0.07] px-4 py-3 transition hover:bg-destructive/10"
                        >
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">Open this action item</p>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {selectedEvent && (
            <div className="portal-modal-backdrop" onMouseDown={closeCalendarDetails}>
              <div className="portal-modal max-w-2xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="portal-form-header">
                  <div className="min-w-0">
                    <p className="portal-eyebrow">Event details</p>
                    <h2 className="break-words">{selectedEvent.title}</h2>
                    <p>Review the schedule, audience, and available event actions.</p>
                  </div>
                  <button type="button" onClick={closeCalendarDetails} className="portal-icon-button shrink-0" aria-label="Close event details">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {renderEventDetailCard(selectedEvent, false)}
              </div>
            </div>
          )}

          {detailsDate && (
            <div className="portal-modal-backdrop" onMouseDown={closeCalendarDetails}>
              <div className="portal-modal max-w-3xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="portal-form-header">
                  <div className="min-w-0">
                    <p className="portal-eyebrow">Day schedule</p>
                    <h2>{detailsDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                    <p>
                      {detailsEvents.length} {detailsEvents.length === 1 ? 'event' : 'events'}
                      {detailsTasks.length > 0 ? ` · ${detailsTasks.length} ${detailsTasks.length === 1 ? 'task' : 'tasks'} due` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={closeCalendarDetails} className="portal-icon-button shrink-0" aria-label="Close day schedule">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-5">
                  {detailsEvents.length === 0 && detailsTasks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                      <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-medium text-foreground">Nothing scheduled</p>
                      <p className="mt-1 text-xs text-muted-foreground">This day is clear.</p>
                    </div>
                  )}

                  {detailsEvents.map((event) => renderEventDetailCard(event))}

                  {detailsTasks.length > 0 && (
                    <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-destructive" />
                        <h3 className="font-semibold text-foreground">Tasks due</h3>
                      </div>
                      {detailsTasks.map((task) => (
                        <a
                          key={task.id}
                          href="/tasks"
                          className="block rounded-xl border border-border bg-card p-3 transition-colors hover:border-destructive/40 hover:bg-muted/30"
                        >
                          <p className="text-sm font-semibold text-foreground">{task.title}</p>
                          {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                        </a>
                      ))}
                    </section>
                  )}
                </div>
              </div>
            </div>
          )}

          {formOpen && canManage && (
            <div className="portal-modal-backdrop" onMouseDown={closeEventForm}>
              <div className="portal-modal max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="portal-form-header">
                  <div><p className="portal-eyebrow">{editingId ? 'Edit event' : 'New event'}</p><h2>{editingId ? 'Update the event' : 'Schedule an event'}</h2><p>Start with the schedule and audience. Points and recurrence stay optional.</p></div>
                  <button type="button" onClick={closeEventForm} className="portal-icon-button"><X className="h-5 w-5" /></button>
                </div>

              <form onSubmit={handleSave} className="space-y-5">
                <section className="portal-form-section">
                  <div className="portal-form-section-heading"><span>1</span><div><h3>Event basics</h3><p>What is happening, when, and where?</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="portal-label">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    required
                    className="portal-input w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="portal-label">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    required
                    className="portal-input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <div className="space-y-1">
                    <label className="portal-label">Start time</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      required
                      className="portal-input w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="portal-label">End time</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="portal-input w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="portal-label">Location <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter location..."
                    className="portal-input w-full"
                  />
                </div>
                  </div>
                </section>

                <section className="portal-form-section">
                  <div className="portal-form-section-heading"><span>2</span><div><h3>Audience</h3><p>Choose approved members from this semester.</p></div></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, audienceMode: 'role' }))}
                      className={`portal-choice-card ${form.audienceMode === 'role' ? 'selected' : ''}`}
                    >
                      <span><strong className="block text-sm">Position group</strong><span className="mt-1 block text-xs text-muted-foreground">Target a position level.</span></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, audienceMode: 'people' }))}
                      className={`portal-choice-card ${form.audienceMode === 'people' ? 'selected' : ''}`}
                    >
                      <span><strong className="block text-sm">People or custom group</strong><span className="mt-1 block text-xs text-muted-foreground">Search names or choose a semester team.</span></span>
                    </button>
                  </div>
                  <div className="mt-4">
                  {form.audienceMode === 'role' ? (
                    <select
                      value={form.audience}
                      onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as any }))}
                      className="portal-input w-full"
                    >
                      <option value="all">All BOSSO members</option>
                      <option value="general_member">General Members only</option>
                      <option value="analyst">Analysts and above</option>
                      <option value="analyst_only">Analysts only</option>
                      <option value="project_manager">PMs and Board</option>
                      <option value="board_member">Board only</option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <MemberGroupPicker
                        users={peopleOptions}
                        groups={memberGroups}
                        value={form.selectedUserIds}
                        onChange={(selectedUserIds) => setForm((prev) => ({ ...prev, selectedUserIds }))}
                        placeholder="Search approved current-semester members..."
                      />
                    </div>
                  )}
                  </div>
                </section>

                <section className="portal-form-section">
                  <div className="portal-form-section-heading"><span>3</span><div><h3>Details and points</h3><p>Add context and optionally connect the event to attendance points.</p></div></div>
                <div className="space-y-1">
                  <label className="portal-label">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="portal-input w-full resize-none"
                  />
                </div>

                {/* Event Category Selection */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" />
                    Event Category
                  </label>
                  <select
                    value={form.eventCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as EventCategory | '')}
                    className="portal-input w-full"
                  >
                    <option value="">Select Category (Optional)</option>
                    {Object.entries(EVENT_CATEGORIES).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label} ({info.maxPoints}+ pts possible)
                      </option>
                    ))}
                  </select>
                  {form.eventCategory && (
                    <p className="text-xs text-muted-foreground">
                      {EVENT_CATEGORIES[form.eventCategory as EventCategory].description}
                    </p>
                  )}
                </div>

                {/* Event Type Selection */}
                {form.eventCategory && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Event Type
                    </label>
                    <select
                      value={form.eventType}
                      onChange={(e) => handleEventTypeChange(e.target.value as EventType | '')}
                      className="portal-input w-full"
                    >
                      <option value="">Select Event Type (Optional)</option>
                      {getEventTypesByCategory(form.eventCategory as EventCategory).map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} {type.points !== null && `(${type.points} pts)`}
                        </option>
                      ))}
                    </select>
                    {form.eventType && form.eventType !== 'other' && (
                      <p className="text-xs text-muted-foreground">
                        {getEventTypesByCategory(form.eventCategory as EventCategory).find(t => t.value === form.eventType)?.description}
                      </p>
                    )}
                  </div>
                )}
                </div>

                {/* Custom Event Type Input (for "Other") */}
                {form.eventType === 'other' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Custom Event Type Name</label>
                    <input
                      type="text"
                      value={form.customEventType}
                      onChange={(e) => setForm((prev) => ({ ...prev, customEventType: e.target.value }))}
                      placeholder="e.g., Board Retreat, Alumni Panel"
                      className="portal-input w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a custom name for this event type
                    </p>
                  </div>
                )}

                <div className="mt-5 space-y-3 border-t border-border pt-5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="trackAttendance"
                      checked={form.trackAttendance}
                      onChange={(e) => setForm((prev) => ({ ...prev, trackAttendance: e.target.checked, pointValue: e.target.checked ? prev.pointValue : '' }))}
                      className="w-4 h-4 rounded border-primary/20 bg-dark-100 text-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <label htmlFor="trackAttendance" className="text-sm text-foreground font-medium cursor-pointer">
                      Track attendance for this event
                    </label>
                  </div>

                  {form.trackAttendance && (
                    <div className="space-y-1 ml-7">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Point Value</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.pointValue}
                        onChange={(e) => setForm((prev) => ({ ...prev, pointValue: e.target.value }))}
                        placeholder="e.g. 5"
                        required={form.trackAttendance}
                        className="portal-input w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Points members will earn for attending this event
                      </p>

                      <div className="flex items-center gap-3 pt-2">
                        <input
                          type="checkbox"
                          id="codeHasExpiry"
                          checked={form.codeHasExpiry}
                          onChange={(e) => setForm((prev) => ({ ...prev, codeHasExpiry: e.target.checked }))}
                          className="w-4 h-4 rounded border-primary/20 bg-dark-100 text-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <label htmlFor="codeHasExpiry" className="text-sm text-foreground font-medium cursor-pointer">
                          Attendance code expires after event
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {form.codeHasExpiry
                          ? 'Code expires 5 minutes after event end (or 5 minutes from now when reactivating past events).'
                          : 'Code never expires until attendance tracking is turned off.'}
                      </p>

                      <div className="flex items-center gap-3 pt-4 mt-2 border-t border-border/60">
                        <input
                          type="checkbox"
                          id="deliverableEnabled"
                          checked={form.deliverableEnabled}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setForm((prev) => {
                              if (!checked) return { ...prev, deliverableEnabled: false }
                              let defaultDue = prev.deliverableDueDate
                              if (!defaultDue && prev.date) {
                                const [y, m, d] = prev.date.split('-').map(Number)
                                defaultDue = toDateKey(new Date(y, m - 1, d + 7))
                              }
                              return { ...prev, deliverableEnabled: true, deliverableDueDate: defaultDue }
                            })
                          }}
                          className="w-4 h-4 rounded border-primary/20 bg-dark-100 text-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <label htmlFor="deliverableEnabled" className="text-sm text-foreground font-medium cursor-pointer">
                          Add a deliverable due after this event
                        </label>
                      </div>

                      {form.deliverableEnabled && (
                        <div className="space-y-3 ml-7">
                          <p className="text-xs text-muted-foreground">
                            Given as a task the moment someone checks in - only people who actually attended will get it. It still needs manual review and approval, just like any other task, before points are awarded.
                          </p>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">Deliverable title (optional)</label>
                            <input
                              type="text"
                              value={form.deliverableTitle}
                              onChange={(e) => setForm((prev) => ({ ...prev, deliverableTitle: e.target.value }))}
                              placeholder={`${form.title || 'Workshop'} - Deliverable`}
                              className="portal-input w-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">Instructions (optional)</label>
                            <textarea
                              value={form.deliverableDescription}
                              onChange={(e) => setForm((prev) => ({ ...prev, deliverableDescription: e.target.value }))}
                              rows={2}
                              placeholder="What should they submit?"
                              className="portal-input w-full"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground uppercase tracking-wide">Deliverable points</label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.deliverablePointValue}
                                onChange={(e) => setForm((prev) => ({ ...prev, deliverablePointValue: e.target.value }))}
                                required={form.deliverableEnabled}
                                className="portal-input w-full"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground uppercase tracking-wide">Due date</label>
                              <input
                                type="date"
                                value={form.deliverableDueDate}
                                onChange={(e) => setForm((prev) => ({ ...prev, deliverableDueDate: e.target.value }))}
                                required={form.deliverableEnabled}
                                className="portal-input w-full"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </section>

                {!editingId && (
                  <section className="portal-form-section">
                    <div className="portal-form-section-heading"><span>4</span><div><h3>Repeat <span className="font-normal text-muted-foreground">(optional)</span></h3><p>Create a recurring series with unique attendance codes.</p></div></div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="repeatEnabled"
                        checked={form.repeatEnabled}
                        onChange={(e) => setForm((prev) => ({ ...prev, repeatEnabled: e.target.checked }))}
                        className="w-4 h-4 rounded border-primary/20 bg-dark-100 text-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <label htmlFor="repeatEnabled" className="text-sm text-foreground font-medium cursor-pointer">
                        Repeat this event
                      </label>
                    </div>

                    {form.repeatEnabled && (
                      <div className="space-y-3 ml-7">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">Repeat every</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="12"
                                value={form.repeatInterval}
                                onChange={(e) => setForm((prev) => ({ ...prev, repeatInterval: e.target.value }))}
                                className="portal-input w-20"
                              />
                              <select
                                value={form.repeatUnit}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    repeatUnit: e.target.value as EventFormState['repeatUnit'],
                                  }))
                                }
                                className="portal-input flex-1"
                              >
                                <option value="week">Week(s)</option>
                                <option value="month">Month(s)</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">Occurrences</label>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              value={form.repeatCount}
                              onChange={(e) => setForm((prev) => ({ ...prev, repeatCount: e.target.value }))}
                              className="portal-input w-full"
                            />
                          </div>
                        </div>

                        {form.repeatUnit === 'week' && (
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">Repeat on</label>
                            <div className="flex flex-wrap gap-2">
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => (
                                <button
                                  type="button"
                                  key={label}
                                  onClick={() =>
                                    setForm((prev) => {
                                      const exists = prev.repeatWeekdays.includes(index)
                                      const next = exists
                                        ? prev.repeatWeekdays.filter((day) => day !== index)
                                        : [...prev.repeatWeekdays, index]
                                      return { ...prev, repeatWeekdays: next }
                                    })
                                  }
                                  className={`px-2 py-1 rounded-md text-xs border ${
                                    form.repeatWeekdays.includes(index)
                                      ? 'bg-primary/20 text-primary border-primary/40'
                                      : 'bg-dark-100 text-muted-foreground border-primary/20'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              If none selected, the event repeats on the start day.
                            </p>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Each occurrence will generate a unique attendance code.
                        </p>
                      </div>
                    )}
                  </div>
                  </section>
                )}

                <div className="portal-form-actions"><button type="button" onClick={closeEventForm} className="portal-button-secondary justify-center">Cancel</button><button type="submit" className="portal-button justify-center"><CalendarDays className="h-4 w-4" /> {editingId ? 'Save changes' : 'Create event'}</button></div>
              </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
