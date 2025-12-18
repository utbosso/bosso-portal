'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types/database.types'
import { useRouter } from 'next/navigation'

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchProfile = async (userId: string) => {
    try {
      console.log('[auth] fetching profile for', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  useEffect(() => {
    let isMounted = true

    const getInitialSession = async () => {
      setLoading(true)
      try {
        console.log('[auth] getInitialSession start')
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Error fetching session:', error)
          if (!isMounted) return
          setUser(null)
          setProfile(null)
          return
        }

        if (!isMounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        if (isMounted) {
          console.log('[auth] getInitialSession done, setLoading(false)')
          setLoading(false)
        }
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return

      console.log('[auth] onAuthStateChange fired', { hasSession: !!session })
      setLoading(true)

      ;(async () => {
        try {
          setUser(session?.user ?? null)

          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            setProfile(null)
          }
        } catch (error) {
          console.error('Error in onAuthStateChange handler:', error)
        } finally {
          if (isMounted) {
            console.log('[auth] onAuthStateChange done, setLoading(false)')
            setLoading(false)
          }
        }
      })()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[auth] signIn start', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      // onAuthStateChange will update user and profile
      return { data, error: null }
    } catch (error: any) {
      console.error('Error signing in:', error)
      return { data: null, error }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'general_member'
  ) => {
    try {
      console.log('[auth] signUp start', email)
      setLoading(true)

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No user returned from signUp')

      const userId = authData.user.id

      const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName,
          role,
        })
        .select()
        .single()

      if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`)

      setProfile(profileResult)
      setUser(authData.user)

      return { data: authData, error: null }
    } catch (error: any) {
      console.error('Signup error:', error)
      return { data: null, error }
    } finally {
      console.log('[auth] signUp done, setLoading(false)')
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      console.log('[auth] signOut')
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setProfile(null)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in', data: null }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      return { data, error: null }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      return { data: null, error }
    }
  }

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!profile) return false
    return profile.role === requiredRole
  }

  const hasMinimumRole = (minimumRole: UserRole): boolean => {
    if (!profile) return false

    const roleHierarchy: Record<UserRole, number> = {
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
    }

    return roleHierarchy[profile.role] >= roleHierarchy[minimumRole]
  }

  const isBoardMember = (): boolean => hasRole('board_member')
  const isProjectManager = (): boolean => hasRole('project_manager') || isBoardMember()
  const isAnalyst = (): boolean => hasRole('analyst') || isProjectManager()

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    hasRole,
    hasMinimumRole,
    isBoardMember,
    isProjectManager,
    isAnalyst,
    isAuthenticated: !!user,
  }
}
