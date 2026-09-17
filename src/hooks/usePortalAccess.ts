'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isMissingSemesterSchema } from '@/lib/semester'
import type { PortalAccessStatus } from '@/types/database.types'

const supabase = createClient()

// authLoading must come from the caller's own useAuth() - userId alone is
// undefined both while auth is still resolving and once it's confirmed
// there's no session, so this hook cannot tell those two apart on its own.
// Treating "no id yet" as "confirmed logged out" was exactly the bug: it
// flipped loading to false, and access to null/no term_id, before the real
// session was known, so any consumer gating a term-scoped fetch on this
// hook's loading flag would fire early and fetch unfiltered data for an
// instant - showing every semester's content until the real term arrived
// a moment later and the correct, filtered re-fetch replaced it.
export function usePortalAccess(userId: string | null | undefined, authLoading: boolean) {
  const [access, setAccess] = useState<PortalAccessStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [schemaReady, setSchemaReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Tracks whether this userId has completed a load yet. refresh() also
  // fires from a window-focus listener, a visibilitychange listener, and any
  // realtime change to the member's own row (further below) - all far more
  // frequent than an actual access change, e.g. every time the browser tab
  // regains focus. Unconditionally flipping loading true on every one of
  // those blanked out (and every consumer gating on this hook's loading
  // re-rendered/re-fetched) for an instant on each refresh, which is what
  // made the app feel like data was constantly flashing away and reloading.
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
  }, [userId])

  const refresh = useCallback(async () => {
    if (authLoading) return

    if (!userId) {
      setAccess(null)
      setLoading(false)
      return
    }

    if (!hasLoadedRef.current) setLoading(true)
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
      hasLoadedRef.current = true
      setLoading(false)
      return
    }

    setSchemaReady(true)
    setAccess((data?.[0] as PortalAccessStatus | undefined) || null)
    setError(null)
    hasLoadedRef.current = true
    setLoading(false)
  }, [userId, authLoading])

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
