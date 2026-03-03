'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Moon, Sun, User, Mail, Briefcase, Settings as SettingsIcon, Phone, Edit2, Shield } from 'lucide-react'
import ProfileEditForm from '@/components/ProfileEditForm'
import { Profile } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function SettingsPage() {
  const { profile: authProfile } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(authProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // Update local profile when authProfile changes
  useEffect(() => {
    setProfile(authProfile)
  }, [authProfile])

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

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile)
    setIsEditing(false)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setPasswordSuccess('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profile Information
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <ProfileEditForm
            profile={profile}
            onSuccess={handleProfileUpdate}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">First Name</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                {profile.first_name || 'Not set'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Last Name</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                {profile.last_name || 'Not set'}
              </div>
            </div>
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
              <label className="text-sm font-medium text-muted-foreground">UT EID</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                {profile.ut_eid || 'Not set'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">UT Email</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {profile.ut_email || 'Not set'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {profile.phone_number || 'Not set'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <div className="px-4 py-3 bg-muted rounded-lg text-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="capitalize">{profile.role.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Work Experience Display */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Work Experience
              </label>
              {profile.work_experiences && profile.work_experiences.length > 0 ? (
                <div className="space-y-3">
                  {profile.work_experiences.map((exp) => (
                    <div key={exp.id} className="px-4 py-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{exp.title}</p>
                          <p className="text-sm text-muted-foreground">{exp.company}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {exp.start_date && new Date(exp.start_date + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          {' - '}
                          {exp.is_current ? 'Present' : exp.end_date ? new Date(exp.end_date + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 bg-muted rounded-lg text-muted-foreground italic">
                  No work experience added yet
                </div>
              )}
            </div>
          </div>
        )}
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

      {/* Security */}
      <div className="card-glow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Security
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Logged in with a temporary password? Set a new password here.
          </p>

          {passwordError && (
            <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">
              {passwordSuccess}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 bg-dark-100 border border-primary/20 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all input-neon"
              placeholder="Re-enter your new password"
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
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
