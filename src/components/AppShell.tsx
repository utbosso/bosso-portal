'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
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
} from 'lucide-react'

const supabase = createClient()

type NavItem = {
  name: string
  href: string
  icon: any
}

const navigation: NavItem[] = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  { name: 'Events & Calendar', href: '/calendar', icon: Calendar },
  { name: 'Internal Docs', href: '/documents', icon: FolderOpen },
  { name: 'Action Items', href: '/tasks', icon: CheckSquare },
  { name: 'Opportunities', href: '/opportunities', icon: Briefcase },
  { name: 'My Applications', href: '/applications', icon: ClipboardList },
  { name: 'Learning Hub', href: '/resources', icon: BookOpen },
  { name: 'Networking & Alumni', href: '/networking', icon: Users },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Attendance', href: '/attendance', icon: ClipboardCheck },
  { name: 'Event Recaps', href: '/recaps', icon: FileText },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading, signOut } = useAuth()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState<number>(0)

  const roleLabel = profile?.role.replace('_', ' ')
  const isAuthPage = useMemo(
    () => pathname === '/login' || pathname === '/signup',
    [pathname]
  )

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

      const roleHierarchy = {
        general_member: 1,
        analyst: 2,
        project_manager: 3,
        board_member: 4,
      } as const

      const { data: announcements, error } = await supabase
        .from('announcements')
        .select('id, role_scope')

      if (error) {
        console.error('Failed to load announcements for unread count', error)
        setUnreadCount(0)
        return
      }

      const visible = (announcements ?? []).filter((a: any) => {
        if (!a.role_scope) return true
        return roleHierarchy[profile.role] >= roleHierarchy[a.role_scope as keyof typeof roleHierarchy]
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

  // Don't wrap login/signup with shell
  if (isAuthPage) {
    return <>{children}</>
  }

  if (loading) {
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

  const sidebarWidth = sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
  const mainPaddingClass = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'

  return (
    <div className="min-h-screen bg-dark-300">
      {/* Desktop sidebar (collapsible) */}
      <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex ${sidebarWidth} lg:flex-col`}>
        <div className="flex flex-col flex-grow border-r border-primary/20 bg-dark-200 overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-primary/20">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-2xl font-bold text-gradient">
                  BOSSO Portal
                </h1>
                <p className="text-xs text-muted-foreground">
                  Business of Sports @ UT Austin
                </p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
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
                    </span>
                  )}
                </Link>
              )
            })}
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
                <div>
                  <h1 className="text-2xl font-bold text-gradient">
                    BOSSO Portal
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Business of Sports @ UT
                  </p>
                </div>
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
                      {item.name}
                    </Link>
                  )
                })}
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

          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search BOSSO projects, events, and docs..."
                className="w-full pl-10 pr-4 py-2 bg-dark-100 border border-primary/20 rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <button className="relative p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </button>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
