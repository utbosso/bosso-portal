'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import type { AttendanceRecord, Event } from '@/types/database.types'
import UserSearch, { type UserOption } from '@/components/UserSearch'
import SectionPageHeader from '@/components/SectionPageHeader'
import { fetchCurrentMemberDirectory } from '@/lib/communication-recipients'
import {
  ClipboardCheck,
  ShieldCheck,
  Search,
  Users,
  Download,
  Filter,
  Plus,
  Minus,
  X,
  Trash2,
  LayoutList,
  CalendarDays,
} from 'lucide-react'

const supabase = createClient()

type AttendanceWithEvent = AttendanceRecord & {
  event?: Pick<Event, 'id' | 'title' | 'start_at' | 'point_value'>
}

type PointsAdjustment = {
  id: string
  user_id: string
  adjusted_by: string
  points: number
  reason: string | null
  created_at: string
}

type AttendanceHistoryItem = {
  id: string
  type: 'event' | 'adjustment'
  title: string
  points: number
  timestamp: string
  reason?: string | null
}

type MemberStats = {
  user_id: string
  full_name: string
  email: string
  role: string
  total_points: number
  events_attended: number
  attendance_rate: number
}

type EventStats = {
  event_id: string
  title: string
  start_at: string
  point_value: number
  total_attendees: number
  attendee_names: string[]
}

export default function AttendancePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id, authLoading)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Admin views
  const [viewMode, setViewMode] = useState<'members' | 'events'>('members')
  const [memberStats, setMemberStats] = useState<MemberStats[]>([])
  const [eventStats, setEventStats] = useState<EventStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [memberAttendance, setMemberAttendance] = useState<AttendanceWithEvent[]>([])
  const [memberHistory, setMemberHistory] = useState<AttendanceHistoryItem[]>([])
  const [eventAttendees, setEventAttendees] = useState<any[]>([])
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  // Manual adjustment
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false)
  const [adjustmentUser, setAdjustmentUser] = useState('')
  const [adjustmentPoints, setAdjustmentPoints] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentCategory, setAdjustmentCategory] = useState<'' | 'membership' | 'professional_education' | 'social' | 'philanthropy'>('')
  const [adjustmentType, setAdjustmentType] = useState<'event' | 'other'>('other')
  const [adjustmentEvent, setAdjustmentEvent] = useState('')
  const [allEvents, setAllEvents] = useState<Event[]>([])

  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  useEffect(() => {
    if (profile && !accessLoading && isUserAdmin) {
      fetchAdminData()
    }
  }, [profile, isUserAdmin, access?.term_id, schemaReady, accessLoading])


  const fetchAdminData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/attendance?view=members')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load attendance data.')
      setMemberStats(result.memberStats || [])
    } catch (err: any) {
      console.error('Error fetching admin data:', err)
      setError(err.message || 'Failed to load attendance data.')
    } finally {
      setLoading(false)
    }
  }

  const fetchEventStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/attendance?view=events')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load event stats.')
      setEventStats(result.eventStats || [])
    } catch (err: any) {
      console.error('Error fetching event stats:', err)
      setError(err.message || 'Failed to load event stats.')
    } finally {
      setLoading(false)
    }
  }

  const fetchMemberAttendance = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/attendance?view=member-history&userId=${encodeURIComponent(userId)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load member attendance.')
      const attendance = result.attendance || []
      const adjustments = result.adjustments || []

      setMemberAttendance((attendance as AttendanceWithEvent[]) || [])

      // Create combined history
      const history: AttendanceHistoryItem[] = [
        // Add event attendance
        ...(attendance || []).map((record: any) => ({
          id: record.id,
          type: 'event' as const,
          title: record.event?.title || 'Unknown Event',
          points: record.points_earned || 0,
          timestamp: record.checked_in_at,
          reason: null
        })),
        // Add manual adjustments
        ...(adjustments || []).map((adj: any) => ({
          id: adj.id,
          type: 'adjustment' as const,
          title: adj.reason?.startsWith('Task completion:')
            ? 'Task Points Awarded'
            : adj.points > 0
            ? 'Manual Points Added'
            : 'Manual Points Deducted',
          points: adj.points,
          timestamp: adj.created_at,
          reason: adj.reason
        }))
      ]

      // Sort by timestamp (most recent first)
      history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setMemberHistory(history)
    } catch (err: any) {
      console.error('Error fetching member attendance:', err)
      setError('Failed to load member attendance.')
    }
  }

  const handleDeletePointsRecord = async (item: AttendanceHistoryItem) => {
    if (!isUserAdmin) return
    if (!selectedMember) return

    const label = item.type === 'event' ? 'attendance record' : 'points adjustment'
    const confirmed = window.confirm(`Delete this ${label}? This will remove its points impact.`)
    if (!confirmed) return

    setDeletingRecordId(item.id)
    try {
      const type = item.type === 'event' ? 'attendance' : 'adjustment'
      const response = await fetch(`/api/admin/attendance?type=${type}&id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Delete blocked by permissions or record not found.')

      await fetchAdminData()
      await fetchMemberAttendance(selectedMember)
    } catch (err: any) {
      console.error('Error deleting points record:', err)
      setError(err.message || 'Failed to delete points record.')
    } finally {
      setDeletingRecordId(null)
    }
  }

  const handleRemoveEventAttendee = async (attendanceRecordId: string) => {
    if (!isUserAdmin || !selectedEvent) return

    const confirmed = window.confirm('Remove this attendee from the event? This will remove event points.')
    if (!confirmed) return

    setDeletingRecordId(attendanceRecordId)
    try {
      const response = await fetch(`/api/admin/attendance?type=attendance&id=${encodeURIComponent(attendanceRecordId)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Delete blocked by permissions or record not found.')

      await fetchAdminData()
      await fetchEventStats()
      await fetchEventAttendees(selectedEvent)
    } catch (err: any) {
      console.error('Error removing attendee:', err)
      setError(err.message || 'Failed to remove attendee.')
    } finally {
      setDeletingRecordId(null)
    }
  }

  const fetchEventAttendees = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/attendance?view=event-attendees&eventId=${encodeURIComponent(eventId)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load event attendees.')
      setEventAttendees(result.attendees || [])
    } catch (err: any) {
      console.error('Error fetching event attendees:', err)
      setError('Failed to load event attendees.')
    }
  }


  const fetchAllEvents = async () => {
    try {
      let eventsQuery: any = supabase
        .from('events')
        .select('id, title, start_at, point_value, track_attendance, event_category, term_id')
      if (schemaReady && access?.term_id) {
        eventsQuery = eventsQuery.eq('term_id', access.term_id).is('archived_at', null)
      }
      const { data, error } = await eventsQuery.order('start_at', { ascending: false }).limit(50)

      if (error) throw error
      setAllEvents((data as Event[]) || [])
    } catch (err: any) {
      console.error('Error fetching events:', err)
    }
  }

  const handlePointsAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !adjustmentUser || !adjustmentPoints) return
    if (!memberStats.some((member) => member.user_id === adjustmentUser)) {
      setError('Select a member approved for the current semester.')
      return
    }

    // Validate based on adjustment type
    if (adjustmentType === 'event' && !adjustmentEvent) {
      setError('Please select an event.')
      return
    }
    if (adjustmentType === 'other' && !adjustmentReason) {
      setError('Please provide a reason for the adjustment.')
      return
    }
    if (adjustmentType === 'other' && !adjustmentCategory) {
      setError('Please select a category for this manual adjustment.')
      return
    }

    const points = Number(adjustmentPoints)
    if (isNaN(points)) {
      setError('Please enter a valid number for points.')
      return
    }

    try {
      if (adjustmentType === 'event') {
        // Create an attendance record for the event
        const selectedEvent = allEvents.find(e => e.id === adjustmentEvent)
        if (!selectedEvent) {
          setError('Selected event not found.')
          return
        }

        // Check if user already has attendance record for this event
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('event_id', adjustmentEvent)
          .eq('user_id', adjustmentUser)
          .single()

        if (existing) {
          setError('User already has an attendance record for this event.')
          return
        }

        // Create attendance record
        const { error: attendanceError } = await supabase
          .from('attendance_records')
          .insert({
            event_id: adjustmentEvent,
            user_id: adjustmentUser,
            points_earned: points,
            event_category: selectedEvent.event_category || null,
            term_id: (selectedEvent as any).term_id ?? null,
          })

        if (attendanceError) throw attendanceError
      } else {
        // Create a points adjustment (manual)
        const { error } = await supabase
          .from('points_adjustments')
          .insert({
            user_id: adjustmentUser,
            adjusted_by: profile.id,
            points,
            reason: `${adjustmentReason.trim()} (${adjustmentCategory})`,
            ...(access?.term_id ? { term_id: access.term_id } : {}),
          })

        if (error) throw error
      }

      setShowAdjustmentForm(false)
      setAdjustmentUser('')
      setAdjustmentPoints('')
      setAdjustmentReason('')
      setAdjustmentCategory('')
      setAdjustmentType('other')
      setAdjustmentEvent('')
      await fetchAdminData()
    } catch (err: any) {
      console.error('Error adjusting points:', err)
      setError('Failed to adjust points.')
    }
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Total Points', 'Events Attended', 'Attendance Rate (%)']
    const rows = filteredStats.map(stat => [
      stat.full_name,
      stat.email,
      stat.role.replace('_', ' '),
      stat.total_points,
      stat.events_attended,
      stat.attendance_rate.toFixed(1),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bosso-attendance-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredStats = useMemo(() => {
    if (!searchQuery) return memberStats
    const query = searchQuery.toLowerCase()
    return memberStats.filter(stat =>
      stat.full_name.toLowerCase().includes(query) ||
      stat.email.toLowerCase().includes(query)
    )
  }, [memberStats, searchQuery])

  const filteredEventStats = useMemo(() => {
    if (!searchQuery) return eventStats
    const query = searchQuery.toLowerCase()
    return eventStats.filter(stat =>
      stat.title.toLowerCase().includes(query)
    )
  }, [eventStats, searchQuery])

  if (!profile) return null

  // Admin-only page. Members check in from the dashboard and view their points at /points.
  if (!isUserAdmin) {
    return (
      <div className="portal-page">
        <div className="portal-empty">
          <ShieldCheck className="h-8 w-8" />
          <h1>Administrator access only</h1>
          <p>Attendance management is restricted to the portal administrator.</p>
        </div>
      </div>
    )
  }

  // Admin View
  return (
    <div className="portal-page max-w-7xl space-y-6">
      <SectionPageHeader
        eyebrow="Admin"
        title="Attendance management"
        description="Review attendance records, export results, and make documented point adjustments."
        icon={ClipboardCheck}
        actions={<>
          <button
            onClick={() => {
              setShowAdjustmentForm(true)
              fetchAllEvents()
            }}
            className="portal-button"
          >
            <Plus className="w-4 h-4" />
            Adjust Points
          </button>
          <button
            onClick={exportToCSV}
            className="portal-button-secondary"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </>}
      />

      {error && (
        <div className="portal-alert-error">
          {error}
        </div>
      )}

      {/* View Toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => {
            setViewMode('members')
            setSearchQuery('')
            if (memberStats.length === 0) fetchAdminData()
          }}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            viewMode === 'members'
              ? 'bg-primary text-dark-300'
              : 'border border-primary/30 text-primary hover:bg-primary/10'
          }`}
        >
          <Users className="w-4 h-4" />
          By Member
        </button>
        <button
          onClick={() => {
            setViewMode('events')
            setSearchQuery('')
            if (eventStats.length === 0) fetchEventStats()
          }}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            viewMode === 'events'
              ? 'bg-primary text-dark-300'
              : 'border border-primary/30 text-primary hover:bg-primary/10'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          By Event
        </button>
      </div>

      {/* Points Adjustment Form */}
      {showAdjustmentForm && (
        <div className="portal-modal-backdrop">
        <div className="portal-modal max-w-2xl">
          <div className="portal-form-header">
            <div><p className="portal-eyebrow">Attendance admin</p><h2>Award points to a member</h2><p>Connect the adjustment to an event or document why a manual change is needed.</p></div>
            <button
              onClick={() => {
                setShowAdjustmentForm(false)
                setAdjustmentUser('')
                setAdjustmentPoints('')
                setAdjustmentReason('')
                setAdjustmentCategory('')
                setAdjustmentType('other')
                setAdjustmentEvent('')
              }}
              className="portal-icon-button"
              aria-label="Close adjustment form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handlePointsAdjustment} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Member</label>
              <UserSearch
                users={memberStats.map((stat): UserOption => ({
                  id: stat.user_id,
                  full_name: stat.full_name,
                  email: stat.email,
                  role: stat.role,
                }))}
                value={adjustmentUser}
                onChange={(value) => setAdjustmentUser(value as string)}
                placeholder="Search approved current-semester members..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Includes everyone approved for the semester, even while they are still working toward point minimums.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Adjustment Type</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`portal-choice-card ${adjustmentType === 'event' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="event"
                    checked={adjustmentType === 'event'}
                    onChange={() => {
                      setAdjustmentType('event')
                      setAdjustmentReason('')
                    }}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-foreground">Event attendance</span>
                </label>
                <label className={`portal-choice-card ${adjustmentType === 'other' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="other"
                    checked={adjustmentType === 'other'}
                    onChange={() => {
                      setAdjustmentType('other')
                      setAdjustmentEvent('')
                    }}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-foreground">Other manual adjustment</span>
                </label>
              </div>
            </div>

            {adjustmentType === 'event' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Event</label>
                <select
                  value={adjustmentEvent}
                  onChange={(e) => {
                    setAdjustmentEvent(e.target.value)
                    const event = allEvents.find(ev => ev.id === e.target.value)
                    if (event && event.point_value) {
                      setAdjustmentPoints(event.point_value.toString())
                    }
                  }}
                  required
                  className="portal-input w-full bg-dark-100"
                >
                  <option value="">Select event...</option>
                  {allEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.start_at).toLocaleDateString()}
                      {event.point_value ? ` (${event.point_value} pts)` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This will create an attendance record for the selected event
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Points {adjustmentType === 'event' ? '' : '(use negative for deduction)'}
              </label>
              <input
                type="number"
                step="any"
                value={adjustmentPoints}
                onChange={(e) => setAdjustmentPoints(e.target.value)}
                placeholder={adjustmentType === 'event' ? 'Auto-filled from event' : 'e.g. 5 or -5'}
                required
                className="portal-input w-full bg-dark-100"
              />
            </div>

            {adjustmentType === 'other' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
                <select
                  value={adjustmentCategory}
                  onChange={(e) => setAdjustmentCategory(e.target.value as typeof adjustmentCategory)}
                  required
                  className="portal-input mb-3 w-full bg-dark-100"
                >
                  <option value="">Select category...</option>
                  <option value="membership">Membership</option>
                  <option value="professional_education">Professional / Education</option>
                  <option value="social">Social</option>
                  <option value="philanthropy">Philanthropy</option>
                </select>
                <label className="text-sm font-medium text-foreground mb-2 block">Reason</label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Why are you adjusting points?"
                  required
                  rows={3}
                  className="portal-input w-full resize-none bg-dark-100"
                />
              </div>
            )}

            <div className="portal-form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustmentForm(false)
                  setAdjustmentUser('')
                  setAdjustmentPoints('')
                  setAdjustmentReason('')
                  setAdjustmentCategory('')
                  setAdjustmentType('other')
                  setAdjustmentEvent('')
                }}
                className="portal-button-secondary justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="portal-button justify-center"
              >
                Apply adjustment
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Search */}
      <div className="portal-panel">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'members' ? 'Search members by name or email...' : 'Search events by title...'}
            className="portal-input w-full bg-dark-100 pl-10"
          />
        </div>
      </div>

      {/* Member Stats Table */}
      {viewMode === 'members' && (
      <div className="portal-panel overflow-hidden p-0 sm:p-0">
        <div className="divide-y divide-border md:hidden">
          {loading ? <div className="portal-loading min-h-32">Loading member data...</div> : filteredStats.length === 0 ? <div className="portal-empty compact">No members found</div> : filteredStats.map((stat) => (
            <article key={`mobile-${stat.user_id}`} className="space-y-4 p-4">
              <div className="min-w-0"><p className="font-semibold text-foreground">{stat.full_name}</p><p className="break-all text-xs text-muted-foreground">{stat.email}</p></div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center"><div><p className="text-lg font-semibold text-primary">{stat.total_points}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Points</p></div><div><p className="text-lg font-semibold">{stat.events_attended}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Events</p></div><div><p className="text-lg font-semibold">{stat.attendance_rate.toFixed(1)}%</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate</p></div></div>
              <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">{stat.role.replace('_', ' ')}</span><button onClick={() => { setSelectedMember(stat.user_id); fetchMemberAttendance(stat.user_id) }} className="portal-button-secondary small">View details</button></div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/10">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Events
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                    Loading member data...
                  </td>
                </tr>
              ) : filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                    No members found
                  </td>
                </tr>
              ) : (
                filteredStats.map((stat) => (
                  <tr key={stat.user_id} className="hover:bg-dark-200/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-foreground">{stat.full_name}</p>
                        <p className="text-xs text-muted-foreground">{stat.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {stat.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-primary">{stat.total_points}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-foreground">{stat.events_attended}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-foreground">{stat.attendance_rate.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setSelectedMember(stat.user_id)
                          fetchMemberAttendance(stat.user_id)
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Event Stats Table */}
      {viewMode === 'events' && (
      <div className="portal-panel overflow-hidden p-0 sm:p-0">
        <div className="divide-y divide-border md:hidden">
          {loading ? <div className="portal-loading min-h-32">Loading event data...</div> : filteredEventStats.length === 0 ? <div className="portal-empty compact">No events found</div> : filteredEventStats.map((stat) => (
            <article key={`mobile-${stat.event_id}`} className="space-y-4 p-4">
              <div><p className="font-semibold text-foreground">{stat.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(stat.start_at).toLocaleDateString()}</p></div>
              <div className="flex items-center justify-between gap-3"><div className="flex gap-4 text-sm"><span><strong>{stat.point_value}</strong> pts</span><span><strong>{stat.total_attendees}</strong> attendees</span></div><button onClick={() => { setSelectedEvent(stat.event_id); fetchEventAttendees(stat.event_id) }} className="portal-button-secondary small">View details</button></div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/10">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Attendees
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">
                    Loading event data...
                  </td>
                </tr>
              ) : filteredEventStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">
                    No events found
                  </td>
                </tr>
              ) : (
                filteredEventStats.map((stat) => (
                  <tr key={stat.event_id} className="hover:bg-dark-200/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-foreground">{stat.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.total_attendees} {stat.total_attendees === 1 ? 'attendee' : 'attendees'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-foreground">
                        {new Date(stat.start_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-primary">{stat.point_value} pts</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-foreground">{stat.total_attendees}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setSelectedEvent(stat.event_id)
                          fetchEventAttendees(stat.event_id)
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal max-w-2xl p-0 lg:p-0">
            <div className="sticky top-0 bg-dark-200 border-b border-primary/10 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {memberStats.find(s => s.user_id === selectedMember)?.full_name}'s Attendance
              </h2>
              <button
                onClick={() => {
                  setSelectedMember(null)
                  setMemberAttendance([])
                }}
                className="p-2 text-muted-foreground hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {memberHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records</p>
              ) : (
                memberHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start justify-between p-4 rounded-lg border ${
                      item.type === 'event'
                        ? 'bg-dark-300/50 border-primary/10'
                        : item.points > 0
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        {item.type === 'adjustment' && (
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium uppercase tracking-wide ${
                            item.points > 0
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            Manual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                      {item.reason && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Reason: {item.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        item.points > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {item.points > 0 ? '+' : ''}{item.points} pts
                      </p>
                      <button
                        onClick={() => handleDeletePointsRecord(item)}
                        disabled={deletingRecordId === item.id}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingRecordId === item.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal max-w-2xl p-0 lg:p-0">
            <div className="sticky top-0 bg-dark-200 border-b border-primary/10 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {eventStats.find(s => s.event_id === selectedEvent)?.title} - Attendees
              </h2>
              <button
                onClick={() => {
                  setSelectedEvent(null)
                  setEventAttendees([])
                }}
                className="p-2 text-muted-foreground hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {eventAttendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees yet</p>
              ) : (
                eventAttendees.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-dark-300/50 border border-primary/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{record.user?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.user?.email} • {record.user?.role?.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Checked in: {new Date(record.checked_in_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">+{record.points_earned} pts</p>
                      <button
                        onClick={() => handleRemoveEventAttendee(record.id)}
                        disabled={deletingRecordId === record.id}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingRecordId === record.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
