'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Event, UserRole } from '@/types/database.types'
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
} from 'lucide-react'

const supabase = createClient()

type EventFormState = {
  title: string
  description: string
  location: string
  date: string
  startTime: string
  endTime: string
  audience: UserRole | 'all'
}

const emptyForm: EventFormState = {
  title: '',
  description: '',
  location: '',
  date: '',
  startTime: '',
  endTime: '',
  audience: 'all',
}

export default function CalendarPage() {
  const { profile, hasMinimumRole } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyForm)

  const canManage = hasMinimumRole('project_manager')

  const roleHierarchy: Record<UserRole, number> = useMemo(
    () => ({
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
    }),
    []
  )

  const canSeeEvent = (item: Event) => {
    if (!item.audience_scope) return true
    if (!profile) return false
    return roleHierarchy[profile.role] >= roleHierarchy[item.audience_scope]
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
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })

      if (error) throw error
      const rows = (data as Event[]) ?? []
      setEvents(rows.filter(canSeeEvent))
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

  const selectedKey = toDateKey(selectedDate)
  const selectedEvents = eventsByDay.get(selectedKey) ?? []

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
    })
    setFormOpen(true)
  }

  const combineDateTime = (dateStr: string, timeStr: string) => {
    const [year, month, day] = dateStr.split('-').map((v) => Number(v))
    const [hour, minute] = timeStr.split(':').map((v) => Number(v))
    return new Date(year, month - 1, day, hour, minute)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!form.date || !form.startTime) return

    const start = combineDateTime(form.date, form.startTime)
    const end = form.endTime
      ? combineDateTime(form.date, form.endTime)
      : new Date(start.getTime() + 60 * 60 * 1000)

    const payload = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      created_by: profile.id,
      audience_scope: form.audience === 'all' ? null : form.audience,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            BOSSO Calendar
          </h1>
          <p className="text-muted-foreground text-sm">
            Track upcoming events, meetings, and deadlines.
          </p>
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
              const isOutside = day.getMonth() !== currentMonth.getMonth()
              const isSelected = key === selectedKey
              const isToday = key === toDateKey(new Date())
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
                    {eventsForDay.length > 0 && (
                      <span className="text-[10px] text-primary font-semibold">
                        {eventsForDay.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    {eventsForDay.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="block truncate rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary"
                      >
                        {event.title}
                      </span>
                    ))}
                    {eventsForDay.length > 2 && (
                      <span className="block text-[11px] text-muted-foreground">
                        +{eventsForDay.length - 2} more
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

            {loading && (
              <p className="text-sm text-muted-foreground">Loading events...</p>
            )}

            {!loading && selectedEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            )}

            {!loading && selectedEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-primary/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="p-2 rounded-md text-primary hover:bg-primary/10"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(event.id)}
                        className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}

                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-primary">
                  <span>
                    Visible to {event.audience_scope ? event.audience_scope.replace('_', ' ') : 'all members'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {formOpen && canManage && (
            <div className="card-glow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingId ? 'Edit event' : 'Create event'}
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
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground"
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
