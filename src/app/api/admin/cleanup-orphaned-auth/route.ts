import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isPortalAdminUser } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Create admin client with service role key for auth admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPortalAdminUser(user)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // List all auth users to find the one with this email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json({ error: 'Failed to list users: ' + listError.message }, { status: 500 })
    }

    // Find user with matching email
    const authUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!authUser) {
      return NextResponse.json({ error: 'User not found in auth' }, { status: 404 })
    }

    // Check if profile exists for this user
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileData) {
      return NextResponse.json({
        error: 'User has a profile. Use the normal delete function instead.'
      }, { status: 400 })
    }

    // Delete the orphaned auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return NextResponse.json({ error: 'Failed to delete auth user: ' + authError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Deleted orphaned auth user for ${email}`
    })
  } catch (error) {
    console.error('Cleanup orphaned auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
