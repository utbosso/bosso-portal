'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isMissingSemesterSchema } from '@/lib/semester'
import type { PortalAccessStatus } from '@/types/database.types'

const supabase = createClient()

export function usePortalAccess(userId: string | null | undefined) {
  const [access, setAccess] = useState<PortalAccessStatus | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [schemaReady, setSchemaReady] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccess(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: accessError } = await supabase.rpc('get_portal_access_status')

    if (accessError) {
      if (isMissingSemesterSchema(accessError)) {
        // The code can be reviewed against the existing database before the local
        // migration is approved. Existing access rules remain in place meanwhile.
        setSchemaReady(false)
        setAccess(null)
        setError(null)
      } else {
        setError(accessError.message)
      }
      setLoading(false)
      return
    }

    setSchemaReady(true)
    setAccess((data?.[0] as PortalAccessStatus | undefined) || null)
    setError(null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!userId || !schemaReady) return

    let channel: RealtimeChannel | null = supabase
      .channel(`portal-access:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_term_memberships',
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh()
      )
      .subscribe()

    const onFocus = () => void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) void supabase.removeChannel(channel)
      channel = null
    }
  }, [refresh, schemaReady, userId])

  return { access, loading, schemaReady, error, refresh }
}
