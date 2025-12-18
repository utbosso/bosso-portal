'use client'

import { useAuth } from '@/hooks/useAuth'
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  Briefcase,
  TrendingUp,
  Clock,
} from 'lucide-react'

export default function DashboardPage() {
  const { profile } = useAuth()

  if (!profile) return null

  const firstName = profile.full_name.split(' ')[0]

  const stats = [
    {
      name: 'Active Members',
      value: '124',
      icon: Users,
      color: 'from-primary to-cyan-400',
      change: '+12% this semester',
    },
    {
      name: 'Upcoming BOSSO Events',
      value: '8',
      icon: Calendar,
      color: 'from-secondary to-purple-400',
      change: '+3 this week',
    },
    {
      name: 'Live Projects',
      value: '5',
      icon: CheckSquare,
      color: 'from-accent to-pink-400',
      change: '2 client-facing',
    },
    {
      name: 'Open Opportunities',
      value: '23',
      icon: Briefcase,
      color: 'from-green-500 to-emerald-400',
      change: '+6 new roles',
    },
  ]

  const recentActivity = [
    {
      title: 'New consulting brief posted',
      description: 'NBA fan engagement project added to Consulting board.',
      time: '2 hours ago',
      type: 'consulting',
    },
    {
      title: 'Research topic assigned',
      description: 'Player efficiency study for Western Conference teams.',
      time: '5 hours ago',
      type: 'research',
    },
    {
      title: 'Workshop added',
      description: 'Intro to sports analytics and modeling this Thursday.',
      time: '1 day ago',
      type: 'education',
    },
    {
      title: 'New internship opportunity',
      description: 'Sports analytics intern role added to Opportunities.',
      time: '2 days ago',
      type: 'opportunity',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gradient">
          Welcome back, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Here is what is happening across BOSSO right now.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="card-glow p-6 space-y-3 hover:scale-105 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-green-400 font-medium">
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <div className="lg:col-span-2 card-glow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Recent BOSSO Activity</h2>
            <button className="text-sm text-primary hover:text-primary/80 transition-colors">
              View full activity
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex gap-4 p-4 rounded-lg bg-dark-100 border border-primary/10 hover:border-primary/30 transition-all hover-glow"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card-glow p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg text-dark-300 font-semibold hover:shadow-neon-cyan transition-all">
              Post club announcement
            </button>
            <button className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-all">
              Schedule event or workshop
            </button>
            <button className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-all">
              Upload deck or resource
            </button>
            <button className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-all">
              Post new opportunity
            </button>
          </div>

          {/* Profile completeness */}
          <div className="mt-6 p-4 rounded-lg bg-dark-100 border border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                BOSSO profile completeness
              </span>
              <span className="text-sm text-primary font-bold">75%</span>
            </div>
            <div className="w-full h-2 bg-dark-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                style={{ width: '75%' }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Add your favorite sport, tools, and LinkedIn to complete your BOSSO profile.
            </p>
          </div>
        </div>
      </div>

      {/* Role-specific section */}
      {profile.role === 'board_member' && (
        <div className="card-glow p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            Board Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            High-level view of BOSSO engagement across consulting, research, and education.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-dark-100">
              <TrendingUp className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">94%</p>
              <p className="text-sm text-muted-foreground">Average event attendance</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-100">
              <CheckSquare className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">87%</p>
              <p className="text-sm text-muted-foreground">Project task completion</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-100">
              <Users className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">4.8</p>
              <p className="text-sm text-muted-foreground">Avg member feedback</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
