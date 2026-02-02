'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { isAdmin } from '@/lib/admin'
import { ROLE_REQUIREMENTS } from '@/lib/membership-tiers'
import type { AttendanceRecord, Event, Profile } from '@/types/database.types'
import CategoryPointsBreakdown from '@/components/CategoryPointsBreakdown'
import {
  ClipboardCheck,
  Trophy,
  Calendar,
  CheckCircle2,
  QrCode,
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
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkInCode, setCheckInCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInSuccess, setCheckInSuccess] = useState(false)

  // Member stats
  const [myAttendance, setMyAttendance] = useState<AttendanceWithEvent[]>([])
  const [myAdjustments, setMyAdjustments] = useState<PointsAdjustment[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryItem[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [eventsAttended, setEventsAttended] = useState(0)

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

  const isUserAdmin = isAdmin(profile?.role)

  useEffect(() => {
    if (profile) {
      if (isUserAdmin) {
        fetchAdminData()
      } else {
        fetchMemberData()
      }
    }
  }, [profile, isUserAdmin])

  const fetchMemberData = async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    try {
      // Fetch user's attendance records
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          event:events(id, title, start_at, point_value)
        `)
        .eq('user_id', profile.id)
        .order('checked_in_at', { ascending: false })

      if (attendanceError) throw attendanceError

      setMyAttendance((attendance as AttendanceWithEvent[]) || [])
      setEventsAttended(attendance?.length || 0)

      // Calculate total points from attendance
      const attendancePoints = (attendance || []).reduce((sum, record) => sum + (record.points_earned || 0), 0)

      // Fetch manual adjustments
      const { data: adjustments, error: adjustError } = await supabase
        .from('points_adjustments')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (adjustError) throw adjustError

      setMyAdjustments((adjustments as PointsAdjustment[]) || [])

      const adjustmentPoints = (adjustments || []).reduce((sum, adj) => sum + adj.points, 0)

      setTotalPoints(attendancePoints + adjustmentPoints)

      // Create combined attendance history
      const history: AttendanceHistoryItem[] = [
        // Add event attendance
        ...(attendance || []).map(record => ({
          id: record.id,
          type: 'event' as const,
          title: record.event?.title || 'Unknown Event',
          points: record.points_earned || 0,
          timestamp: record.checked_in_at,
          reason: null
        })),
        // Add manual adjustments
        ...(adjustments || []).map(adj => ({
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

      setAttendanceHistory(history)
    } catch (err: any) {
      console.error('Error fetching member data:', err)
      setError('Failed to load attendance data.')
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')

      if (usersError) {
        console.error('Error fetching users:', usersError)
        throw new Error(`Failed to fetch users: ${usersError.message}`)
      }

      // Fetch all attendance records
      const { data: allAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('user_id, points_earned')

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError)
        throw new Error(`Failed to fetch attendance: ${attendanceError.message}`)
      }

      // Fetch all adjustments
      const { data: allAdjustments, error: adjustError } = await supabase
        .from('points_adjustments')
        .select('user_id, points')

      if (adjustError) {
        console.error('Error fetching adjustments:', adjustError)
        throw new Error(`Failed to fetch adjustments: ${adjustError.message}`)
      }

      // Fetch total events with attendance tracking
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('track_attendance', true)

      if (eventsError) {
        console.error('Error fetching events:', eventsError)
        throw new Error(`Failed to fetch events: ${eventsError.message}`)
      }

      const totalEvents = events?.length || 0

      // Calculate stats for each user
      const stats: MemberStats[] = (users || []).map(user => {
        const userAttendance = (allAttendance || []).filter(a => a.user_id === user.id)
        const userAdjustments = (allAdjustments || []).filter(a => a.user_id === user.id)

        const attendancePoints = userAttendance.reduce((sum, a) => sum + (a.points_earned || 0), 0)
        const adjustmentPoints = userAdjustments.reduce((sum, a) => sum + a.points, 0)
        const eventsAttended = userAttendance.length
        const attendanceRate = totalEvents > 0 ? (eventsAttended / totalEvents) * 100 : 0

        return {
          user_id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          total_points: attendancePoints + adjustmentPoints,
          events_attended: eventsAttended,
          attendance_rate: attendanceRate,
        }
      })

      setMemberStats(stats)
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
      // Fetch all events with attendance tracking
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_at, point_value')
        .eq('track_attendance', true)
        .order('start_at', { ascending: false })

      if (eventsError) {
        console.error('Error fetching events:', eventsError)
        throw new Error(`Failed to fetch events: ${eventsError.message}`)
      }

      // Fetch all attendance records with user info
      const { data: allAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          event_id,
          user:profiles(full_name)
        `)

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError)
        throw new Error(`Failed to fetch attendance: ${attendanceError.message}`)
      }

      // Calculate stats for each event
      const stats: EventStats[] = (events || []).map(event => {
        const attendees = (allAttendance || []).filter(a => a.event_id === event.id)
        const attendeeNames = attendees.map((a: any) => a.user?.full_name || 'Unknown').filter(Boolean)

        return {
          event_id: event.id,
          title: event.title,
          start_at: event.start_at,
          point_value: event.point_value || 0,
          total_attendees: attendees.length,
          attendee_names: attendeeNames,
        }
      })

      setEventStats(stats)
    } catch (err: any) {
      console.error('Error fetching event stats:', err)
      setError(err.message || 'Failed to load event stats.')
    } finally {
      setLoading(false)
    }
  }

  const fetchMemberAttendance = async (userId: string) => {
    try {
      // Fetch attendance records
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          event:events(id, title, start_at, point_value)
        `)
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })

      if (attendanceError) throw attendanceError

      setMemberAttendance((attendance as AttendanceWithEvent[]) || [])

      // Fetch manual adjustments
      const { data: adjustments, error: adjustError } = await supabase
        .from('points_adjustments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (adjustError) throw adjustError

      // Create combined history
      const history: AttendanceHistoryItem[] = [
        // Add event attendance
        ...(attendance || []).map(record => ({
          id: record.id,
          type: 'event' as const,
          title: record.event?.title || 'Unknown Event',
          points: record.points_earned || 0,
          timestamp: record.checked_in_at,
          reason: null
        })),
        // Add manual adjustments
        ...(adjustments || []).map(adj => ({
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
      if (item.type === 'event') {
        const { data, error } = await supabase
          .from('attendance_records')
          .delete()
          .eq('id', item.id)
          .select('id')

        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Delete blocked by permissions or record not found.')
        }
      } else {
        const { data, error } = await supabase
          .from('points_adjustments')
          .delete()
          .eq('id', item.id)
          .select('id')

        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Delete blocked by permissions or record not found. Run the points_adjustments delete policy migration.')
        }
      }

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
      const { data, error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', attendanceRecordId)
        .select('id')

      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete blocked by permissions or record not found.')
      }

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
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          user:profiles(id, full_name, email, role)
        `)
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })

      if (error) throw error

      setEventAttendees(data || [])
    } catch (err: any) {
      console.error('Error fetching event attendees:', err)
      setError('Failed to load event attendees.')
    }
  }

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !checkInCode.trim()) return

    setCheckingIn(true)
    setError(null)
    setCheckInSuccess(false)

    try {
      const code = checkInCode.trim().toUpperCase()

      // Find event with this code
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, title, point_value, attendance_code, code_expires_at, end_at, start_at, event_category')
        .eq('attendance_code', code)
        .eq('track_attendance', true)
        .single()

      if (eventError || !events) {
        setError('Invalid check-in code. Please try again.')
        return
      }

      // Check if code is expired
      const now = new Date()
      const expiresAt = new Date(events.code_expires_at!)

      if (now > expiresAt) {
        setError('This check-in code has expired.')
        return
      }

      // Check if already checked in
      const { data: existing, error: checkError } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('event_id', events.id)
        .eq('user_id', profile.id)
        .single()

      if (existing) {
        setError('You have already checked in to this event.')
        return
      }

      // Create attendance record
      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          event_id: events.id,
          user_id: profile.id,
          points_earned: events.point_value || 0,
          event_category: events.event_category,
        })

      if (insertError) throw insertError

      setCheckInSuccess(true)
      setCheckInCode('')

      // Refresh data
      if (isUserAdmin) {
        await fetchAdminData()
      } else {
        await fetchMemberData()
      }

      // Clear success message after 3 seconds
      setTimeout(() => setCheckInSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error checking in:', err)
      setError('Failed to check in. Please try again.')
    } finally {
      setCheckingIn(false)
    }
  }

  const fetchAllEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_at, point_value, track_attendance, event_category')
        .order('start_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAllEvents((data as Event[]) || [])
    } catch (err: any) {
      console.error('Error fetching events:', err)
    }
  }

  const handlePointsAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !adjustmentUser || !adjustmentPoints) return

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

  // Member View
  if (!isUserAdmin) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Attendance
          </h1>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {checkInSuccess && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Successfully checked in! Points added to your account.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card-glow p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-3xl font-bold text-primary">{totalPoints}</p>
              </div>
              <Trophy className="w-10 h-10 text-primary opacity-50" />
            </div>
            {(() => {
              const requiredPoints = ROLE_REQUIREMENTS[profile.role].minPoints
              const pointsProgress = requiredPoints > 0 ? Math.min((totalPoints / requiredPoints) * 100, 100) : 100
              return requiredPoints > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Required for {profile.role.replace('_', ' ')}</span>
                    <span className="text-primary font-medium">{requiredPoints} pts</span>
                  </div>
                  <div className="w-full h-2 bg-dark-200 rounded-full border border-primary/30">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all"
                      style={{ width: `${pointsProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalPoints >= requiredPoints ? '✅ Requirement met!' : `${requiredPoints - totalPoints} points to go`}
                  </p>
                </div>
              ) : null
            })()}
          </div>

          <div className="card-glow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Events Attended</p>
                <p className="text-3xl font-bold text-foreground">{eventsAttended}</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="card-glow p-5">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Check In Event</p>
            </div>
            <form onSubmit={handleCheckIn} className="space-y-2">
              <input
                type="text"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. ABC123)"
                maxLength={6}
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm font-mono text-foreground uppercase tracking-wider placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={checkingIn || !checkInCode.trim()}
                className="w-full px-3 py-2 rounded-md bg-primary text-dark-300 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {checkingIn ? 'Checking in...' : 'Check In'}
              </button>
            </form>
          </div>
        </div>

        {/* Category Points Breakdown */}
        <CategoryPointsBreakdown userId={profile.id} />

        {/* Attendance History */}
        <div className="card-glow p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Points History</h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : attendanceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet. Check in to your first event!</p>
          ) : (
            <div className="space-y-2">
              {attendanceHistory.map((item) => (
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Admin View
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Attendance Management
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAdjustmentForm(true)
              fetchAllEvents()
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Adjust Points
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-sm text-primary hover:bg-primary/10"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setViewMode('members')
            setSearchQuery('')
            if (memberStats.length === 0) fetchAdminData()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
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
        <div className="card-glow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Award Points to Member</h2>
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
              className="p-2 text-muted-foreground hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handlePointsAdjustment} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Member</label>
              <select
                value={adjustmentUser}
                onChange={(e) => setAdjustmentUser(e.target.value)}
                required
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select member...</option>
                {memberStats.map((stat) => (
                  <option key={stat.user_id} value={stat.user_id}>
                    {stat.full_name} - {stat.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Adjustment Type</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm text-foreground">For Event Attendance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm text-foreground">Other (Manual Adjustment)</span>
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
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                value={adjustmentPoints}
                onChange={(e) => setAdjustmentPoints(e.target.value)}
                placeholder={adjustmentType === 'event' ? 'Auto-filled from event' : 'e.g. 5 or -5'}
                required
                className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {adjustmentType === 'other' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
                <select
                  value={adjustmentCategory}
                  onChange={(e) => setAdjustmentCategory(e.target.value as typeof adjustmentCategory)}
                  required
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 mb-3"
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
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-dark-300 font-medium hover:opacity-90"
              >
                Apply Adjustment
              </button>
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
                className="px-4 py-2 rounded-lg border border-primary/30 text-muted-foreground hover:bg-dark-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card-glow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'members' ? 'Search members by name or email...' : 'Search events by title...'}
            className="w-full pl-10 pr-4 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Member Stats Table */}
      {viewMode === 'members' && (
      <div className="card-glow overflow-hidden">
        <div className="overflow-x-auto">
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
      <div className="card-glow overflow-hidden">
        <div className="overflow-x-auto">
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
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-200 rounded-lg border border-primary/20 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-200 rounded-lg border border-primary/20 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
