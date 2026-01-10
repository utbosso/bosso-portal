'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { isAdmin } from '@/lib/admin'
import { useState, useEffect } from 'react'
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
  Trash2
} from 'lucide-react'
import type { Profile, FeedbackSubmission, Application } from '@/types/database.types'

const supabase = createClient()

type TabType = 'overview' | 'users'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
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

  useEffect(() => {
    if (profile && isAdmin(profile.role)) {
      fetchDashboardData()
    }
  }, [profile])

  const fetchDashboardData = async () => {
    setLoading(true)
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
          <a href="/admin/users" className="text-sm text-primary hover:underline">
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
                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                  fb.status === 'new' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  fb.status === 'reviewed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  fb.status === 'in_progress' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                  fb.status === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {fb.status.replace('_', ' ')}
                </span>
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

    if (!email.includes('@eid.utexas.edu') && !email.includes('@utexas.edu') && !email.includes('@txbosso.com')) {
      alert('Please enter a valid @eid.utexas.edu, @utexas.edu, or @txbosso.com email address')
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

You can now access the full portal at: https://portal.txbosso.com

Your Account Details:
• Name: ${user.full_name}
• Email: ${user.email}
• Role: ${user.role.replace('_', ' ')}

If you have any questions or need assistance, feel free to reach out to the board.

Welcome to the team!

Best regards,
BOSSO@UTAustin`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
  }

  const sendDuesPaymentRequest = (user: Profile) => {
    const subject = encodeURIComponent('BOSSO Portal - Dues Payment Required')
    const body = encodeURIComponent(`Hi ${user.full_name},

Thank you for creating a BOSSO Portal account!

Before we can approve your account, we need to confirm that you have paid your membership dues.

Dues Payment Information:
• Amount: [INSERT AMOUNT HERE]
• Payment Method: [INSERT PAYMENT INSTRUCTIONS - Venmo/Zelle/etc.]
• Payment Link: [INSERT LINK IF APPLICABLE]

Once you have completed the payment, please reply to this email with:
1. Confirmation of payment (screenshot or transaction ID)
2. Date of payment

We will approve your portal account within 24-48 hours of receiving confirmation.

If you have already paid your dues, please reply with your confirmation details and we'll get you approved right away.

If you have any questions about dues or the payment process, feel free to reach out.

Account Details:
Name: ${user.full_name}
Email: ${user.email}
Role: ${user.role.replace('_', ' ')}

Best regards,
BOSSO@UTAustin`)

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank')
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

      {/* Filter Tabs */}
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
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {user.account_status === 'pending_approval' && (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUserStatus(user.id, 'active')}
                          disabled={processingUserId === user.id}
                          className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === user.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => updateUserStatus(user.id, 'rejected')}
                          disabled={processingUserId === user.id}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === user.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                      <button
                        onClick={() => sendDuesPaymentRequest(user)}
                        className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Request Dues Payment
                      </button>

                      {/* Email verification buttons for @eid.utexas.edu users */}
                      {user.email?.endsWith('@eid.utexas.edu') && user.email_verified !== true && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => sendVerificationEmail(user)}
                            className="flex-1 px-4 py-2 bg-primary/20 border border-primary/30 text-primary rounded-lg hover:bg-primary/30 transition-all font-medium text-sm flex items-center justify-center gap-2"
                            title="Open email client with pre-filled verification message"
                          >
                            <Mail className="w-4 h-4" />
                            Send Verification Email
                          </button>
                          <button
                            onClick={() => markEmailVerified(user.id)}
                            disabled={processingUserId === user.id}
                            className="flex-1 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                            title="Mark email as verified after receiving reply"
                          >
                            {processingUserId === user.id ? 'Processing...' : '✓ Mark Verified'}
                          </button>
                        </div>
                      )}
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

                  {/* Delete button - appears for all users */}
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    disabled={processingUserId === user.id}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
