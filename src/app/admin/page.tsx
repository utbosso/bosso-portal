'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getRoleDisplayName as getAdminRoleDisplayName } from '@/lib/admin'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield,
  Users,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Calendar,
  FolderOpen,
  BarChart3,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Trash2,
  Search,
  Download,
  RefreshCw,
  Briefcase,
  KeyRound,
  Plus,
  X,
  CalendarRange,
  Loader2,
} from 'lucide-react'
import type { Profile, FeedbackSubmission, Application, EventCategory, EventType, UserRole, AcademicTerm, MemberTermMembership } from '@/types/database.types'
import { EVENT_CATEGORIES, EVENT_TYPES, getEventTypesByCategory } from '@/lib/bosso-points'
import { buildCategoryTotals, getCategoryFromAdjustmentReason } from '@/lib/points-calculations'
import type { UserOption } from '@/components/UserSearch'
import MemberGroupPicker from '@/components/MemberGroupPicker'
import {
  fetchCurrentMemberDirectory,
  type CommunicationMemberGroup,
} from '@/lib/communication-recipients'

const supabase = createClient()

type TabType = 'overview' | 'users' | 'points'

type UserPointsBreakdown = {
  user_id: string
  full_name: string
  email: string
  role: string
  total_points: number
  membership_points: number
  professional_points: number
  social_points: number
  philanthropy_points: number
  uncategorized_points: number
  is_active: boolean
  source_breakdown: {
    membership: PointsSourceItem[]
    professional_education: PointsSourceItem[]
    social: PointsSourceItem[]
    philanthropy: PointsSourceItem[]
    uncategorized: PointsSourceItem[]
  }
}

type PointsSourceItem = {
  id: string
  title: string
  points: number
  timestamp: string
}

export default function AdminDashboard() {
  const { profile, user } = useAuth()
  const isPortalAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get active tab from URL, default to 'overview'
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const activeTab: TabType = tabFromUrl && ['overview', 'users', 'points'].includes(tabFromUrl) ? tabFromUrl : 'overview'

  // Ref to track scroll position through re-renders
  const scrollPositionRef = useRef<number>(0)
  // Track if we've loaded data at least once (to avoid showing loading spinner on refetch)
  const hasLoadedOnceRef = useRef<boolean>(false)

  // State declarations (must be before useEffects that use them)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalFeedback: 0,
    pendingUsers: 0,
  })
  const [recentUsers, setRecentUsers] = useState<Profile[]>([])
  const [recentFeedback, setRecentFeedback] = useState<FeedbackSubmission[]>([])
  const [usersByRole, setUsersByRole] = useState<Record<string, number>>({})

  // Update URL when tab changes (without full page reload)
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/admin?${params.toString()}`, { scroll: false })
  }

  // Save and restore scroll position when switching browser tabs
  useEffect(() => {
    // Disable browser's automatic scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    // Save scroll position continuously while on page
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY
      sessionStorage.setItem('admin-scroll-position', window.scrollY.toString())
    }

    // Aggressive scroll restoration function
    const restoreScroll = (scrollY: number) => {
      const restore = () => window.scrollTo(0, scrollY)
      // Try multiple times at different intervals to combat any resets
      restore()
      requestAnimationFrame(restore)
      setTimeout(restore, 0)
      setTimeout(restore, 50)
      setTimeout(restore, 100)
      setTimeout(restore, 200)
      setTimeout(restore, 500)
      setTimeout(restore, 1000)
    }

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is being hidden - save current scroll position
        scrollPositionRef.current = window.scrollY
        sessionStorage.setItem('admin-scroll-position', window.scrollY.toString())
      } else {
        // Tab is becoming visible - restore scroll position
        const savedScroll = sessionStorage.getItem('admin-scroll-position')
        if (savedScroll) {
          const scrollY = parseInt(savedScroll, 10)
          scrollPositionRef.current = scrollY
          restoreScroll(scrollY)
        }
      }
    }

    // Restore scroll position on initial mount
    const savedScroll = sessionStorage.getItem('admin-scroll-position')
    if (savedScroll) {
      const scrollY = parseInt(savedScroll, 10)
      scrollPositionRef.current = scrollY
      setTimeout(() => {
        window.scrollTo(0, scrollY)
      }, 100)
    }

    window.addEventListener('scroll', handleScroll)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Restore browser's scroll restoration on unmount
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  // Restore scroll position when loading completes
  useEffect(() => {
    if (!loading && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current)
      })
    }
  }, [loading])

  useEffect(() => {
    if (profile && isPortalAdmin) {
      fetchDashboardData()
    }
  }, [profile])

  const fetchDashboardData = async () => {
    // Only show loading spinner on initial load, not on refetches
    // This prevents scroll position from resetting when switching tabs
    if (!hasLoadedOnceRef.current) {
      setLoading(true)
    }
    try {
      // Fetch all users
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: currentTerm } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('status', 'current')
        .maybeSingle()

      // Fetch current-term feedback. A missing term is the pre-migration fallback.
      let feedbackQuery: any = supabase
        .from('feedback_submissions')
        .select(`
          *,
          submitter:profiles!feedback_submissions_submitted_by_fkey(id, full_name, email)
        `)
      if (currentTerm?.id) feedbackQuery = feedbackQuery.eq('term_id', currentTerm.id).is('archived_at', null)
      const { data: feedback } = await feedbackQuery.order('created_at', { ascending: false }).limit(10)

      // Pending renewals are counted from this term's memberships, not the legacy
      // account_status field, which is never reset by a semester rollover.
      let pendingUsers = 0
      if (currentTerm?.id) {
        const { count } = await supabase
          .from('member_term_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('term_id', currentTerm.id)
          .in('status', ['pending_dues', 'pending_approval'])
        pendingUsers = count || 0
      } else {
        pendingUsers = users?.filter(u => u.account_status === 'pending_approval' || u.account_status === 'pending').length || 0
      }

      // Calculate stats
      const totalFeedback = feedback?.length || 0

      // Count users by role. profiles.role is never reset by a rollover (it's last-known,
      // not current-term), so once the term schema is live this counts approved memberships
      // for the current term instead - otherwise it just replays last term's breakdown.
      const roleCount: Record<string, number> = {}
      if (currentTerm?.id) {
        const { data: approvedMemberships } = await supabase
          .from('member_term_memberships')
          .select('position_role')
          .eq('term_id', currentTerm.id)
          .in('status', ['active', 'exempt'])
        approvedMemberships?.forEach((membership) => {
          roleCount[membership.position_role] = (roleCount[membership.position_role] || 0) + 1
        })
      } else {
        users?.forEach(user => {
          roleCount[user.role] = (roleCount[user.role] || 0) + 1
        })
      }

      // "Recent Users" resets every semester - it should reflect who has
      // just renewed for the current term, not the org's all-time newest
      // accounts (which barely change once the org has been running a
      // while). Old accounts remain fully available in User Management for
      // temporary-password resets regardless of this.
      let recentTermUsers: Profile[] = []
      if (currentTerm?.id) {
        const { data: recentMemberships } = await supabase
          .from('member_term_memberships')
          .select('user_id, claimed_at')
          .eq('term_id', currentTerm.id)
          .order('claimed_at', { ascending: false, nullsFirst: false })
          .limit(5)
        const usersById = new Map((users || []).map((u) => [u.id, u]))
        recentTermUsers = (recentMemberships || [])
          .map((membership) => usersById.get(membership.user_id))
          .filter((u): u is Profile => Boolean(u))
      } else {
        recentTermUsers = users?.slice(0, 5) || []
      }

      setStats({
        totalFeedback,
        pendingUsers,
      })
      setRecentUsers(recentTermUsers)
      setRecentFeedback(feedback || [])
      setUsersByRole(roleCount)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }

  const deleteFeedback = async (feedbackId: string) => {
    const confirmed = window.confirm('Archive this feedback? It will remain in semester history.')
    if (!confirmed) return

    try {
      const { error } = await (supabase as any)
        .from('feedback_submissions')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', feedbackId)

      if (error) throw error

      setRecentFeedback(prev => prev.filter(fb => fb.id !== feedbackId))
    } catch (error) {
      console.error('Error deleting feedback:', error)
      alert('Failed to delete feedback. Please try again.')
    }
  }

  if (!profile || !isPortalAdmin) {
    return (
      <div className="portal-page max-w-7xl">
        <div className="card-glow p-12 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="portal-page max-w-7xl">
        <div className="card-glow p-12 text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-page max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Master account oversight and management
        </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/attendance" className="portal-button-secondary">
            <ClipboardCheck className="h-4 w-4" /> Attendance & manual points
          </Link>
          <Link href="/admin/semester" className="portal-button">
            <CalendarRange className="h-4 w-4" /> Semester setup
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="portal-scroll-row flex gap-2 overflow-x-auto border-b border-primary/20">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'overview'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'users'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            User Management
            {stats.pendingUsers > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                {stats.pendingUsers}
              </span>
            )}
          </div>
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('points')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'points'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Points Breakdown
          {activeTab === 'points' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Alert for pending users - Only show on Overview tab */}
      {activeTab === 'overview' && stats.pendingUsers > 0 && (
        <div className="bg-yellow-500/20 border-2 border-yellow-500/30 rounded-lg p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-400">
                {stats.pendingUsers} user{stats.pendingUsers > 1 ? 's' : ''} awaiting approval
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                New accounts need to be reviewed and approved before they can access the portal.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('users')}
              className="min-h-10 w-full flex-shrink-0 rounded-lg border border-yellow-500/30 bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-400 transition-all hover:bg-yellow-500/30 sm:w-auto"
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Users by Role */}
      <div className="card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Approved This Semester, by Role</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="p-3 rounded-lg bg-dark-300/50 border border-gray-500/20">
            <p className="text-xs text-muted-foreground mb-1">General Members</p>
            <p className="text-2xl font-bold text-gray-400">{usersByRole['general_member'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-300/50 border border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-1">Analysts</p>
            <p className="text-2xl font-bold text-blue-400">{usersByRole['analyst'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-300/50 border border-purple-500/20">
            <p className="text-xs text-muted-foreground mb-1">Project Managers</p>
            <p className="text-2xl font-bold text-purple-400">{usersByRole['project_manager'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-300/50 border border-yellow-500/20">
            <p className="text-xs text-muted-foreground mb-1">Board Members</p>
            <p className="text-2xl font-bold text-yellow-400">{usersByRole['board_member'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-300/50 border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-1">Admins</p>
            <p className="text-2xl font-bold text-red-400">{usersByRole['admin'] || 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Recent Renewals This Semester</h2>
          </div>
          <a href="/admin?tab=users" className="text-sm text-primary hover:underline">
            View all
          </a>
        </div>
        <div className="space-y-2">
          {recentUsers.length === 0 && <p className="text-sm text-muted-foreground">No renewals yet this semester.</p>}
          {recentUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-300/50">
              <div>
                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                user.role === 'admin' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                user.role === 'board_member' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                user.role === 'project_manager' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                user.role === 'analyst' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {user.role.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Recent Feedback</h2>
          </div>
          <a href="/feedback" className="text-sm text-primary hover:underline">
            View all
          </a>
        </div>
        <div className="space-y-3">
          {recentFeedback.map(fb => (
            <div key={fb.id} className="p-4 rounded-lg bg-dark-300/50 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{fb.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{fb.feedback}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    fb.status === 'new' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    fb.status === 'reviewed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    fb.status === 'in_progress' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    fb.status === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {fb.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => deleteFeedback(fb.id)}
                    className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition"
                    title="Delete feedback"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {fb.is_anonymous ? 'Anonymous' : fb.submitter?.full_name}
                </span>
                <span>{fb.category}</span>
                <span>{new Date(fb.created_at || '').toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/feedback"
            className="flex items-center gap-3 p-4 rounded-lg bg-dark-300/50 hover:bg-dark-200 transition"
          >
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">View Feedback</p>
              <p className="text-xs text-muted-foreground">Manage submissions</p>
            </div>
          </a>
          <a
            href="/announcements"
            className="flex items-center gap-3 p-4 rounded-lg bg-dark-300/50 hover:bg-dark-200 transition"
          >
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Announcements</p>
              <p className="text-xs text-muted-foreground">Create updates</p>
            </div>
          </a>
          <a
            href="/events"
            className="flex items-center gap-3 p-4 rounded-lg bg-dark-300/50 hover:bg-dark-200 transition"
          >
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Events</p>
              <p className="text-xs text-muted-foreground">Manage calendar</p>
            </div>
          </a>
          <a
            href="/documents"
            className="flex items-center gap-3 p-4 rounded-lg bg-dark-300/50 hover:bg-dark-200 transition"
          >
            <FolderOpen className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Documents</p>
              <p className="text-xs text-muted-foreground">File management</p>
            </div>
          </a>
        </div>
      </div>
        </>
      )}

      {/* User Management Tab Content */}
      {activeTab === 'users' && (
        <UserManagementTab />
      )}

      {/* Points Breakdown Tab Content */}
      {activeTab === 'points' && (
        <PointsBreakdownTab />
      )}
    </div>
  )
}

// All available roles for the role change dropdown
const ALL_ROLES: UserRole[] = ['general_member', 'analyst', 'project_manager', 'board_member', 'admin']

// User Management Tab Component
function UserManagementTab() {
  const { profile: adminProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending')
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)
  const [recentlyApproved, setRecentlyApproved] = useState<Set<string>>(new Set())
  const [tempResetUserId, setTempResetUserId] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [settingTempPassword, setSettingTempPassword] = useState(false)
  const [cleanupEmail, setCleanupEmail] = useState('')
  const [cleaningUpAuth, setCleaningUpAuth] = useState(false)
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm | null>(null)
  const [termMemberships, setTermMemberships] = useState<Record<string, MemberTermMembership>>({})
  const [fullYearTermIds, setFullYearTermIds] = useState<string[]>([])
  const [reviewingUser, setReviewingUser] = useState<Profile | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [filter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])

      const { data: term } = await supabase
        .from('academic_terms')
        .select('*')
        .eq('status', 'current')
        .maybeSingle()
      setCurrentTerm((term as AcademicTerm) || null)

      if (term) {
        const [membershipResult, siblingTermsResult] = await Promise.all([
          supabase.from('member_term_memberships').select('*').eq('term_id', term.id),
          supabase
            .from('academic_terms')
            .select('id')
            .eq('academic_year', term.academic_year)
            .in('status', ['current', 'upcoming']),
        ])
        setTermMemberships(
          Object.fromEntries(((membershipResult.data || []) as MemberTermMembership[]).map((item) => [item.user_id, item]))
        )
        setFullYearTermIds((siblingTermsResult.data || []).map((item) => item.id))
      } else {
        setTermMemberships({})
        setFullYearTermIds([])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshMembership = async (userId: string) => {
    if (!currentTerm) return
    const { data } = await supabase
      .from('member_term_memberships')
      .select('*')
      .eq('term_id', currentTerm.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) setTermMemberships((prev) => ({ ...prev, [userId]: data as MemberTermMembership }))
  }

  const [duesPromptOpen, setDuesPromptOpen] = useState<{ annual: boolean } | null>(null)
  const [duesAmount, setDuesAmount] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSaving, setReviewSaving] = useState('')

  const closeReview = () => {
    setReviewingUser(null)
    setDuesPromptOpen(null)
    setDuesAmount('')
    setReviewError('')
  }

  const postSemesterAction = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/admin/semester', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (!response.ok) {
      setReviewError(result.error || 'The change could not be saved.')
      return null
    }
    return result
  }

  const submitDuesAmount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reviewingUser || !duesPromptOpen || !currentTerm) return
    const amountNumber = Number(duesAmount)
    if (!Number.isFinite(amountNumber) || amountNumber < 0) {
      setReviewError('Enter a valid non-negative payment amount.')
      return
    }
    setReviewSaving('dues')
    setReviewError('')
    const coverage = duesPromptOpen.annual ? fullYearTermIds : [currentTerm.id]
    const result = await postSemesterAction({
      action: 'record_dues',
      userId: reviewingUser.id,
      termIds: coverage,
      amountCents: Math.round(amountNumber * 100),
    })
    setReviewSaving('')
    if (result) {
      setDuesPromptOpen(null)
      setDuesAmount('')
      await refreshMembership(reviewingUser.id)
    }
  }

  const submitMembershipDecision = async (decision: 'approve' | 'decline') => {
    if (!reviewingUser) return
    const membership = termMemberships[reviewingUser.id]
    if (!membership) return
    if (decision === 'decline' && !window.confirm('Decline this semester renewal?')) return
    setReviewSaving(decision)
    setReviewError('')
    const result = await postSemesterAction({ action: 'review_membership', membershipId: membership.id, decision })
    setReviewSaving('')
    if (result) {
      await fetchUsers()
      closeReview()
    }
  }

  const updateUserStatus = async (userId: string, newStatus: 'active' | 'rejected') => {
    setProcessingUserId(userId)
    try {
      // Get the user data before updating
      const userToApprove = users.find(u => u.id === userId)

      const { error } = await supabase
        .from('profiles')
        .update({ account_status: newStatus })
        .eq('id', userId)

      if (error) throw error

      // Track recently approved users to show email button
      if (newStatus === 'active') {
        setRecentlyApproved(prev => new Set(prev).add(userId))

        // Automatically open welcome email for approved users
        if (userToApprove) {
          sendApprovalEmail(userToApprove)

          // Assign pending role-based tasks to the newly approved user
          await assignPendingRoleTasks(userToApprove)
        }
      }

      await fetchUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      alert('Failed to update user status')
    } finally {
      setProcessingUserId(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    // Prevent admin from changing their own role
    if (userId === adminProfile?.id) {
      alert('You cannot change your own role.')
      return
    }

    const oldRoleName = getAdminRoleDisplayName(user.role)
    const newRoleName = getAdminRoleDisplayName(newRole)

    const confirmed = window.confirm(
      `Change ${user.full_name}'s role from "${oldRoleName}" to "${newRoleName}"?\n\nThis will immediately update their permissions.`
    )
    if (!confirmed) return

    setProcessingUserId(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // Assign any pending role-based tasks for the new role
      const updatedUser = { ...user, role: newRole }
      await assignPendingRoleTasks(updatedUser)

      await fetchUsers()
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role')
    } finally {
      setProcessingUserId(null)
    }
  }

  // Assign pending role-based tasks to a newly approved user
  const assignPendingRoleTasks = async (user: Profile) => {
    try {
      // Find all unique role-based task groups for the user's role that are not completed
      const { data: roleTasks, error: roleTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to_role', user.role)
        .not('group_task_id', 'is', null)
        .neq('status', 'completed')

      if (roleTasksError) {
        console.error('Error fetching role tasks:', roleTasksError)
        return
      }

      if (!roleTasks || roleTasks.length === 0) return

      // Group tasks by group_task_id to find unique task groups
      const taskGroups = new Map<string, typeof roleTasks[0]>()
      roleTasks.forEach(task => {
        if (task.group_task_id && !taskGroups.has(task.group_task_id)) {
          taskGroups.set(task.group_task_id, task)
        }
      })

      // Check which tasks the user already has
      const { data: existingUserTasks } = await supabase
        .from('tasks')
        .select('group_task_id')
        .eq('assigned_to', user.id)
        .not('group_task_id', 'is', null)

      const existingGroupIds = new Set(existingUserTasks?.map(t => t.group_task_id) || [])

      // Create tasks for groups the user doesn't have yet
      const tasksToCreate = Array.from(taskGroups.entries())
        .filter(([groupId]) => !existingGroupIds.has(groupId))
        .map(([groupId, templateTask]) => ({
          title: templateTask.title,
          description: templateTask.description,
          due_at: templateTask.due_at,
          assigned_to: user.id,
          assigned_by: templateTask.assigned_by,
          status: 'not_started' as const,
          assignee_status: 'not_started' as const,
          point_value: templateTask.point_value,
          points_category: templateTask.points_category,
          auto_approve: templateTask.auto_approve,
          group_task_id: groupId,
          assigned_to_role: user.role,
        }))

      if (tasksToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(tasksToCreate)

        if (insertError) {
          console.error('Error creating tasks for new user:', insertError)
        } else {
          console.log(`Created ${tasksToCreate.length} tasks for newly approved user ${user.full_name}`)
        }
      }
    } catch (err) {
      console.error('Error assigning pending role tasks:', err)
    }
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete the account for ${userEmail}?\n\nThis will permanently delete:\n- User profile\n- Authentication account\n- All associated data\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setProcessingUserId(userId)
    try {
      // Call the delete user API endpoint to remove both profile and auth user
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      alert(`Successfully deleted account for ${userEmail}`)
      await fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user account. Please try again.')
    } finally {
      setProcessingUserId(null)
    }
  }

  const getRoleDisplayName = (role: string) => {
    return role.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const sendVerificationEmail = (user: Profile) => {
    const subject = encodeURIComponent('BOSSO Portal - Email Verification Required')
    const body = encodeURIComponent(`Hi ${user.full_name},

Thank you for registering with the BOSSO Member Portal.

To verify your email address (${user.email}), please reply to this email with a simple confirmation message.

Once we receive your response, we'll verify your email and review your account for approval.

Best regards,
BOSSO Team`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
  }

  const toggleVerificationEmailSent = async (userId: string, currentlySent: boolean) => {
    const newValue = currentlySent ? null : new Date().toISOString()

    // Update local state immediately (optimistic update)
    setUsers(prev => prev.map(user =>
      user.id === userId ? { ...user, verification_email_sent_at: newValue } as Profile : user
    ))

    try {
      await supabase
        .from('profiles')
        .update({ verification_email_sent_at: newValue })
        .eq('id', userId)
    } catch (error) {
      console.error('Error updating verification email status:', error)
      // Revert on error
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, verification_email_sent_at: currentlySent ? new Date().toISOString() : null } as Profile : user
      ))
    }
  }

  const toggleDuesEmailSent = async (userId: string, currentlySent: boolean) => {
    const newValue = currentlySent ? null : new Date().toISOString()

    // Update local state immediately (optimistic update)
    setUsers(prev => prev.map(user =>
      user.id === userId ? { ...user, dues_email_sent_at: newValue } as Profile : user
    ))

    try {
      await supabase
        .from('profiles')
        .update({ dues_email_sent_at: newValue })
        .eq('id', userId)
    } catch (error) {
      console.error('Error updating dues email status:', error)
      // Revert on error
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, dues_email_sent_at: currentlySent ? new Date().toISOString() : null } as Profile : user
      ))
    }
  }

  const markEmailVerified = async (userId: string) => {
    setProcessingUserId(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email_verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error
      await fetchUsers()
      alert('Email marked as verified successfully!')
    } catch (error) {
      console.error('Error marking email as verified:', error)
      alert('Failed to mark email as verified. Please try again.')
    } finally {
      setProcessingUserId(null)
    }
  }

  const cleanupOrphanedAuth = async () => {
    const email = cleanupEmail.trim()
    if (!email) return

    if (!email.includes('@eid.utexas.edu') && !email.includes('@my.utexas.edu') && !email.includes('@utexas.edu') && !email.includes('@txbosso.com')) {
      alert('Please enter a valid @eid.utexas.edu, @my.utexas.edu, @utexas.edu, or @txbosso.com email address')
      return
    }

    setCleaningUpAuth(true)
    try {
      const response = await fetch('/api/admin/cleanup-orphaned-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup orphaned auth user')
      }

      alert(data.message || 'Successfully deleted orphaned auth user. You can now sign up with this email.')
      setCleanupEmail('')
    } catch (error: any) {
      console.error('Error cleaning up orphaned auth:', error)
      alert(error.message || 'Failed to cleanup orphaned auth user. Please try again.')
    } finally {
      setCleaningUpAuth(false)
    }
  }

  const sendApprovalEmail = (user: Profile) => {
    const subject = encodeURIComponent('Welcome to BOSSO Portal - Account Approved!')
    const body = encodeURIComponent(`Hi ${user.full_name},

Great news! Your BOSSO Portal account has been approved and is now active.

You can now access the full portal at: https://bosso-portal.vercel.app/login

Your Account Details:
• Name: ${user.full_name}
• Email: ${user.email}
• Role: ${user.role.replace('_', ' ')}

If you have any questions or need assistance, feel free to reach out to the board.

Welcome to the team!

Best regards,
BOSSO Team`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
  }

  const sendDuesPaymentRequest = (user: Profile) => {
    const subject = encodeURIComponent('BOSSO Portal - Dues Payment Required')
    const body = encodeURIComponent(`Hi ${user.full_name},

Thank you for creating a BOSSO Portal account!

Before we can approve your account, we need to confirm that you have paid your membership dues.

Dues Payment Information:
• Amount: $
• Venmo: @hdave7

Once you have completed the payment, please reply to this email with:
1. Confirmation of payment (screenshot or transaction ID)
2. Date of payment

We will approve your portal account within 24-48 hours of receiving confirmation.

If you have already paid your dues, please reply with your confirmation details and we'll get you approved right away.

If you have any questions about dues or the payment process, feel free to reach out.

Best regards,
BOSSO@UTAustin`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
  }

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    const passwordLength = 12
    let generated = ''
    for (let i = 0; i < passwordLength; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setTempPassword(generated)
  }

  const selectedResetUser = users.find((user) => user.id === tempResetUserId) || null

  const openTempPasswordEmailDraft = (user: Profile, password: string) => {
    const subject = encodeURIComponent('BOSSO Portal - Temporary Password')
    const body = encodeURIComponent(`Hi ${user.full_name},

We reset your BOSSO Portal password.

Temporary Password:
${password}

Please do the following:
1. Go to https://bosso-portal.vercel.app/login
2. Sign in with your email and the temporary password above
3. Go to Settings -> Security
4. Set your own new password immediately

If you have trouble logging in, reply to this email and we will help.

Best regards,
BOSSO Team`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
  }

  const setTemporaryPassword = async () => {
    if (!tempResetUserId) {
      alert('Please select a user first.')
      return
    }

    if (!tempPassword || tempPassword.length < 8) {
      alert('Temporary password must be at least 8 characters.')
      return
    }

    if (!selectedResetUser) {
      alert('Selected user was not found. Please refresh and try again.')
      return
    }

    setSettingTempPassword(true)
    try {
      const response = await fetch('/api/admin/set-temp-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: tempResetUserId,
          tempPassword,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set temporary password')
      }

      alert(`Temporary password updated for ${selectedResetUser.full_name}.`)
    } catch (error: any) {
      console.error('Error setting temporary password:', error)
      alert(error.message || 'Failed to set temporary password')
    } finally {
      setSettingTempPassword(false)
    }
  }

  const downloadMembersSpreadsheet = async () => {
    try {
      const response = await fetch('/api/admin/export-members')
      if (!response.ok) throw new Error('Failed to download spreadsheet')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bosso-members-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading spreadsheet:', error)
      alert('Failed to download spreadsheet')
    }
  }

  // A semester rollover never resets the legacy account_status field, so once the term
  // schema is live, a member's badge and reviewability reflect THIS term's membership
  // instead - otherwise everyone still reads as approved from whatever term they last
  // renewed for. Fall back to account_status only if the term schema is missing.
  const isPendingThisTerm = (user: Profile) => {
    if (currentTerm) return ['pending_dues', 'pending_approval'].includes(termMemberships[user.id]?.status || '')
    return user.account_status === 'pending_approval'
  }

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true
    if (currentTerm) {
      const membership = termMemberships[user.id]
      if (filter === 'pending') return membership ? ['pending_dues', 'pending_approval'].includes(membership.status) : false
      if (filter === 'active') return membership ? ['active', 'exempt'].includes(membership.status) : false
      if (filter === 'rejected') return membership?.status === 'declined'
      return true
    }
    if (filter === 'pending') return user.account_status === 'pending_approval'
    if (filter === 'active') return user.account_status === 'approved' || user.account_status === 'active' || user.account_status === null
    if (filter === 'rejected') return user.account_status === 'rejected'
    return true
  })

  const pendingCount = currentTerm
    ? Object.values(termMemberships).filter((item) => ['pending_dues', 'pending_approval'].includes(item.status)).length
    : users.filter((u) => u.account_status === 'pending_approval').length

  const tempPasswordUsers = users.filter((user) => user.id !== adminProfile?.id)

  return (
    <div className="space-y-6">
      {/* Cleanup Section */}
      <div className="card-glow p-4 bg-red-500/10 border border-red-500/30 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-1">Cleanup Orphaned Auth Users</h3>
          <p className="text-xs text-muted-foreground">
            If signup fails with "User already registered" but no profile exists, enter the email and clean it up here
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={cleanupEmail}
            onChange={(e) => setCleanupEmail(e.target.value)}
            placeholder="orphaned.user@eid.utexas.edu"
            className="flex-1 min-w-[220px] px-3 py-2 bg-dark-300 border border-red-500/20 text-foreground rounded-lg text-sm focus:outline-none focus:border-red-400"
          />
          <button
            onClick={cleanupOrphanedAuth}
            disabled={cleaningUpAuth || !cleanupEmail.trim()}
            className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cleaningUpAuth ? 'Cleaning up...' : 'Cleanup Orphaned Auth'}
          </button>
        </div>
      </div>

      {/* Temporary Password Reset Section */}
      <div className="card-glow p-4 bg-blue-500/10 border border-blue-500/30 space-y-3">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-400 mb-1">Temporary Password Reset</h3>
            <p className="text-xs text-muted-foreground">
              Select a user, set a temporary password, then open a prefilled Gmail draft so you only need to hit send.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="temp-reset-user" className="text-xs text-muted-foreground">User</label>
            <select
              id="temp-reset-user"
              value={tempResetUserId}
              onChange={(e) => setTempResetUserId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-300 border border-primary/20 text-foreground rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select a user</option>
              {tempPasswordUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="temp-password" className="text-xs text-muted-foreground">Temporary Password</label>
            <div className="flex gap-2">
              <input
                id="temp-password"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="flex-1 px-3 py-2 bg-dark-300 border border-primary/20 text-foreground rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={generateTempPassword}
                className="px-3 py-2 bg-dark-200 border border-primary/20 text-foreground rounded-lg text-sm hover:border-primary/50 transition-all whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={setTemporaryPassword}
            disabled={settingTempPassword}
            className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {settingTempPassword ? 'Setting...' : 'Set Temporary Password'}
          </button>
          <button
            onClick={() => {
              if (!selectedResetUser) {
                alert('Please select a user first.')
                return
              }
              if (!tempPassword) {
                alert('Please enter or generate a temporary password first.')
                return
              }
              openTempPasswordEmailDraft(selectedResetUser, tempPassword)
            }}
            className="px-4 py-2 bg-primary/20 border border-primary/30 text-primary rounded-lg hover:bg-primary/30 transition-all font-medium text-sm flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Open Email Draft
          </button>
        </div>
      </div>

      {/* Filter Tabs and Export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'active', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-dark-200 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={downloadMembersSpreadsheet}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Export Members
        </button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="card-glow p-12 text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card-glow p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No users found in this category</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const membership = currentTerm ? termMemberships[user.id] : undefined
            const statusBadge = currentTerm
              ? membership
                ? {
                    pending_dues: { label: 'Dues required', className: 'bg-yellow-500/20 text-yellow-400' },
                    pending_approval: { label: 'Pending approval', className: 'bg-yellow-500/20 text-yellow-400' },
                    active: { label: 'Approved this term', className: 'bg-green-500/20 text-green-400' },
                    exempt: { label: 'Approved · exempt', className: 'bg-green-500/20 text-green-400' },
                    declined: { label: 'Declined this term', className: 'bg-red-500/20 text-red-400' },
                  }[membership.status]
                : { label: 'Not yet renewed', className: 'bg-dark-200 text-muted-foreground' }
              : {
                  label: user.account_status || 'Active',
                  className:
                    user.account_status === 'approved' || user.account_status === null
                      ? 'bg-green-500/20 text-green-400'
                      : user.account_status === 'pending_approval'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400',
                }

            return (
            <div key={user.id} className="card-glow p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {user.full_name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {getRoleDisplayName(user.role)}
                    </span>
                    {membership && (
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" />
                        Requested: {getRoleDisplayName(membership.position_role)}
                      </span>
                    )}
                    {user.email_verified !== null && (
                      <span className="flex items-center gap-1">
                        {user.email_verified ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Email Verified
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-400" />
                            Email Not Verified
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Work Experience */}
                  {(user as any).work_experiences && (user as any).work_experiences.length > 0 && (
                    <div className="pt-2 border-t border-primary/10">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Briefcase className="w-3 h-3" />
                        Work Experience
                      </div>
                      <div className="space-y-1.5">
                        {(user as any).work_experiences.slice(0, 3).map((exp: any) => (
                          <div key={exp.id} className="text-xs">
                            <span className="text-foreground font-medium">{exp.title}</span>
                            <span className="text-muted-foreground"> at {exp.company}</span>
                            {exp.is_current && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                                Current
                              </span>
                            )}
                          </div>
                        ))}
                        {(user as any).work_experiences.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{(user as any).work_experiences.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex w-full flex-col gap-2 lg:w-auto lg:max-w-md lg:shrink-0 lg:items-end">
                  {isPendingThisTerm(user) && (
                    <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
                      <button
                        onClick={() => setReviewingUser(user)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                      >
                        Review & approve
                      </button>
                      <button
                        onClick={() => sendDuesPaymentRequest(user)}
                        className="px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/30 transition-all"
                      >
                        Request Dues
                      </button>
                      {(user.email?.endsWith('@eid.utexas.edu') || user.email?.endsWith('@my.utexas.edu')) && user.email_verified !== true && (
                        <>
                          <button
                            onClick={() => sendVerificationEmail(user)}
                            className="px-3 py-2 bg-primary/20 border border-primary/30 text-primary rounded-lg text-xs hover:bg-primary/30 transition-all"
                          >
                            Verify Email
                          </button>
                          <button
                            onClick={() => markEmailVerified(user.id)}
                            disabled={processingUserId === user.id}
                            className="px-3 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition-all disabled:opacity-50"
                            title="Mark as verified"
                          >
                            ✓
                          </button>
                        </>
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <input
                          type="checkbox"
                          checked={!!(user as any).dues_email_sent_at}
                          onChange={() => toggleDuesEmailSent(user.id, !!(user as any).dues_email_sent_at)}
                          className="w-3.5 h-3.5 rounded border-primary/30 bg-dark-300 text-primary focus:ring-primary/20 cursor-pointer"
                        />
                        Dues sent
                        {(user as any).dues_email_sent_at && (
                          <span className="text-muted-foreground/70">
                            ({new Date((user as any).dues_email_sent_at).toLocaleDateString()})
                          </span>
                        )}
                      </label>
                      {(user.email?.endsWith('@eid.utexas.edu') || user.email?.endsWith('@my.utexas.edu')) && user.email_verified !== true && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <input
                            type="checkbox"
                            checked={!!(user as any).verification_email_sent_at}
                            onChange={() => toggleVerificationEmailSent(user.id, !!(user as any).verification_email_sent_at)}
                            className="w-3.5 h-3.5 rounded border-primary/30 bg-dark-300 text-primary focus:ring-primary/20 cursor-pointer"
                          />
                          Verification sent
                          {(user as any).verification_email_sent_at && (
                            <span className="text-muted-foreground/70">
                              ({new Date((user as any).verification_email_sent_at).toLocaleDateString()})
                            </span>
                          )}
                        </label>
                      )}
                    </div>
                  )}

                  {/* Show email button for recently approved users or active users */}
                  {(recentlyApproved.has(user.id) || (user.account_status === 'approved' || user.account_status === 'active' || user.account_status === null)) && user.account_status !== 'pending_approval' && user.account_status !== 'rejected' && (
                    <button
                      onClick={() => sendApprovalEmail(user)}
                      className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all font-medium text-sm flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Send Welcome Email
                    </button>
                  )}

                  {user.account_status === 'rejected' && (
                    <button
                      onClick={() => updateUserStatus(user.id, 'active')}
                      disabled={processingUserId === user.id}
                      className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingUserId === user.id ? 'Processing...' : 'Reactivate'}
                    </button>
                  )}

                </div>
              </div>
            </div>
          )})}
        </div>
      )}

      {reviewingUser && (
        <div className="portal-modal-backdrop" onMouseDown={closeReview}>
          <div onMouseDown={(event) => event.stopPropagation()} className="portal-modal max-w-md">
            <div className="portal-form-header">
              <div>
                <p className="portal-eyebrow">Semester renewal</p>
                <h2>{reviewingUser.full_name}</h2>
                <p className="text-sm text-muted-foreground">{reviewingUser.email}</p>
              </div>
              <button type="button" onClick={closeReview} className="portal-icon-button"><X className="h-5 w-5" /></button>
            </div>

            {!currentTerm ? (
              <p className="mt-6 text-sm text-muted-foreground">No current term is active.</p>
            ) : !termMemberships[reviewingUser.id] ? (
              <p className="mt-6 text-sm text-muted-foreground">This member hasn't submitted a position code for {currentTerm.name} yet.</p>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Requested position</p>
                    <p className="mt-1 font-medium capitalize">{getRoleDisplayName(termMemberships[reviewingUser.id].position_role)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Dues</p>
                    <p className="mt-1 font-medium capitalize">{termMemberships[reviewingUser.id].dues_status}</p>
                  </div>
                </div>

                {reviewError && <p className="text-sm text-red-700">{reviewError}</p>}

                {termMemberships[reviewingUser.id].dues_status === 'unpaid' && !duesPromptOpen && (
                  <div className="flex gap-2">
                    <button onClick={() => { setDuesAmount(''); setDuesPromptOpen({ annual: false }) }} className="portal-button-secondary small flex-1 justify-center">Record semester dues</button>
                    <button onClick={() => { setDuesAmount(''); setDuesPromptOpen({ annual: true }) }} className="portal-button-secondary small flex-1 justify-center">Record full year</button>
                  </div>
                )}

                {duesPromptOpen && (
                  <form onSubmit={submitDuesAmount} className="space-y-3 rounded-lg border border-border p-3">
                    <label className="block">
                      <span className="portal-label">{duesPromptOpen.annual ? 'Full-year' : 'Semester'} payment amount in dollars</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        className="portal-input w-full"
                        value={duesAmount}
                        onChange={(event) => setDuesAmount(event.target.value)}
                        required
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setDuesPromptOpen(null)} className="portal-button-secondary small">Cancel</button>
                      <button type="submit" disabled={reviewSaving === 'dues'} className="portal-button small">
                        {reviewSaving === 'dues' && <Loader2 className="h-4 w-4 animate-spin" />} Save
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex gap-2 border-t border-border pt-4">
                  <button
                    disabled={reviewSaving !== '' || !['paid', 'exempt'].includes(termMemberships[reviewingUser.id].dues_status)}
                    onClick={() => void submitMembershipDecision('approve')}
                    className="portal-button flex-1 justify-center"
                    title={!['paid', 'exempt'].includes(termMemberships[reviewingUser.id].dues_status) ? 'Record dues before approving' : undefined}
                  >
                    {reviewSaving === 'approve' && <Loader2 className="h-4 w-4 animate-spin" />} Approve
                  </button>
                  <button
                    disabled={reviewSaving !== ''}
                    onClick={() => void submitMembershipDecision('decline')}
                    className="portal-button-ghost flex-1 justify-center"
                  >
                    {reviewSaving === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />} Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Points Breakdown Tab Component
function PointsBreakdownTab() {
  const { profile } = useAuth()
  const [pointsData, setPointsData] = useState<UserPointsBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'active'>('total')
  const [selectedDetailsUser, setSelectedDetailsUser] = useState<UserPointsBreakdown | null>(null)

  // Modal state for manual points entry
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [addingPoints, setAddingPoints] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [memberGroups, setMemberGroups] = useState<CommunicationMemberGroup[]>([])
  const [selectedCategory, setSelectedCategory] = useState<EventCategory>('membership')
  const [selectedEventType, setSelectedEventType] = useState<EventType | ''>('')
  const [customEventType, setCustomEventType] = useState('')
  const [pointsValue, setPointsValue] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [addPointsError, setAddPointsError] = useState<string | null>(null)
  const [addPointsSuccess, setAddPointsSuccess] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [requirementsPublished, setRequirementsPublished] = useState(false)
  // BOSSO requires one flat semester total per role now, not a minimum per
  // category - term_point_rules still stores one row per category (each
  // role's total lives under one category, the other three at zero), so
  // this sums all of a role's rows into the single number that matters.
  const [requiredPointsByRole, setRequiredPointsByRole] = useState<Record<string, number>>({})

  const getAttendanceCategory = (row: any): EventCategory | null => {
    if (row.event_category) return row.event_category as EventCategory
    const joinedEvent = row.event
    if (Array.isArray(joinedEvent)) {
      return (joinedEvent[0]?.event_category as EventCategory | null | undefined) ?? null
    }
    return (joinedEvent?.event_category as EventCategory | null | undefined) ?? null
  }

  const getAdjustmentTitle = (reason: string | null): string => {
    if (!reason) return 'Manual adjustment'
    const cleanReason = reason
      .replace(/\s*\((membership|professional_education|social|philanthropy)\)\s*$/i, '')
      .trim()
    return cleanReason || 'Manual adjustment'
  }

  const getAttendanceEventTitle = (row: any): string => {
    const joinedEvent = row.event
    if (Array.isArray(joinedEvent)) {
      return joinedEvent[0]?.title || 'Event attendance'
    }
    return joinedEvent?.title || 'Event attendance'
  }

  const getAttendanceTimestamp = (row: any): string => {
    const joinedEvent = row.event
    if (Array.isArray(joinedEvent)) {
      return row.checked_in_at || joinedEvent[0]?.start_at || new Date().toISOString()
    }
    return row.checked_in_at || joinedEvent?.start_at || new Date().toISOString()
  }

  useEffect(() => {
    fetchPointsData()

    const onFocus = () => fetchPointsData()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchPointsData()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const fetchPointsData = async () => {
    setLoading(true)
    try {
      const { members, groups } = await fetchCurrentMemberDirectory()
      setMemberGroups(groups)
      const eligibleMembers = members.filter((member) => member.role !== 'admin')
      const eligibleIds = eligibleMembers.map((member) => member.id)
      const usersResult = eligibleIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', eligibleIds)
        : { data: [], error: null }

      if (usersResult.error) throw usersResult.error
      const emailById = new Map((usersResult.data || []).map((member) => [member.id, member.email]))
      const users = eligibleMembers.map((member) => ({
        ...member,
        email: emailById.get(member.id) || '',
      }))

      // Canonical term ledger. Every member and admin view derives from these
      // same rows; the legacy calculation below is only a pre-migration fallback.
      const { data: currentTerm, error: currentTermError } = await supabase
        .from('academic_terms')
        .select('id, points_rules_status')
        .eq('status', 'current')
        .maybeSingle()

      if (!currentTermError && currentTerm) {
        const [summariesResult, ledgerResult, rulesResult] = await Promise.all([
          supabase.from('member_term_point_summary').select('*').eq('term_id', currentTerm.id),
          supabase
            .from('point_ledger')
            .select('*')
            .eq('term_id', currentTerm.id)
            .is('voided_at', null)
            .order('occurred_at', { ascending: false }),
          supabase.from('term_point_rules').select('*').eq('term_id', currentTerm.id),
        ])

        if (!summariesResult.error && !ledgerResult.error && !rulesResult.error) {
          const summariesByUser = new Map((summariesResult.data || []).map((row) => [row.user_id, row]))
          const sourcesByUser = new Map<string, UserPointsBreakdown['source_breakdown']>()
          const requiredByRole: Record<string, number> = {}
          for (const rule of rulesResult.data || []) {
            const role = (rule as any).position_role as string
            requiredByRole[role] = (requiredByRole[role] || 0) + Number(rule.minimum_points || 0)
          }
          setRequirementsPublished(currentTerm.points_rules_status === 'published')
          setRequiredPointsByRole(requiredByRole)

          for (const entry of ledgerResult.data || []) {
            const sources = sourcesByUser.get(entry.user_id) || {
              membership: [],
              professional_education: [],
              social: [],
              philanthropy: [],
              uncategorized: [],
            }
            sources[entry.category as EventCategory].push({
              id: entry.id,
              title: entry.note || entry.source_type.replaceAll('_', ' '),
              points: Number(entry.points || 0),
              timestamp: entry.occurred_at,
            })
            sourcesByUser.set(entry.user_id, sources)
          }

          const canonicalBreakdown: UserPointsBreakdown[] = users.map((member) => {
            const summary = summariesByUser.get(member.id)
            const categories = {
              membership: Number(summary?.membership_points || 0),
              professional_education: Number(summary?.professional_education_points || 0),
              social: Number(summary?.social_points || 0),
              philanthropy: Number(summary?.philanthropy_points || 0),
            }
            const total = Number(summary?.total_points || 0)
            const requirementsPublished = currentTerm.points_rules_status === 'published'
            const meetsRequirement = total >= (requiredByRole[member.role] || 0)

            return {
              user_id: member.id,
              full_name: member.full_name,
              email: member.email,
              role: member.role,
              total_points: total,
              membership_points: categories.membership,
              professional_points: categories.professional_education,
              social_points: categories.social,
              philanthropy_points: categories.philanthropy,
              uncategorized_points: 0,
              is_active: requirementsPublished && meetsRequirement,
              source_breakdown: sourcesByUser.get(member.id) || {
                membership: [],
                professional_education: [],
                social: [],
                philanthropy: [],
                uncategorized: [],
              },
            }
          })

          setPointsData(canonicalBreakdown)
          setLastUpdatedAt(new Date())
          return
        }
      }

      const [attendanceResult, adjustmentsResult] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, user_id, points_earned, event_category, checked_in_at, event:events(event_category, title, start_at)'),
        supabase
          .from('points_adjustments')
          .select('id, user_id, points, reason, created_at'),
      ])

      setRequirementsPublished(true)
      setRequiredPointsByRole({
        general_member: 100,
        analyst: 100,
        project_manager: 100,
        board_member: 100,
      })

      if (attendanceResult.error) throw attendanceResult.error
      if (adjustmentsResult.error) throw adjustmentsResult.error

      const attendanceByUser = new Map<string, any[]>()
      for (const row of attendanceResult.data || []) {
        const existing = attendanceByUser.get(row.user_id) || []
        existing.push(row)
        attendanceByUser.set(row.user_id, existing)
      }

      const adjustmentsByUser = new Map<string, any[]>()
      for (const row of adjustmentsResult.data || []) {
        const existing = adjustmentsByUser.get(row.user_id) || []
        existing.push(row)
        adjustmentsByUser.set(row.user_id, existing)
      }

      const sourceBreakdownByUser = new Map<string, UserPointsBreakdown['source_breakdown']>()
      for (const row of attendanceResult.data || []) {
        const userSources = sourceBreakdownByUser.get(row.user_id) || {
          membership: [],
          professional_education: [],
          social: [],
          philanthropy: [],
          uncategorized: [],
        }

        const category = getAttendanceCategory(row)
        const sourceItem: PointsSourceItem = {
          id: `att-${row.id}`,
          title: getAttendanceEventTitle(row),
          points: Number(row.points_earned || 0),
          timestamp: getAttendanceTimestamp(row),
        }

        if (category) {
          userSources[category].push(sourceItem)
        } else {
          userSources.uncategorized.push(sourceItem)
        }

        sourceBreakdownByUser.set(row.user_id, userSources)
      }

      for (const row of adjustmentsResult.data || []) {
        const userSources = sourceBreakdownByUser.get(row.user_id) || {
          membership: [],
          professional_education: [],
          social: [],
          philanthropy: [],
          uncategorized: [],
        }

        const category = getCategoryFromAdjustmentReason(row.reason)
        const sourceItem: PointsSourceItem = {
          id: `adj-${row.id}`,
          title: getAdjustmentTitle(row.reason),
          points: Number(row.points || 0),
          timestamp: row.created_at || new Date().toISOString(),
        }

        if (category) {
          userSources[category].push(sourceItem)
        } else {
          userSources.uncategorized.push(sourceItem)
        }

        sourceBreakdownByUser.set(row.user_id, userSources)
      }

      const breakdown = users.map((user) => {
        const { categoryTotals, totalPoints, uncategorizedPoints } = buildCategoryTotals(
          attendanceByUser.get(user.id) || [],
          adjustmentsByUser.get(user.id) || []
        )

        const isActive =
          totalPoints >= 100 &&
          categoryTotals.membership >= 25 &&
          categoryTotals.professional_education >= 25 &&
          categoryTotals.social >= 25 &&
          categoryTotals.philanthropy >= 25

        return {
          user_id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          total_points: totalPoints,
          membership_points: categoryTotals.membership,
          professional_points: categoryTotals.professional_education,
          social_points: categoryTotals.social,
          philanthropy_points: categoryTotals.philanthropy,
          uncategorized_points: uncategorizedPoints,
          is_active: isActive,
          source_breakdown: sourceBreakdownByUser.get(user.id) || {
            membership: [],
            professional_education: [],
            social: [],
            philanthropy: [],
            uncategorized: [],
          },
        }
      })

      setPointsData(breakdown)
      setLastUpdatedAt(new Date())
    } catch (error) {
      console.error('Error fetching points data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedData = useMemo(() => {
    let filtered = pointsData.filter(
      (user) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name)
      if (sortBy === 'total') return b.total_points - a.total_points
      if (sortBy === 'active') return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)
      return 0
    })
  }, [pointsData, searchQuery, sortBy])

  const categorySections: Array<{ key: EventCategory | 'uncategorized'; label: string }> = [
    { key: 'membership', label: 'Membership' },
    { key: 'professional_education', label: 'Prof/Edu' },
    { key: 'social', label: 'Social' },
    { key: 'philanthropy', label: 'Philanthropy' },
    { key: 'uncategorized', label: 'Other' },
  ]

  const exportToCSV = () => {
    const headers = [
      'Name',
      'Email',
      'Role',
      'Total Points',
      'Membership',
      'Professional/Education',
      'Social',
      'Philanthropy',
      'Other/Uncategorized',
      'Required This Semester',
      'Requirement Status',
    ]
    const rows = filteredAndSortedData.map((user) => [
      user.full_name,
      user.email,
      user.role.replace('_', ' '),
      user.total_points,
      user.membership_points,
      user.professional_points,
      user.social_points,
      user.philanthropy_points,
      user.uncategorized_points,
      requiredPointsByRole[user.role] || 0,
      requirementsPublished ? (user.is_active ? 'Meets requirement' : 'Below requirement') : 'Rules in draft',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `points-breakdown-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get available event types for selected category
  const availableEventTypes = useMemo(() => {
    return getEventTypesByCategory(selectedCategory)
  }, [selectedCategory])

  // Get all users for user selection
  const userOptions: UserOption[] = useMemo(() => {
    return pointsData.map((user) => ({
      id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    }))
  }, [pointsData])

  useEffect(() => {
    const eligibleIds = new Set(userOptions.map((member) => member.id))
    setSelectedUsers((current) => current.filter((id) => eligibleIds.has(id)))
  }, [userOptions])

  // Reset modal state
  const resetModalState = () => {
    setSelectedUsers([])
    setSelectedCategory('membership')
    setSelectedEventType('')
    setCustomEventType('')
    setPointsValue(0)
    setNotes('')
    setAddPointsError(null)
    setAddPointsSuccess(null)
  }

  // Handle category change
  const handleCategoryChange = (category: EventCategory) => {
    setSelectedCategory(category)
    setSelectedEventType('')
    setCustomEventType('')
    setPointsValue(0)
  }

  // Handle event type change
  const handleEventTypeChange = (eventType: EventType | '') => {
    setSelectedEventType(eventType)
    if (eventType && eventType !== 'other') {
      const typeInfo = EVENT_TYPES[eventType]
      if (typeInfo.points !== null) {
        setPointsValue(typeInfo.points)
      }
    } else {
      setPointsValue(0)
    }
    setCustomEventType('')
  }

  // Add points to selected users
  const handleAddPoints = async () => {
    if (!profile) {
      setAddPointsError('Unable to identify admin profile')
      return
    }

    if (selectedUsers.length === 0) {
      setAddPointsError('Please select at least one user')
      return
    }
    if (!selectedEventType) {
      setAddPointsError('Please select an event type')
      return
    }
    if (pointsValue <= 0) {
      setAddPointsError('Points value must be greater than 0')
      return
    }
    if (selectedEventType === 'other' && !customEventType.trim()) {
      setAddPointsError('Please enter a custom event type name')
      return
    }

    setAddingPoints(true)
    setAddPointsError(null)
    setAddPointsSuccess(null)

    try {
      // Manual awards are stored as point adjustments, not event attendance.
      const adjustments = selectedUsers.map((userId) => ({
        user_id: userId,
        adjusted_by: profile.id,
        points: pointsValue,
        reason:
          selectedEventType === 'other'
            ? `${customEventType.trim()} (${selectedCategory})`
            : `${selectedEventType} (${selectedCategory})`,
      }))

      const { error } = await supabase.from('points_adjustments').insert(adjustments)

      if (error) throw error

      const userCount = selectedUsers.length
      setAddPointsSuccess(
        `Successfully added ${pointsValue} points to ${userCount} user${userCount > 1 ? 's' : ''}`
      )

      // Refresh points data
      await fetchPointsData()

      // Reset form after success
      setTimeout(() => {
        setShowAddPointsModal(false)
        resetModalState()
      }, 1500)
    } catch (err: any) {
      console.error('Error adding points:', err)
      setAddPointsError(err.message || 'Failed to add points')
    } finally {
      setAddingPoints(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with search and export */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="total">Sort by Total Points</option>
            <option value="name">Sort by Name</option>
            <option value="active">Sort by Active Status</option>
          </select>
          <button
            onClick={fetchPointsData}
            className="px-4 py-2 border border-primary/30 text-primary rounded-md text-sm font-medium hover:bg-primary/10 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddPointsModal(true)}
            className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-md text-sm font-medium hover:bg-green-500/30 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Points
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-primary text-dark-300 rounded-md text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
      {lastUpdatedAt && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdatedAt.toLocaleTimeString()}
        </p>
      )}
      {!requirementsPublished && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Point requirements are still in draft. Totals are current, but no member is marked above or below a minimum yet.
        </div>
      )}

      {/* Points table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading points data...</p>
        </div>
      ) : (
        <div className="card-glow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-dark-200/50 border-b border-primary/10">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Member
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Total / Required
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Membership
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prof/Edu
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Social
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Philanthropy
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Other
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {filteredAndSortedData.map((user) => {
                  return (
                    <tr key={user.user_id} className="hover:bg-dark-200/30 transition">
                      <td className="px-2 py-2">
                        <div>
                          <p className="text-xs font-medium text-foreground whitespace-nowrap">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 whitespace-nowrap">
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`text-xs font-bold ${!requirementsPublished ? 'text-foreground' : user.is_active ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {user.total_points}
                          {requirementsPublished && requiredPointsByRole[user.role] > 0 && (
                            <span className="font-normal text-muted-foreground"> / {requiredPointsByRole[user.role]}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="text-xs font-medium text-foreground">{user.membership_points}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="text-xs font-medium text-foreground">{user.professional_points}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="text-xs font-medium text-foreground">{user.social_points}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="text-xs font-medium text-foreground">{user.philanthropy_points}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`text-xs font-medium ${
                            user.uncategorized_points === 0 ? 'text-muted-foreground' : 'text-yellow-400'
                          }`}
                        >
                          {user.uncategorized_points}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap border ${
                            !requirementsPublished
                              ? 'border-border bg-muted text-muted-foreground'
                              : user.is_active
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {!requirementsPublished ? 'Draft' : user.is_active ? 'Meets requirement' : 'Below requirement'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setSelectedDetailsUser(user)}
                          className="px-2 py-1 rounded-md border border-primary/20 text-primary hover:bg-primary/10 transition text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedDetailsUser && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal max-w-2xl p-0 lg:p-0">
            <div className="flex items-center justify-between p-4 border-b border-primary/20">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Points Source Details</h2>
                <p className="text-xs text-muted-foreground">{selectedDetailsUser.full_name}</p>
              </div>
              <button
                onClick={() => setSelectedDetailsUser(null)}
                className="p-1 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {categorySections.map((section) => {
                const entries = [...selectedDetailsUser.source_breakdown[section.key]].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )
                const sectionTotal = entries.reduce((sum, entry) => sum + entry.points, 0)

                return (
                  <div key={section.key} className="rounded-md border border-primary/15 bg-dark-100/70 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">{section.label}</p>
                      <span className={`text-xs font-medium ${sectionTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {sectionTotal >= 0 ? '+' : ''}
                        {sectionTotal}
                      </span>
                    </div>
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No entries</p>
                    ) : (
                      <div className="space-y-1.5">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="text-foreground truncate">{entry.title}</p>
                              <p className="text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`font-medium ${entry.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {entry.points >= 0 ? '+' : ''}
                              {entry.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card-glow p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {requirementsPublished ? <>
            <div className="flex items-center gap-2"><span className="text-emerald-700">●</span><span className="text-muted-foreground">Meets this semester's published point requirement</span></div>
            <div className="flex items-center gap-2"><span className="text-amber-700">●</span><span className="text-muted-foreground">Below this semester's published point requirement</span></div>
          </> : <div className="flex items-center gap-2 md:col-span-2"><span className="text-muted-foreground">●</span><span className="text-muted-foreground">Requirements are in draft; totals are shown without pass/fail labels.</span></div>}
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span className="text-muted-foreground">Yellow: Uncategorized points (included in total)</span>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <span className="text-muted-foreground">Membership/Prof/Social/Philanthropy columns are informational only - BOSSO requires one flat semester total, not a minimum per category.</span>
          </div>
        </div>
      </div>

      {/* Add Points Modal */}
      {showAddPointsModal && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal max-w-lg p-0 lg:p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-primary/20">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-400" />
                Add Points Manually
              </h2>
              <button
                onClick={() => {
                  setShowAddPointsModal(false)
                  resetModalState()
                }}
                className="p-1 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Error/Success Messages */}
              {addPointsError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
                  {addPointsError}
                </div>
              )}
              {addPointsSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm">
                  {addPointsSuccess}
                </div>
              )}

              {/* User Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Select Members <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Search individually, choose a position, or use an admin-created semester group. Point progress does not remove approved members.
                </p>
                <MemberGroupPicker
                  users={userOptions}
                  groups={memberGroups}
                  value={selectedUsers}
                  onChange={setSelectedUsers}
                  placeholder="Search approved current-semester members..."
                />
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value as EventCategory)}
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(EVENT_CATEGORIES).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Event Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedEventType}
                  onChange={(e) => handleEventTypeChange(e.target.value as EventType | '')}
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select event type...</option>
                  {availableEventTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.points !== null ? `(${type.points} pts)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Event Type Name (for "Other") */}
              {selectedEventType === 'other' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Custom Event Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customEventType}
                    onChange={(e) => setCustomEventType(e.target.value)}
                    placeholder="Enter custom event name..."
                    className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {/* Points Value */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Points <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={pointsValue}
                  onChange={(e) => setPointsValue(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {selectedEventType && selectedEventType !== 'other' && EVENT_TYPES[selectedEventType].points !== null && (
                  <p className="text-xs text-muted-foreground">
                    Default: {EVENT_TYPES[selectedEventType].points} points
                  </p>
                )}
              </div>

              {/* Notes (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Notes <span className="text-muted-foreground text-xs">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this points entry..."
                  rows={2}
                  className="w-full px-3 py-2 bg-dark-100 border border-primary/20 rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-primary/20">
              <button
                onClick={() => {
                  setShowAddPointsModal(false)
                  resetModalState()
                }}
                disabled={addingPoints}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPoints}
                disabled={addingPoints || selectedUsers.length === 0 || !selectedEventType || pointsValue <= 0}
                className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-md text-sm font-medium hover:bg-green-500/30 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingPoints ? (
                  <>
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add {pointsValue} Points to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
