'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Moon, Sun, User, Mail, Briefcase, Calendar, Settings as SettingsIcon } from 'lucide-react'

export default function SettingsPage() {
  const { profile } = useAuth()

  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    }
  }, [])


  const applyTheme = (newTheme: 'light' | 'dark') => {
    if (newTheme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }


  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences and portal settings
        </p>
      </div>

      {/* Profile Information */}
      <div className="card-glow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile Information
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Full Name</label>
            <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
              {profile.full_name}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {profile.email}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Role</label>
            <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="capitalize">{profile.role.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Member Since</label>
            <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card-glow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Theme</label>
          <div className="flex gap-3">
            <button
              onClick={() => handleThemeChange('dark')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/20 bg-card text-muted-foreground hover:border-primary/40'
              }`}
            >
              <Moon className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs opacity-75 mt-1">Easy on the eyes</p>
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/20 bg-card text-muted-foreground hover:border-primary/40'
              }`}
            >
              <Sun className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Light Mode</p>
              <p className="text-xs opacity-75 mt-1">Bright and clear</p>
            </button>
          </div>
        </div>
      </div>


      {/* About */}
      <div className="card-glow p-6 space-y-2">
        <h2 className="text-xl font-semibold text-foreground">About</h2>
        <p className="text-sm text-muted-foreground">
          BOSSO Portal - Business of Sports Student Organization @ UT Austin
        </p>
        <p className="text-xs text-muted-foreground">
          Version 1.0.0
        </p>
      </div>
    </div>
  )
}
