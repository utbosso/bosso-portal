import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export const PORTAL_ADMIN_EMAIL = 'internal@txbosso.com'

export function isPortalAdminUser(user: Pick<User, 'email'> | null | undefined) {
  return user?.email?.trim().toLowerCase() === PORTAL_ADMIN_EMAIL
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured')
  }

  // Service-only workflows cross the locally staged migration boundary, so this
  // client intentionally avoids the pre-migration browser schema generic.
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
