'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { isAdmin } from '@/lib/admin'
import { canAccessRoleScope } from '@/lib/role-scope'
import {
  LayoutDashboard,
  Megaphone,
  Calendar,
  FolderOpen,
  CheckSquare,
  Briefcase,
  ClipboardList,
  BookOpen,
  Users,
  MessageSquare,
  ClipboardCheck,
  FileText,
  Search,
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  ExternalLink,
  Globe,
  Linkedin,
  Link as LinkTreeIcon,
  Instagram,
  Slack,
  Shield,
} from 'lucide-react'

const supabase = createClient()

type NavItem = {
  name: string
  href: string
  icon: any
  keywords?: string[]
}

// Helper function to get time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

const navigation: NavItem[] = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
    keywords: ['dashboard', 'overview', 'main', 'summary', 'stats', 'statistics']
  },
  {
    name: 'Announcements',
    href: '/announcements',
    icon: Megaphone,
    keywords: ['news', 'updates', 'posts', 'messages', 'notifications', 'alerts']
  },
  {
    name: 'Events & Calendar',
    href: '/calendar',
    icon: Calendar,
    keywords: ['events', 'calendar', 'schedule', 'meetings', 'dates', 'upcoming']
  },
  {
    name: 'Internal Docs',
    href: '/documents',
    icon: FolderOpen,
    keywords: ['documents', 'files', 'folders', 'shared', 'internal', 'docs']
  },
  {
    name: 'Action Items',
    href: '/tasks',
    icon: CheckSquare,
    keywords: ['tasks', 'todos', 'action items', 'assignments', 'work', 'projects']
  },
  {
    name: 'Opportunities',
    href: '/opportunities',
    icon: Briefcase,
    keywords: ['jobs', 'internships', 'positions', 'careers', 'openings', 'roles']
  },
  {
    name: 'My Applications',
    href: '/applications',
    icon: ClipboardList,
    keywords: ['applications', 'apply', 'job applications', 'submissions', 'track']
  },
  {
    name: 'Learning Hub',
    href: '/resources',
    icon: BookOpen,
    keywords: ['resources', 'learning', 'education', 'guides', 'tutorials', 'materials', 'courses']
  },
  {
    name: 'Networking & Alumni',
    href: '/networking',
    icon: Users,
    keywords: ['networking', 'contacts', 'alumni', 'connections', 'people', 'network']
  },
  {
    name: 'Feedback',
    href: '/feedback',
    icon: MessageSquare,
    keywords: ['feedback', 'suggestions', 'comments', 'opinions', 'reviews', 'input']
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: ClipboardCheck,
    keywords: ['attendance', 'checkin', 'check-in', 'present', 'points']
  },
]

const quickLinks = [
  { name: 'Website', url: 'http://www.txbosso.com/', icon: Globe },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/company/txbosso/', icon: Linkedin },
  { name: 'Linktree', url: 'https://linktr.ee/txbosso', icon: LinkTreeIcon },
  { name: 'HornsLink', url: 'https://utexas.campuslabs.com/engage/organization/txsportsanalytics', icon: ExternalLink },
  { name: 'Instagram', url: 'https://www.instagram.com/txbosso/', icon: Instagram },
  { name: 'Slack', url: 'https://join.slack.com/t/txsportsanalytics/shared_invite/zt-35k0niv81-FW1kud7SUEvCDNgtZF6Ocw', icon: Slack },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, profile, loading, signOut } = useAuth()

  // Track if we've loaded once - after first load, don't show loading spinner
  // This prevents scroll reset when switching browser tabs
  const hasLoadedOnceRef = useRef(false)
  const scrollPositionRef = useRef(0)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [taskCount, setTaskCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [isLightTheme, setIsLightTheme] = useState(false)

  const roleLabel = profile?.role.replace('_', ' ')
  const isAuthPage = useMemo(
    () => pathname === '/login' || pathname === '/signup' || pathname?.startsWith('/auth/') || pathname === '/pending-approval' || pathname === '/verify-email',
    [pathname]
  )

  const scrollKey = useMemo(() => {
    const query = searchParams?.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    return () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `scroll:${scrollKey}`

    const restoreIfNeeded = () => {
      const stored = sessionStorage.getItem(key)
      const y = stored ? Number(stored) : 0
      if (Number.isFinite(y) && y > 0 && window.scrollY === 0) {
        requestAnimationFrame(() => window.scrollTo(0, y))
      }
    }

    const handleScroll = () => {
      const y = window.scrollY
      scrollPositionRef.current = y
      sessionStorage.setItem(key, String(y))
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem(key, String(window.scrollY))
      } else {
        restoreIfNeeded()
      }
    }

    restoreIfNeeded()

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pageshow', restoreIfNeeded)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pageshow', restoreIfNeeded)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sessionStorage.setItem(key, String(window.scrollY))
    }
  }, [scrollKey])

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsLightTheme(document.body.classList.contains('light'))
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.push('/login')
    }
  }, [user, loading, router, isAuthPage])

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!profile) {
        setUnreadCount(0)
        return
      }

      const { data: announcements, error } = await supabase
        .from('announcements')
        .select('id, role_scope, role_scope_mode')

      if (error) {
        console.error('Failed to load announcements for unread count', error)
        setUnreadCount(0)
        return
      }

      const visible = (announcements ?? []).filter((a: any) => {
        return canAccessRoleScope(profile.role, a.role_scope, a.role_scope_mode)
      })

      const { data: reads, error: readsError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', profile.id)

      if (readsError) {
        console.error('Failed to load announcement reads', readsError)
        setUnreadCount(0)
        return
      }

      const readIds = new Set((reads ?? []).map((r: any) => r.announcement_id))
      const unread = visible.filter((a: any) => !readIds.has(a.id))
      setUnreadCount(unread.length)
    }

    fetchUnreadCount()
  }, [profile, pathname])

  useEffect(() => {
    const fetchTaskCount = async () => {
      if (!profile) {
        setTaskCount(0)
        return
      }

      try {
        // Count tasks assigned to me (not completed)
        const { data: assignedTasks, error: assignedError } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('assigned_to', profile.id)
          .neq('status', 'completed')

        if (assignedError) throw assignedError

        // Count unread task notifications for me
        const { data: notifications, error: notificationsError } = await supabase
          .from('task_notifications')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_read', false)

        if (notificationsError) throw notificationsError

        // Tasks assigned to me that are not completed
        const assignedCount = assignedTasks?.length || 0

        // Unread notifications count
        const notificationsCount = notifications?.length || 0

        setTaskCount(assignedCount + notificationsCount)
      } catch (err) {
        console.error('Failed to load task count', err)
        setTaskCount(0)
      }
    }

    fetchTaskCount()
  }, [profile, pathname])

  // Search functionality with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      if (!profile) return

      setSearchLoading(true)
      try {
        const query = searchQuery.toLowerCase()
        const results: any[] = []

        // Search navigation pages/keywords
        const pageMatches = navigation.filter(page =>
          page.name.toLowerCase().includes(query) ||
          page.href.toLowerCase().includes(query) ||
          page.keywords?.some(keyword => keyword.toLowerCase().includes(query))
        )

        pageMatches.forEach(page => results.push({
          type: 'page',
          id: page.href,
          title: page.name,
          subtitle: 'Navigate to page',
          href: page.href,
          icon: page.icon,
        }))

        // Search admin page if user is admin
        if (profile && isAdmin(profile.role)) {
          const adminKeywords = ['admin', 'dashboard', 'user management', 'users', 'accounts', 'manage users', 'approve', 'pending']
          if (adminKeywords.some(keyword => keyword.includes(query))) {
            results.push({
              type: 'page',
              id: '/admin',
              title: 'Admin Dashboard',
              subtitle: 'Navigate to page',
              href: '/admin',
              icon: Shield,
            })
          }
        }

        // Search settings page
        const settingsKeywords = ['settings', 'preferences', 'profile', 'account', 'theme', 'dark mode', 'light mode']
        if (settingsKeywords.some(keyword => keyword.includes(query))) {
          results.push({
            type: 'page',
            id: '/settings',
            title: 'Settings',
            subtitle: 'Navigate to page',
            href: '/settings',
            icon: Settings,
          })
        }

        // Search announcements
        const { data: announcements } = await supabase
          .from('announcements')
          .select('id, title, created_at')
          .ilike('title', `%${query}%`)
          .limit(3)

        if (announcements) {
          announcements.forEach(item => results.push({
            type: 'announcement',
            id: item.id,
            title: item.title,
            href: `/announcements/${item.id}`,
            icon: Megaphone,
          }))
        }

        // Search events
        const { data: events } = await supabase
          .from('events')
          .select('id, title, event_date')
          .ilike('title', `%${query}%`)
          .limit(3)

        if (events) {
          events.forEach(item => results.push({
            type: 'event',
            id: item.id,
            title: item.title,
            subtitle: item.event_date ? new Date(item.event_date).toLocaleDateString() : '',
            href: `/calendar`,
            icon: Calendar,
          }))
        }

        // Search documents
        const { data: documents } = await supabase
          .from('documents')
          .select('id, name, type')
          .ilike('name', `%${query}%`)
          .limit(3)

        if (documents) {
          documents.forEach(item => results.push({
            type: 'document',
            id: item.id,
            title: item.name,
            subtitle: item.type === 'folder' ? 'Folder' : 'Document',
            href: `/documents`,
            icon: item.type === 'folder' ? FolderOpen : FileText,
          }))
        }

        // Search tasks
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, status')
          .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
          .ilike('title', `%${query}%`)
          .limit(3)

        if (tasks) {
          tasks.forEach(item => results.push({
            type: 'task',
            id: item.id,
            title: item.title,
            subtitle: item.status.replace('_', ' '),
            href: `/tasks`,
            icon: CheckSquare,
          }))
        }

        // Search opportunities
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('id, title, company')
          .ilike('title', `%${query}%`)
          .limit(3)

        if (opportunities) {
          opportunities.forEach(item => results.push({
            type: 'opportunity',
            id: item.id,
            title: item.title,
            subtitle: item.company || '',
            href: `/opportunities`,
            icon: Briefcase,
          }))
        }

        setSearchResults(results)
        setShowSearchResults(results.length > 0)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearchLoading(false)
      }
    }, 300) // Debounce for 300ms

    return () => clearTimeout(timeoutId)
  }, [searchQuery, profile])

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      }
      if (e.key === 'Escape') {
        setShowSearchResults(false)
        setSearchQuery('')
        setShowNotifications(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profile) return

      try {
        const allNotifications: any[] = []

        // 1. Unread announcements
        const { data: announcements } = await supabase
          .from('announcements')
          .select('id, title, created_at, role_scope, role_scope_mode')
          .order('created_at', { ascending: false })
          .limit(10)

        if (announcements) {
          const visible = announcements.filter((a: any) => {
            return canAccessRoleScope(profile.role, a.role_scope, a.role_scope_mode)
          })

          const { data: reads } = await supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', profile.id)

          const readIds = new Set((reads ?? []).map((r: any) => r.announcement_id))
          const unreadAnnouncements = visible.filter((a: any) => !readIds.has(a.id))

          unreadAnnouncements.forEach(item => allNotifications.push({
            id: `announcement-${item.id}`,
            type: 'announcement',
            title: item.title,
            message: 'New announcement',
            time: new Date(item.created_at),
            href: `/announcements/${item.id}`,
            icon: Megaphone,
            unread: true,
          }))
        }

        // 2. Task notifications
        const { data: taskNotifs } = await supabase
          .from('task_notifications')
          .select('*, tasks(title)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (taskNotifs) {
          taskNotifs.forEach((notif: any) => allNotifications.push({
            id: `task-notif-${notif.id}`,
            type: 'task',
            title: notif.tasks?.title || 'Task update',
            message: notif.message,
            time: new Date(notif.created_at),
            href: `/tasks`,
            icon: CheckSquare,
            unread: !notif.is_read,
            notificationId: notif.id,
          }))
        }

        // 3. Upcoming events (within next 7 days)
        const today = new Date()
        const nextWeek = new Date(today)
        nextWeek.setDate(today.getDate() + 7)

        const { data: upcomingEvents } = await supabase
          .from('events')
          .select('id, title, event_date')
          .gte('event_date', today.toISOString())
          .lte('event_date', nextWeek.toISOString())
          .order('event_date', { ascending: true })
          .limit(5)

        if (upcomingEvents) {
          upcomingEvents.forEach((event: any) => {
            const eventDate = new Date(event.event_date)
            const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

            allNotifications.push({
              id: `event-${event.id}`,
              type: 'event',
              title: event.title,
              message: daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`,
              time: eventDate,
              href: `/calendar`,
              icon: Calendar,
              unread: false,
            })
          })
        }

        // Sort by time (newest first) and unread status
        allNotifications.sort((a, b) => {
          if (a.unread && !b.unread) return -1
          if (!a.unread && b.unread) return 1
          return b.time.getTime() - a.time.getTime()
        })

        setNotifications(allNotifications)
        setNotificationCount(allNotifications.filter(n => n.unread).length)
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    fetchNotifications()
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [profile, pathname])

  // Don't wrap login/signup with shell
  if (isAuthPage) {
    return <>{children}</>
  }

  // Only show loading spinner on initial load, not on subsequent re-renders
  // This prevents scroll position from resetting when switching browser tabs
  if (loading && !hasLoadedOnceRef.current) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading BOSSO Portal...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  // Mark that we've loaded at least once
  if (!hasLoadedOnceRef.current && user && profile) {
    hasLoadedOnceRef.current = true
  }

  const sidebarWidth = sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
  const mainPaddingClass = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'

  return (
    <div className="min-h-screen bg-dark-300">
      {/* Desktop sidebar (collapsible) */}
      <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex ${sidebarWidth} lg:flex-col`}>
        <div className="flex flex-col flex-grow border-r border-primary/20 bg-dark-200 overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-primary/20">
            {!sidebarCollapsed && (
              <Link href="/dashboard" className="flex items-center gap-3">
                <Image
                  src={isLightTheme ? "/bosso-logo-light.png" : "/bosso-logo-dark.png"}
                  alt="BOSSO Logo"
                  width={40}
                  height={40}
                  className="flex-shrink-0"
                />
                <div>
                  <h1 className="text-xl font-bold text-gradient">
                    BOSSO Portal
                  </h1>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Business of Sports @ UT Austin
                  </p>
                </div>
              </Link>
            )}
            {sidebarCollapsed && (
              <Link href="/dashboard" className="flex items-center justify-center">
                <Image
                  src={isLightTheme ? "/bosso-logo-light.png" : "/bosso-logo-dark.png"}
                  alt="BOSSO Logo"
                  width={32}
                  height={32}
                  className="flex-shrink-0"
                />
              </Link>
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all hover:bg-primary/10 ${
                    active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {!sidebarCollapsed && (
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.href === '/announcements' && unreadCount > 0 && (
                        <span className="min-w-[20px] px-2 py-0.5 rounded-full bg-destructive text-[11px] font-semibold text-dark-300 text-center">
                          {unreadCount}
                        </span>
                      )}
                      {item.href === '/tasks' && taskCount > 0 && (
                        <span className="min-w-[20px] px-2 py-0.5 rounded-full bg-primary text-[11px] font-semibold text-dark-300 text-center">
                          {taskCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* Admin Link (only for admins) */}
            {profile && isAdmin(profile.role) && (
              <Link
                href="/admin"
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all hover:bg-red-500/10 ${
                  pathname.startsWith('/admin')
                    ? 'text-red-400 bg-red-500/10 border border-red-500/30'
                    : 'text-red-400/80 hover:text-red-400 border border-transparent hover:border-red-500/20'
                }`}
              >
                <Shield className="w-5 h-5" />
                {!sidebarCollapsed && <span>Admin Dashboard</span>}
              </Link>
            )}

            {/* Quick Links Section */}
            {!sidebarCollapsed && (
              <div className="pt-4 mt-4 border-t border-primary/20">
                <p className="px-3 mb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Quick Links
                </p>
                {quickLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary group"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1">{link.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )
                })}
              </div>
            )}
          </nav>

          <div className="border-t border-primary/20 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-dark-300 font-bold">
                {profile.full_name.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    BOSSO • {roleLabel}
                  </p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="space-y-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (slide-in) */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-dark-200 border-r border-primary/20 z-50 lg:hidden">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-16 px-4 border-b border-primary/20">
                <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
                  <Image
                    src={isLightTheme ? "/bosso-logo-light.png" : "/bosso-logo-dark.png"}
                    alt="BOSSO Logo"
                    width={40}
                    height={40}
                    className="flex-shrink-0"
                  />
                  <div>
                    <h1 className="text-xl font-bold text-gradient">
                      BOSSO Portal
                    </h1>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Business of Sports @ UT
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-muted-foreground hover:text-primary"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                        active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="flex items-center gap-2 flex-1">
                        {item.name}
                        {item.href === '/announcements' && unreadCount > 0 && (
                          <span className="min-w-[20px] px-2 py-0.5 rounded-full bg-destructive text-[11px] font-semibold text-dark-300 text-center">
                            {unreadCount}
                          </span>
                        )}
                        {item.href === '/tasks' && taskCount > 0 && (
                          <span className="min-w-[20px] px-2 py-0.5 rounded-full bg-primary text-[11px] font-semibold text-dark-300 text-center">
                            {taskCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  )
                })}

                {/* Admin Link (only for admins) */}
                {profile && isAdmin(profile.role) && (
                  <Link
                    href="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                      pathname.startsWith('/admin')
                        ? 'text-red-400 bg-red-500/10 border border-red-500/30'
                        : 'text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    <span>Admin Dashboard</span>
                  </Link>
                )}

                {/* Quick Links Section */}
                <div className="pt-4 mt-4 border-t border-primary/20">
                  <p className="px-4 mb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Quick Links
                  </p>
                  {quickLinks.map((link) => {
                    const Icon = link.icon
                    return (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary group"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1">{link.name}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )
                  })}
                </div>
              </nav>

              <div className="border-t border-primary/20 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-dark-300 font-bold">
                    {profile.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      BOSSO • {roleLabel}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Link
                    href="/settings"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className={mainPaddingClass}>
        <header className="sticky top-0 z-30 flex items-center gap-4 h-16 px-4 border-b border-primary/20 bg-dark-200/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-muted-foreground hover:text-primary lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 max-w-lg relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="global-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                placeholder="Search BOSSO (Ctrl+K)..."
                className="w-full pl-10 pr-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-dark-100 border border-primary/20 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
                <div className="p-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide px-3 py-2">
                    Search Results ({searchResults.length})
                  </div>
                  {searchResults.map((result) => {
                    const Icon = result.icon
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.href}
                        onClick={() => {
                          setShowSearchResults(false)
                          setSearchQuery('')
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 transition-colors group"
                      >
                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground truncate capitalize">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground px-2 py-1 bg-dark-200 rounded capitalize">
                          {result.type}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Click outside to close */}
            {showSearchResults && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSearchResults(false)}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
            >
              <Bell className="w-6 h-6" />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-accent rounded-full">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-dark-100 border border-primary/20 rounded-lg shadow-2xl max-h-[600px] overflow-hidden z-50 flex flex-col">
                <div className="p-4 border-b border-primary/20 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
                  {notificationCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {notificationCount} unread
                    </span>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {notifications.map((notif) => {
                        const Icon = notif.icon
                        const timeAgo = getTimeAgo(notif.time)

                        return (
                          <Link
                            key={notif.id}
                            href={notif.href}
                            onClick={async () => {
                              setShowNotifications(false)

                              // Mark task notification as read
                              if (notif.type === 'task' && notif.notificationId && notif.unread) {
                                await supabase
                                  .from('task_notifications')
                                  .update({ is_read: true })
                                  .eq('id', notif.notificationId)
                              }
                            }}
                            className={`flex gap-3 p-3 rounded-lg hover:bg-primary/10 transition-colors ${
                              notif.unread ? 'bg-primary/5 border border-primary/20' : ''
                            }`}
                          >
                            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                              notif.unread ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                notif.unread ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {notif.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {notif.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {timeAgo}
                              </p>
                            </div>
                            {notif.unread && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Click outside to close */}
            {showNotifications && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
            )}
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
