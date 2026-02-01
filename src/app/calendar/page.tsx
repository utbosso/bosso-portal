'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Event, UserRole, EventCategory, EventType, Task } from '@/types/database.types'
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
  AlertCircle,
  Mail,
  Folder,
  Tag,
  CheckSquare,
} from 'lucide-react'
import { isAdmin } from '@/lib/admin'

const supabase = createClient()

type EventFormState = {
  title: string
  description: string
  location: string
  date: string
  startTime: string
  endTime: string
  audience: UserRole | 'all'
  trackAttendance: boolean
  eventCategory: EventCategory | ''
  eventType: EventType | ''
  customEventType: string
  pointValue: string
}

const emptyForm: EventFormState = {
  title: '',
  description: '',
  location: '',
  date: '',
  startTime: '',
  endTime: '',
  audience: 'all',
  trackAttendance: false,
  eventCategory: '',
  eventType: '',
  customEventType: '',
  pointValue: '',
}

export default function CalendarPage() {
  const { profile, hasMinimumRole } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())

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
          return JSON.parse(saved)
        } catch {
          return emptyForm
        }
      }
    }
    return emptyForm
  })

  const canManage = hasMinimumRole('project_manager')
  const isUserAdmin = isAdmin(profile?.role)

  const roleHierarchy: Record<UserRole, number> = useMemo(
    () => ({
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
      admin: 5,
    }),
    []
  )

  const canSeeEvent = (item: Event) => {
    if (!item.audience_scope) return true
    if (!profile) return false
    return roleHierarchy[profile.role] >= roleHierarchy[item.audience_scope]
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
    setLoading(true)
    setError(null)
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })

      if (eventsError) throw eventsError
      const rows = (eventsData as Event[]) ?? []
      setEvents(rows.filter(canSeeEvent))

      // Fetch tasks assigned to current user with due dates
      if (profile?.id) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', profile.id)
          .not('due_at', 'is', null)
          .neq('status', 'completed')
          .order('due_at', { ascending: true })

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
  }, [profile?.role])

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

  // Helper function to clear form state from sessionStorage
  const clearFormState = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('calendarFormOpen')
      sessionStorage.removeItem('calendarEditingId')
      sessionStorage.removeItem('calendarForm')
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      date: toDateKey(selectedDate),
    })
    setFormOpen(true)
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
      startTime: start.toTimeString().slice(0, 5),
      endTime: end.toTimeString().slice(0, 5),
      audience: event.audience_scope ?? 'all',
      trackAttendance: event.track_attendance ?? false,
      eventCategory: event.event_category ?? '',
      eventType: event.event_type ?? '',
      customEventType: event.custom_event_type ?? '',
      pointValue: event.point_value?.toString() ?? '',
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
    if (!profile) return
    if (!form.date || !form.startTime) return

    // Validate point value if attendance tracking is enabled
    if (form.trackAttendance && (!form.pointValue || isNaN(Number(form.pointValue)) || Number(form.pointValue) < 0)) {
      setError('Please enter a valid point value (0 or greater)')
      return
    }

    const start = combineDateTime(form.date, form.startTime)
    const end = form.endTime
      ? combineDateTime(form.date, form.endTime)
      : new Date(start.getTime() + 60 * 60 * 1000)

    // Calculate code expiration time (5 minutes after event ends)
    const codeExpiresAt = new Date(end.getTime() + 5 * 60 * 1000)

    const payload: any = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      created_by: profile.id,
      audience_scope: form.audience === 'all' ? null : form.audience,
      track_attendance: form.trackAttendance,
      point_value: form.trackAttendance ? Number(form.pointValue) : 0,
      attendance_code: form.trackAttendance ? generateAttendanceCode() : null,
      code_expires_at: form.trackAttendance ? codeExpiresAt.toISOString() : null,
      event_category: form.eventCategory || null,
      event_type: form.eventType || null,
      custom_event_type: (form.eventType === 'other' && form.customEventType) ? form.customEventType : null,
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('events')
          .insert(payload)
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
    const confirmDelete = window.confirm('Delete this event? This cannot be undone.')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
      if (error) throw error
      await fetchEvents()
    } catch (err: any) {
      console.error('Error deleting event', err)
      setError('Failed to delete event. You may not have permission.')
    }
  }

  const addToGoogleCalendar = (event: Event) => {
    const startDate = new Date(event.start_at)
    const endDate = new Date(event.end_at)

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
      text: event.title,
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
      // Fetch all eligible users based on audience_scope
      let query = supabase
        .from('profiles')
        .select('email, full_name, role')
        .eq('account_status', 'active')

      const { data: users, error } = await query

      if (error) throw error

      // Filter users based on role hierarchy
      let eligibleUsers = users || []
      if (event.audience_scope) {
        const minRoleLevel = roleHierarchy[event.audience_scope as UserRole]
        eligibleUsers = users?.filter(u =>
          roleHierarchy[u.role as UserRole] >= minRoleLevel
        ) || []
      }

      // Get list of email addresses for BCC
      const bccEmails = eligibleUsers.map(u => u.email).join(',')

      // Format dates for Google Calendar link
      const startDate = new Date(event.start_at)
      const endDate = new Date(event.end_at)

      const formatGoogleDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '')
      }

      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`

      // Create email subject and body
      const subject = encodeURIComponent(`BOSSO Event: ${event.title}`)
      const emailBody = encodeURIComponent(`Come join us at our BOSSO event!

Event: ${event.title}
Location: ${event.location || 'TBA'}
Time: ${startDate.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}

${event.description || ''}

Add to your calendar: ${calendarUrl}

View on portal: ${window.location.origin}/calendar`)

      // Open Gmail compose with BCC
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccEmails)}&su=${subject}&body=${emailBody}`

      window.open(gmailUrl, '_blank')
    } catch (error) {
      console.error('Error preparing calendar invite email:', error)
      alert('Failed to prepare calendar invite. Please try again.')
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            Calendar
          </h1>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
          >
            <PlusCircle className="w-4 h-4" />
            New event
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.8fr]">
        <div className="card-glow p-6 space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {formatMonthYear(currentMonth)}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-xs uppercase text-muted-foreground tracking-widest">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {daysInGrid.map((day) => {
              const key = toDateKey(day)
              const eventsForDay = eventsByDay.get(key) ?? []
              const tasksForDay = tasksByDay.get(key) ?? []
              const totalItems = eventsForDay.length + tasksForDay.length
              const isOutside = day.getMonth() !== currentMonth.getMonth()
              const isSelected = key === selectedKey
              const isToday = key === toDateKey(new Date())

              // Combine events and tasks for display, showing up to 2 items
              const displayItems: { type: 'event' | 'task'; id: string; title: string }[] = [
                ...eventsForDay.map(e => ({ type: 'event' as const, id: e.id, title: e.title })),
                ...tasksForDay.map(t => ({ type: 'task' as const, id: t.id, title: t.title })),
              ].slice(0, 2)

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col justify-start rounded-xl border border-primary/10 p-3 text-left transition min-h-[110px] md:min-h-[130px] lg:min-h-[150px] ${
                    isSelected ? 'bg-primary/15 border-primary/40' : 'hover:border-primary/40'
                  } ${isOutside ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {day.getDate()}
                    </span>
                    {totalItems > 0 && (
                      <span className="text-[10px] text-primary font-semibold">
                        {totalItems}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    {displayItems.map((item) => (
                      <span
                        key={`${item.type}-${item.id}`}
                        className={`block truncate rounded-md px-2 py-1 text-[11px] ${
                          item.type === 'task'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-orange-500/10 text-orange-400'
                        }`}
                      >
                        {item.title}
                      </span>
                    ))}
                    {totalItems > 2 && (
                      <span className="block text-[11px] text-muted-foreground">
                        +{totalItems - 2} more
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-glow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Events on {selectedDate.toLocaleDateString()}
              </h3>
              {canManage && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-sm text-primary hover:bg-primary/10"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add
                </button>
              )}
            </div>

            {!loading && selectedEvents.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Events added to your Google calendar won't auto-update. Check back here for any changes or cancellations.
                </p>
              </div>
            )}

            {loading && (
              <p className="text-sm text-muted-foreground">Loading events...</p>
            )}

            {!loading && selectedEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            )}

            {!loading && selectedEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-primary/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(event.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addToGoogleCalendar(event)}
                      className="p-2 rounded-md text-primary hover:bg-primary/10"
                      title="Add to Google Calendar"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    {(isUserAdmin || event.created_by === profile?.id) && (
                      <button
                        type="button"
                        onClick={() => sendCalendarInvites(event.id)}
                        className="p-2 rounded-md text-green-400 hover:bg-green-500/10"
                        title="Send Calendar Invites to Members"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="p-2 rounded-md text-primary hover:bg-primary/10"
                          title="Edit Event"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide">
                  <span className="text-primary">
                    Visible to {event.audience_scope ? event.audience_scope.replace('_', ' ') : 'all members'}
                  </span>
                  {event.track_attendance && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                      ✓ Attendance: {event.point_value} pts
                      {canAccessAttendanceCode(event) && (
                        <span className="ml-2 text-[10px] font-mono">({event.attendance_code})</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tasks Section */}
          {selectedTasks.length > 0 && (
            <div className="card-glow p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-semibold text-foreground">
                  Tasks Due
                </h3>
              </div>

              {selectedTasks.map((task) => (
                <a
                  key={task.id}
                  href="/tasks"
                  className="block rounded-lg border border-red-500/20 p-3 space-y-2 hover:border-red-500/40 transition-colors"
                >
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  )}
                </a>
              ))}
            </div>
          )}

          {formOpen && canManage && (
            <div className="card-glow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingId ? 'Edit event' : 'Create event'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    clearFormState()
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
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Start time</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">End time</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter location..."
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Audience</label>
                  <select
                    value={form.audience}
                    onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
                  >
                    <option value="all">All BOSSO members</option>
                    <option value="general_member">General Members only</option>
                    <option value="analyst">Analysts and above</option>
                    <option value="project_manager">PMs and Board</option>
                    <option value="board_member">Board only</option>
                  </select>
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

                {/* Event Category Selection */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" />
                    Event Category
                  </label>
                  <select
                    value={form.eventCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as EventCategory | '')}
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

                {/* Custom Event Type Input (for "Other") */}
                {form.eventType === 'other' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Custom Event Type Name</label>
                    <input
                      type="text"
                      value={form.customEventType}
                      onChange={(e) => setForm((prev) => ({ ...prev, customEventType: e.target.value }))}
                      placeholder="e.g., Board Retreat, Alumni Panel"
                      className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a custom name for this event type
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-primary/10">
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
                        step="1"
                        value={form.pointValue}
                        onChange={(e) => setForm((prev) => ({ ...prev, pointValue: e.target.value }))}
                        placeholder="e.g. 5"
                        required={form.trackAttendance}
                        className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="text-xs text-muted-foreground">
                        Points members will earn for attending this event
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
                >
                  {editingId ? 'Save changes' : 'Create event'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
