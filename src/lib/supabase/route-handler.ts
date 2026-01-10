import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export function createClient() {
  return createRouteHandlerClient<Database>({ cookies })
}
