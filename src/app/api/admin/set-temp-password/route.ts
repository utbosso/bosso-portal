import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isPortalAdminUser } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPortalAdminUser(user)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { userId, tempPassword } = await request.json()

    if (!userId || !tempPassword) {
      return NextResponse.json({ error: 'User ID and temporary password are required' }, { status: 400 })
    }

    if (typeof tempPassword !== 'string' || tempPassword.length < 8) {
      return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 })
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot set a temporary password for your own account' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Set temporary password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
