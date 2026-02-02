'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { isAdmin } from '@/lib/admin'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Shield,
  Users,
  FileText,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
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
  Plus,
  X
} from 'lucide-react'
import type { Profile, FeedbackSubmission, Application, EventCategory, EventType, UserRole } from '@/types/database.types'
import { EVENT_CATEGORIES, EVENT_TYPES, getEventTypesByCategory } from '@/lib/bosso-points'
import { meetsRoleRequirements } from '@/lib/membership-tiers'
import { buildCategoryTotals } from '@/lib/points-calculations'
import UserSearch, { UserOption } from '@/components/UserSearch'

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
  meets_role_requirements: boolean
}

export default function AdminDashboard() {
  const { profile } = useAuth()
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
    totalUsers: 0,
    totalApplications: 0,
    totalFeedback: 0,
    pendingFeedback: 0,
    activeApplications: 0,
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
    if (profile && isAdmin(profile.role)) {
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

      // Fetch all applications
      const { data: applications } = await supabase
        .from('applications')
        .select('*')

      // Fetch all feedback
      const { data: feedback } = await supabase
        .from('feedback_submissions')
        .select(`
          *,
          submitter:profiles!feedback_submissions_submitted_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      // Calculate stats
      const totalUsers = users?.length || 0
      const totalApplications = applications?.length || 0
      const totalFeedback = feedback?.length || 0
      const pendingFeedback = feedback?.filter(f => f.status === 'new').length || 0
      const activeApplications = applications?.filter(a =>
        a.status === 'saved' || a.status === 'applied' || a.status === 'interviewing'
      ).length || 0
      const pendingUsers = users?.filter(u => u.account_status === 'pending_approval' || u.account_status === 'pending').length || 0

      // Count users by role
      const roleCount: Record<string, number> = {}
      users?.forEach(user => {
        roleCount[user.role] = (roleCount[user.role] || 0) + 1
      })

      setStats({
        totalUsers,
        totalApplications,
        totalFeedback,
        pendingFeedback,
        activeApplications,
        pendingUsers,
      })
      setRecentUsers(users?.slice(0, 5) || [])
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
    const confirmed = window.confirm('Are you sure you want to delete this feedback? This action cannot be undone.')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('feedback_submissions')
        .delete()
        .eq('id', feedbackId)

      if (error) throw error

      setRecentFeedback(prev => prev.filter(fb => fb.id !== feedbackId))
    } catch (error) {
      console.error('Error deleting feedback:', error)
      alert('Failed to delete feedback. Please try again.')
    }
  }

  if (!profile || !isAdmin(profile.role)) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card-glow p-12 text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Master account oversight and management
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-primary/20">
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
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-400">
                {stats.pendingUsers} user{stats.pendingUsers > 1 ? 's' : ''} awaiting approval
              </h3>
              <p className="text-xs text-yellow-300/80 mt-1">
                New accounts need to be reviewed and approved before they can access the portal.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('users')}
              className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all font-medium text-sm flex-shrink-0"
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Applications</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalApplications}</p>
            </div>
            <ClipboardCheck className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Applications</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.activeApplications}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Feedback</p>
              <p className="text-2xl font-bold text-red-400">{stats.pendingFeedback}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Users by Role */}
      <div className="card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Users by Role</h2>
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
            <h2 className="text-xl font-semibold text-foreground">Recent Users</h2>
          </div>
          <a href="/admin?tab=users" className="text-sm text-primary hover:underline">
            View all
          </a>
        </div>
        <div className="space-y-2">
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

// User Management Tab Component
function UserManagementTab() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending')
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)
  const [recentlyApproved, setRecentlyApproved] = useState<Set<string>>(new Set())

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
      console.log('[Admin] Fetched users:', data)
      console.log('[Admin] User count:', data?.length)
      console.log('[Admin] User roles:', data?.map(u => ({ email: u.email, role: u.role, status: u.account_status })))
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
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
    const email = prompt('Enter the email address of the orphaned auth user to delete:')
    if (!email) return

    if (!email.includes('@eid.utexas.edu') && !email.includes('@my.utexas.edu') && !email.includes('@utexas.edu') && !email.includes('@txbosso.com')) {
      alert('Please enter a valid @eid.utexas.edu, @my.utexas.edu, @utexas.edu, or @txbosso.com email address')
      return
    }

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
    } catch (error: any) {
      console.error('Error cleaning up orphaned auth:', error)
      alert(error.message || 'Failed to cleanup orphaned auth user. Please try again.')
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

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true
    if (filter === 'pending') return user.account_status === 'pending_approval'
    if (filter === 'active') return user.account_status === 'approved' || user.account_status === 'active' || user.account_status === null
    if (filter === 'rejected') return user.account_status === 'rejected'
    return true
  })

  return (
    <div className="space-y-6">
      {/* Cleanup Section */}
      <div className="card-glow p-4 bg-red-500/10 border border-red-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-1">Cleanup Orphaned Auth Users</h3>
            <p className="text-xs text-red-300/80">
              If signup fails with "User already registered" but no profile exists, click here to cleanup
            </p>
          </div>
          <button
            onClick={cleanupOrphanedAuth}
            className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm whitespace-nowrap"
          >
            Cleanup Orphaned Auth
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
              {tab === 'pending' && users.filter(u => u.account_status === 'pending_approval').length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  {users.filter(u => u.account_status === 'pending_approval').length}
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
          {filteredUsers.map((user) => (
            <div key={user.id} className="card-glow p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {user.full_name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        user.account_status === 'approved' || user.account_status === null
                          ? 'bg-green-500/20 text-green-400'
                          : user.account_status === 'pending_approval'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {user.account_status || 'Active'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{user.email}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {getRoleDisplayName(user.role)}
                    </span>
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
                    <div className="mt-3 pt-3 border-t border-primary/10">
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
                <div className="flex flex-col gap-3 min-w-[280px]">
                  {user.account_status === 'pending_approval' && (
                    <>
                      {/* Primary Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUserStatus(user.id, 'active')}
                          disabled={processingUserId === user.id}
                          className="flex-1 px-3 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === user.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => updateUserStatus(user.id, 'rejected')}
                          disabled={processingUserId === user.id}
                          className="flex-1 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === user.id ? '...' : 'Reject'}
                        </button>
                        <button
                          onClick={() => deleteUser(user.id, user.email)}
                          disabled={processingUserId === user.id}
                          className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400/70 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Email Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendDuesPaymentRequest(user)}
                          className="flex-1 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded text-xs hover:bg-yellow-500/30 transition-all"
                        >
                          Request Dues
                        </button>
                        {(user.email?.endsWith('@eid.utexas.edu') || user.email?.endsWith('@my.utexas.edu')) && user.email_verified !== true && (
                          <>
                            <button
                              onClick={() => sendVerificationEmail(user)}
                              className="flex-1 px-3 py-1.5 bg-primary/20 border border-primary/30 text-primary rounded text-xs hover:bg-primary/30 transition-all"
                            >
                              Verify Email
                            </button>
                            <button
                              onClick={() => markEmailVerified(user.id)}
                              disabled={processingUserId === user.id}
                              className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-all disabled:opacity-50"
                              title="Mark as verified"
                            >
                              ✓
                            </button>
                          </>
                        )}
                      </div>

                      {/* Email sent tracking */}
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <input
                            type="checkbox"
                            checked={!!(user as any).dues_email_sent_at}
                            onChange={() => toggleDuesEmailSent(user.id, !!(user as any).dues_email_sent_at)}
                            className="w-3.5 h-3.5 rounded border-primary/30 bg-dark-300 text-primary focus:ring-primary/20 cursor-pointer"
                          />
                          Dues email sent
                          {(user as any).dues_email_sent_at && (
                            <span className="text-muted-foreground/70">
                              ({new Date((user as any).dues_email_sent_at).toLocaleDateString()})
                            </span>
                          )}
                        </label>
                        {(user.email?.endsWith('@eid.utexas.edu') || user.email?.endsWith('@my.utexas.edu')) && user.email_verified !== true && (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                            <input
                              type="checkbox"
                              checked={!!(user as any).verification_email_sent_at}
                              onChange={() => toggleVerificationEmailSent(user.id, !!(user as any).verification_email_sent_at)}
                              className="w-3.5 h-3.5 rounded border-primary/30 bg-dark-300 text-primary focus:ring-primary/20 cursor-pointer"
                            />
                            Verification email sent
                            {(user as any).verification_email_sent_at && (
                              <span className="text-muted-foreground/70">
                                ({new Date((user as any).verification_email_sent_at).toLocaleDateString()})
                              </span>
                            )}
                          </label>
                        )}
                      </div>
                    </>
                  )}

                  {/* Show email button for recently approved users or active users */}
                  {(recentlyApproved.has(user.id) || (user.account_status === 'approved' || user.account_status === 'active' || user.account_status === null)) && user.account_status !== 'pending_approval' && user.account_status !== 'rejected' && (
                    <button
                      onClick={() => sendApprovalEmail(user)}
                      className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all font-medium text-sm flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {recentlyApproved.has(user.id) ? 'Send Welcome Email' : 'Send Email'}
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

                  {/* Delete button - avoid duplicate for pending_approval users */}
                  {user.account_status !== 'pending_approval' && (
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      disabled={processingUserId === user.id}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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

  // Modal state for manual points entry
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [addingPoints, setAddingPoints] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<EventCategory>('membership')
  const [selectedEventType, setSelectedEventType] = useState<EventType | ''>('')
  const [customEventType, setCustomEventType] = useState('')
  const [pointsValue, setPointsValue] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [addPointsError, setAddPointsError] = useState<string | null>(null)
  const [addPointsSuccess, setAddPointsSuccess] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

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
      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name', { ascending: true })

      if (usersError) throw usersError

      const [attendanceResult, adjustmentsResult] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('user_id, points_earned, event_category, event:events(event_category)'),
        supabase
          .from('points_adjustments')
          .select('user_id, points, reason'),
      ])

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

      const breakdown = (users || []).map((user) => {
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

        const roleRequirement = meetsRoleRequirements(user.role as UserRole, totalPoints, categoryTotals)

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
          meets_role_requirements: roleRequirement.meets,
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
      'Active Status',
      'Meets Role Requirements',
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
      user.is_active ? 'Active' : 'Inactive',
      user.meets_role_requirements ? 'Yes' : 'No',
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
                    Total
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
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {filteredAndSortedData.map((user) => (
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
                      <span className="text-xs font-bold text-foreground">{user.total_points}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-medium ${
                          user.membership_points >= 25 ? 'text-green-400' : 'text-orange-400'
                        }`}
                      >
                        {user.membership_points}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-medium ${
                          user.professional_points >= 25 ? 'text-green-400' : 'text-orange-400'
                        }`}
                      >
                        {user.professional_points}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-medium ${
                          user.social_points >= 25 ? 'text-green-400' : 'text-orange-400'
                        }`}
                      >
                        {user.social_points}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-medium ${
                          user.philanthropy_points >= 25 ? 'text-green-400' : 'text-orange-400'
                        }`}
                      >
                        {user.philanthropy_points}
                      </span>
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
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            user.is_active
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {!user.meets_role_requirements && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap">
                            Below req.
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card-glow p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-green-400">●</span>
            <span className="text-muted-foreground">Green: 25+ points (meets category minimum)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">●</span>
            <span className="text-muted-foreground">Orange: Below 25 points (needs more)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span className="text-muted-foreground">Yellow: Uncategorized points (included in total)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
            <span className="text-muted-foreground">100+ total points AND 25+ in each category</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Below role req.</span>
            <span className="text-muted-foreground">Doesn't meet minimum points for current role</span>
          </div>
        </div>
      </div>

      {/* Add Points Modal */}
      {showAddPointsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-200 border border-primary/20 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

                {/* Quick Select by Role */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Quick select by role:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allUserIds = userOptions.map(u => u.id)
                        setSelectedUsers(allUserIds)
                      }}
                      className="px-2.5 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded-md hover:bg-primary/30 transition"
                    >
                      All Members
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = userOptions.filter(u => u.role === 'general_member').map(u => u.id)
                        setSelectedUsers(prev => [...new Set([...prev, ...ids])])
                      }}
                      className="px-2.5 py-1 text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-md hover:bg-gray-500/30 transition"
                    >
                      General Members
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = userOptions.filter(u => u.role === 'analyst').map(u => u.id)
                        setSelectedUsers(prev => [...new Set([...prev, ...ids])])
                      }}
                      className="px-2.5 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-500/30 transition"
                    >
                      Analysts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = userOptions.filter(u => u.role === 'project_manager').map(u => u.id)
                        setSelectedUsers(prev => [...new Set([...prev, ...ids])])
                      }}
                      className="px-2.5 py-1 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-md hover:bg-purple-500/30 transition"
                    >
                      Project Managers
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = userOptions.filter(u => u.role === 'board_member').map(u => u.id)
                        setSelectedUsers(prev => [...new Set([...prev, ...ids])])
                      }}
                      className="px-2.5 py-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-md hover:bg-yellow-500/30 transition"
                    >
                      Board Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUsers([])}
                      className="px-2.5 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/30 transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Individual Search */}
                <UserSearch
                  users={userOptions}
                  value={selectedUsers}
                  onChange={(value) => setSelectedUsers(value as string[])}
                  placeholder="Search and select individual members..."
                  multiple={true}
                />
                <p className="text-xs text-muted-foreground">
                  {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
                </p>
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
