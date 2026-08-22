'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Event } from '@/types/database.types'
import { getEventCategoryLabel, getEventTypeLabel, getEventCategoryColor } from '@/lib/bosso-points'
import {
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  Users,
  Trophy,
  CheckCircle2,
  Shield,
  Hash,
  Tag,
  Folder,
} from 'lucide-react'

const supabase = createClient()

export default function AttendanceDisplayPage() {
  const { profile, user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([])

  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  const canAccessEvent = (event: Event) => {
    if (!profile) return false
    return isUserAdmin || event.created_by === profile.id
  }

  useEffect(() => {
    if (profile) {
      fetchUpcomingEvents()
    }
  }, [profile])

  useEffect(() => {
    if (selectedEvent) {
      fetchAttendeeCount()
      const interval = setInterval(fetchRecentCheckIns, 3000) // Poll every 3 seconds
      return () => clearInterval(interval)
    }
  }, [selectedEvent])

  const fetchUpcomingEvents = async () => {
    setLoading(true)
    try {
      const now = new Date().toISOString()

      let query = supabase
        .from('events')
        .select('*')
        .eq('track_attendance', true)
        .gte('end_at', now)
        .order('start_at', { ascending: true })
        .limit(10)

      // If not admin, only show events created by the user
      if (!isUserAdmin && profile) {
        query = query.eq('created_by', profile.id)
      }

      const { error, data } = await query

      if (error) throw error

      setEvents((data as Event[]) || [])

      // Auto-select first event
      if (data && data.length > 0) {
        setSelectedEvent(data[0] as Event)
      }
    } catch (err: any) {
      console.error('Error fetching events:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendeeCount = async () => {
    if (!selectedEvent) return

    try {
      const { count, error } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', selectedEvent.id)

      if (error) throw error

      setAttendeeCount(count || 0)
    } catch (err: any) {
      console.error('Error fetching attendee count:', err)
    }
  }

  const fetchRecentCheckIns = async () => {
    if (!selectedEvent) return

    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          user:profiles(full_name)
        `)
        .eq('event_id', selectedEvent.id)
        .order('checked_in_at', { ascending: false })
        .limit(5)

      if (error) throw error

      setRecentCheckIns(data || [])
      setAttendeeCount(data?.length || 0)
    } catch (err: any) {
      console.error('Error fetching recent check-ins:', err)
    }
  }

  const regenerateCode = async () => {
    if (!selectedEvent) return

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    try {
      const { error } = await supabase
        .from('events')
        .update({ attendance_code: code })
        .eq('id', selectedEvent.id)

      if (error) throw error

      setSelectedEvent({ ...selectedEvent, attendance_code: code })
    } catch (err: any) {
      console.error('Error regenerating code:', err)
    }
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card-glow p-12 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            Please log in to access this page.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card-glow p-12 text-center">
          <RefreshCw className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card-glow p-12 text-center">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">No Upcoming Events</h1>
          <p className="text-muted-foreground">
            There are no upcoming events with attendance tracking enabled.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const isEventActive = selectedEvent
    ? (
      now >= new Date(selectedEvent.start_at) &&
      (!selectedEvent.code_expires_at || now <= new Date(selectedEvent.code_expires_at))
    )
    : false

  return (
    <div className="min-h-screen bg-dark-300 p-6">
      {/* Event Selector - Minimal top bar */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="card-glow p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Hash className="w-6 h-6 text-primary" />
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => {
                  const event = events.find(ev => ev.id === e.target.value)
                  if (event) setSelectedEvent(event as Event)
                }}
                className="px-4 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.start_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-200">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{attendeeCount} checked in</span>
              </div>

              {isEventActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-medium text-green-400">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className="max-w-7xl mx-auto grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Main Code Display - Large */}
          <div className="card-glow p-12 text-center space-y-8">
            {/* Event Info */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-gradient">{selectedEvent.title}</h1>
              <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground">
                {selectedEvent.location && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedEvent.location}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {new Date(selectedEvent.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  {selectedEvent.point_value} points
                </span>
              </div>
              {/* Category and Type Badges */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                {selectedEvent.event_category && (
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getEventCategoryColor(selectedEvent.event_category)}`}>
                    <Folder className="w-4 h-4" />
                    {getEventCategoryLabel(selectedEvent.event_category)}
                  </span>
                )}
                {selectedEvent.event_type && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    <Tag className="w-4 h-4" />
                    {selectedEvent.event_type === 'other' && selectedEvent.custom_event_type
                      ? selectedEvent.custom_event_type
                      : getEventTypeLabel(selectedEvent.event_type)}
                  </span>
                )}
              </div>
            </div>

            {/* Attendance Code - Extra Large */}
            <div className="space-y-6 py-12">
              <h2 className="text-3xl font-semibold text-foreground">Check-In Code</h2>

              <div className="inline-block px-16 py-12 rounded-2xl bg-primary/20 border-4 border-primary shadow-2xl">
                <p className="text-9xl font-black text-primary tracking-[0.5em] font-mono">
                  {selectedEvent.attendance_code}
                </p>
              </div>

              <div className="space-y-4 mt-8">
                <p className="text-2xl font-medium text-foreground">
                  Enter this code at:
                </p>
                <p className="text-3xl font-bold text-primary">
                  portal.bosso.org/attendance
                </p>
              </div>

              <button
                onClick={regenerateCode}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-dark-200 hover:bg-dark-100 text-base text-primary transition font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                Regenerate Code
              </button>

              {/* Expiration Notice */}
              <div className="mt-8 p-4 rounded-lg bg-dark-200 border border-primary/10">
                <p className="text-base text-muted-foreground">
                  {selectedEvent.code_expires_at ? (
                    <>
                      Code expires:{' '}
                      <span className="text-foreground font-medium">
                        {new Date(selectedEvent.code_expires_at).toLocaleString()}
                      </span>{' '}
                      (5 min after event ends)
                    </>
                  ) : (
                    <>
                      Code expiry: <span className="text-foreground font-medium">No expiry</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Live Check-ins Sidebar */}
          <div className="space-y-4">
            <div className="card-glow p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-semibold text-foreground">Live Check-Ins</h2>
              </div>

              <div className="space-y-2">
                {recentCheckIns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No check-ins yet. Waiting for members...
                  </p>
                ) : (
                  recentCheckIns.map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-300/50 border border-green-500/20 animate-pulse-once"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {checkIn.user?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(checkIn.checked_in_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-400">
                          +{checkIn.points_earned}
                        </span>
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total Count */}
              <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-3xl font-bold text-primary">{attendeeCount}</p>
                <p className="text-sm text-muted-foreground">Total Attendees</p>
              </div>
            </div>

            {/* Instructions Card */}
            <div className="card-glow p-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">Instructions for Members</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>Open the BOSSO portal on your phone or laptop</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>Go to the Attendance tab</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>Type the 6-character code shown on screen</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">4.</span>
                  <span>Click "Check In" to earn your points!</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
