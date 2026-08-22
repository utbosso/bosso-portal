import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPortalAdminUser } from '@/lib/supabase/admin'

/**
 * Auth users and profiles are permanent records. Semester access is disabled by
 * the member_term_memberships row instead of deleting the account.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPortalAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(
    {
      error: 'Member deletion is disabled. Decline or deactivate the current semester membership so account history remains intact.',
    },
    { status: 409 }
  )
}
