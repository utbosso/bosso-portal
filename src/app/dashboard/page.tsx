'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { ROLE_REQUIREMENTS } from '@/lib/membership-tiers'
import type { Event, Task, Announcement, Opportunity } from '@/types/database.types'
import { canAccessAudience } from '@/lib/role-scope'
import { announcementBodyToPlainText } from '@/lib/announcement-rich-text'
import { usePortalAccess } from '@/hooks/usePortalAccess'
import {
  Calendar,
  CheckSquare,
  Megaphone,
  Briefcase,
  Trophy,
  TrendingUp,
  Clock,
  Users,
  PlusCircle,
  ArrowRight,
  Award,
  FileText,
  QrCode,
} from 'lucide-react'

const supabase = createClient()

export default function DashboardPage() {
  const { user, profile, hasMinimumRole } = useAuth()
  const { access, schemaReady, loading: accessLoading } = usePortalAccess(user?.id)

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([])
  const [recentOpportunities, setRecentOpportunities] = useState<Opportunity[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [eventsAttended, setEventsAttended] = useState(0)
  const [termRequiredPoints, setTermRequiredPoints] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkInCode, setCheckInCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInSuccess, setCheckInSuccess] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)

  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'
  const canManageContent = hasMinimumRole('project_manager')

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !checkInCode.trim()) return

    setCheckingIn(true)
    setCheckInError(null)
    setCheckInSuccess(false)

    try {
      const code = checkInCode.trim().toUpperCase()

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, point_value, attendance_code, code_expires_at, event_category')
        .eq('attendance_code', code)
        .eq('track_attendance', true)
        .single()

      if (eventError || !event) {
        setCheckInError('Invalid check-in code. Please try again.')
        return
      }

      if (event.code_expires_at) {
        const expiresAt = new Date(event.code_expires_at)
        if (!Number.isNaN(expiresAt.getTime()) && new Date() > expiresAt) {
          setCheckInError('This check-in code has expired.')
          return
        }
      }

      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', profile.id)
        .single()

      if (existing) {
        setCheckInError('You have already checked in to this event.')
        return
      }

      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          event_id: event.id,
          user_id: profile.id,
          points_earned: event.point_value || 0,
          event_category: event.event_category,
        })

      if (insertError) throw insertError

      setCheckInSuccess(true)
      setCheckInCode('')
      await fetchAttendanceStats()
      setTimeout(() => setCheckInSuccess(false), 3000)
    } catch (err) {
      console.error('Error checking in:', err)
      setCheckInError('Failed to check in. Please try again.')
    } finally {
      setCheckingIn(false)
    }
  }

  useEffect(() => {
    if (profile) {
      fetchDashboardData()
    }
  }, [profile, access?.term_id, schemaReady, accessLoading])

  const fetchDashboardData = async () => {
    if (!profile || accessLoading) return

    setLoading(true)
    try {
      await Promise.all([
        fetchUpcomingEvents(),
        fetchMyTasks(),
        fetchRecentAnnouncements(),
        fetchRecentOpportunities(),
        fetchAttendanceStats(),
      ])
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingEvents = async () => {
    if (!profile) return

    const now = new Date().toISOString()
    let eventsQuery: any = supabase
      .from('events')
      .select('*')
      .gte('start_at', now)
    if (schemaReady && access?.term_id) eventsQuery = eventsQuery.eq('term_id', access.term_id).is('archived_at', null)
    const { data, error } = await eventsQuery.order('start_at', { ascending: true }).limit(5)

    if (!error && data) {
      // Filter events based on audience_scope
      const filtered = data.filter((event: Event) => {
        return canAccessAudience(
          profile.id,
          profile.role,
          event.audience_scope,
          event.audience_scope_mode,
          event.target_user_ids
        )
      })
      setUpcomingEvents(filtered as Event[])
    }
  }

  const fetchMyTasks = async () => {
    if (!profile) return

    let tasksQuery: any = supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', profile.id)
      .neq('status', 'completed')
    if (schemaReady && access?.term_id) tasksQuery = tasksQuery.eq('term_id', access.term_id).is('archived_at', null)
    const { data, error } = await tasksQuery.order('due_at', { ascending: true }).limit(5)

    if (!error && data) {
      setMyTasks(data as Task[])
    }
  }

  const fetchRecentAnnouncements = async () => {
    if (!profile) return

    let announcementQuery: any = supabase
      .from('announcements')
      .select('*')
    if (schemaReady && access?.term_id) announcementQuery = announcementQuery.eq('term_id', access.term_id).is('archived_at', null)
    const { data, error } = await announcementQuery.order('created_at', { ascending: false }).limit(3)

    if (!error && data) {
      // Filter announcements based on role_scope
      const filtered = data.filter((announcement: Announcement) => {
        return canAccessAudience(
          profile.id,
          profile.role,
          announcement.role_scope,
          announcement.role_scope_mode,
          announcement.target_user_ids
        )
      })
      setRecentAnnouncements(filtered as Announcement[])
    }
  }

  const fetchRecentOpportunities = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!error && data) {
      setRecentOpportunities(data as Opportunity[])
    }
  }

  const fetchAttendanceStats = async () => {
    if (!profile) return

    if (schemaReady && access?.term_id) {
      const [summaryResult, ledgerResult, rulesResult, termResult] = await Promise.all([
        supabase
          .from('member_term_point_summary')
          .select('total_points')
          .eq('term_id', access.term_id)
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('point_ledger')
          .select('id', { count: 'exact', head: true })
          .eq('term_id', access.term_id)
          .eq('user_id', profile.id)
          .eq('source_type', 'attendance')
          .is('voided_at', null),
        supabase.from('term_point_rules').select('minimum_points').eq('term_id', access.term_id),
        supabase.from('academic_terms').select('points_rules_status').eq('id', access.term_id).maybeSingle(),
      ])

      if (!summaryResult.error && !ledgerResult.error && !rulesResult.error && !termResult.error) {
        setTotalPoints(Number(summaryResult.data?.total_points || 0))
        setEventsAttended(ledgerResult.count || 0)
        const minimum = (rulesResult.data || []).reduce((sum, rule) => sum + Number(rule.minimum_points || 0), 0)
        setTermRequiredPoints(termResult.data?.points_rules_status === 'published' ? minimum : 0)
        return
      }
    }

    // Compatibility fallback while the local semester migration is pending.
    const { data: pointsData, error: pointsError } = await supabase
      .rpc('get_user_total_points', { user_uuid: profile.id })

    if (!pointsError && pointsData !== null) {
      setTotalPoints(pointsData)
    }

    // Get events attended count
    const { data: countData, error: countError } = await supabase
      .rpc('get_user_attendance_count', { user_uuid: profile.id })

    if (!countError && countData !== null) {
      setEventsAttended(countData)
    }
  }

  if (!profile) return null

  const firstName = profile.full_name.split(' ')[0]

  // Get role-based point requirements from membership tiers system
  const requiredPoints = termRequiredPoints ?? ROLE_REQUIREMENTS[profile.role].minPoints
  const pointsProgress = requiredPoints > 0 ? Math.min((totalPoints / requiredPoints) * 100, 100) : 100

  return (
    <div className="portal-page space-y-7">
      {/* Welcome header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gradient sm:text-4xl">
          Welcome back, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          {profile.role === 'admin' && 'Admin Dashboard - Full system overview'}
          {profile.role === 'board_member' && 'Board Member Dashboard - Leadership overview'}
          {profile.role === 'project_manager' && 'Project Manager Dashboard - Your projects and team'}
          {profile.role === 'analyst' && 'Analyst Dashboard - Your tasks and opportunities'}
          {profile.role === 'general_member' && 'Member Dashboard - Your BOSSO activity'}
        </p>
      </div>

      {/* Admin-only section */}
      {isUserAdmin && (
        <div className="portal-panel space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Admin Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/points" className="p-4 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors group">
              <Users className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-sm font-semibold text-foreground group-hover:text-primary">Points Review</p>
              <p className="text-xs text-muted-foreground mt-1">Review requests and totals</p>
            </Link>
            <Link href="/feedback" className="p-4 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors group">
              <FileText className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-sm font-semibold text-foreground group-hover:text-primary">Feedback</p>
              <p className="text-xs text-muted-foreground mt-1">Review member feedback</p>
            </Link>
            <Link href="/calendar" className="p-4 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors group">
              <Calendar className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-sm font-semibold text-foreground group-hover:text-primary">Events</p>
              <p className="text-xs text-muted-foreground mt-1">Manage all events</p>
            </Link>
            <Link href="/announcements" className="p-4 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors group">
              <Megaphone className="w-8 h-8 text-cyan-400 mb-2" />
              <p className="text-sm font-semibold text-foreground group-hover:text-primary">Announcements</p>
              <p className="text-xs text-muted-foreground mt-1">Manage announcements</p>
            </Link>
          </div>
        </div>
      )}

      {/* Points & Attendance Stats (for non-admins) */}
      {!isUserAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="portal-panel space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xs text-primary font-medium">
                {requiredPoints > 0 ? `${requiredPoints} required` : 'Requirements being finalized'}
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{totalPoints}</p>
              <p className="text-sm text-muted-foreground">Total Points</p>
            </div>
            {requiredPoints > 0 && (
              <div className="space-y-1">
                <div className="w-full h-2 bg-dark-200 rounded-full border border-primary/30">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pointsProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalPoints >= requiredPoints ? '✅ Requirement met!' : `${requiredPoints - totalPoints} points to go`}
                </p>
              </div>
            )}
          </div>

          <div className="portal-panel space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{eventsAttended}</p>
              <p className="text-sm text-muted-foreground">Events Attended</p>
            </div>
          </div>

          <div className="portal-panel space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                <QrCode className="w-6 h-6 text-accent-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Check in to an event</p>
            </div>
            <form onSubmit={handleCheckIn} className="space-y-2">
              <input
                type="text"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. ABC123)"
                maxLength={6}
                className="portal-input w-full font-mono uppercase tracking-wider"
              />
              <button
                type="submit"
                disabled={checkingIn || !checkInCode.trim()}
                className="portal-button w-full justify-center"
              >
                {checkingIn ? 'Checking in...' : 'Check In'}
              </button>
            </form>
            {checkInSuccess && <p className="text-xs font-medium text-emerald-600">Checked in successfully!</p>}
            {checkInError && <p className="text-xs font-medium text-red-600">{checkInError}</p>}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <div className="portal-panel space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Events
            </h2>
            <Link href="/calendar" className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading events...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
            ) : (
              upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href="/calendar"
                  className="group flex gap-3 rounded-xl border border-border bg-muted/40 p-3 transition-colors hover:border-primary/40 hover-glow sm:gap-4 sm:p-4"
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex flex-col items-center justify-center">
                      <p className="text-xs text-primary font-semibold">
                        {new Date(event.start_at).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {new Date(event.start_at).getDate()}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {event.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {event.track_attendance && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          {event.point_value} pts
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="portal-panel space-y-4">
          <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
          <div className="space-y-3">
            {canManageContent && (
              <>
                <Link
                  href="/announcements"
                  className="w-full px-4 py-3 bg-primary rounded-lg text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Megaphone className="w-4 h-4" />
                  Post Announcement
                </Link>
                <Link
                  href="/calendar"
                  className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Create Event
                </Link>
              </>
            )}
            <Link
              href="/opportunities"
              className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              Browse Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* My Tasks */}
      {myTasks.length > 0 && (
        <div className="portal-panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              My Tasks ({myTasks.length})
            </h2>
            <Link href="/tasks" className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTasks.map((task) => {
              const isOverdue = task.due_at && new Date(task.due_at) < new Date()
              return (
                <div
                  key={task.id}
                  className="p-4 rounded-lg bg-dark-100 border border-primary/10 hover:border-primary/30 transition-all"
                >
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  {task.due_at && (
                    <p className={`text-xs mt-1 ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                      Due: {new Date(task.due_at).toLocaleDateString()}
                    </p>
                  )}
                  <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                    task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                    task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {task.priority} priority
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Announcements & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Announcements */}
        <div className="portal-panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Recent Announcements
            </h2>
            <Link href="/announcements" className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading announcements...</p>
            ) : recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent announcements.</p>
            ) : (
              recentAnnouncements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/announcements/${announcement.id}`}
                  className="block p-4 rounded-lg bg-dark-100 border border-primary/10 hover:border-primary/30 transition-all hover-glow group"
                >
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {announcement.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {announcementBodyToPlainText(announcement.body)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(announcement.created_at!).toLocaleDateString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Opportunities */}
        <div className="portal-panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              New Opportunities
            </h2>
            <Link href="/opportunities" className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading opportunities...</p>
            ) : recentOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent opportunities.</p>
            ) : (
              recentOpportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href="/opportunities"
                  className="block p-4 rounded-lg bg-dark-100 border border-primary/10 hover:border-primary/30 transition-all hover-glow group"
                >
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {opportunity.title}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 font-medium">
                      {opportunity.opportunity_type}
                    </span>
                    {opportunity.company && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                        {opportunity.company}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
