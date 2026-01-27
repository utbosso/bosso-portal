import { createClient } from '@/lib/supabase/route-handler'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient()

    // Exchange code for session
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('Session exchange error:', sessionError)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
    }

    const user = sessionData.user
    if (!user || !user.email) {
      return NextResponse.redirect(`${requestUrl.origin}/login?error=no_email`)
    }

    // Validate UT Austin email
    const email = user.email.toLowerCase()
    if (!email.endsWith('@utexas.edu') && !email.endsWith('@eid.utexas.edu') && !email.endsWith('@my.utexas.edu') && !email.endsWith('@txbosso.com')) {
      // Not a UT Austin email - sign out and redirect with error
      await supabase.auth.signOut()
      return NextResponse.redirect(`${requestUrl.origin}/signup?error=invalid_domain`)
    }

    // Due to RLS issues on the server-side, we can't reliably check the profile here
    // Instead, redirect to the client-side complete-signup page which will handle:
    // 1. Checking if user has a profile
    // 2. Checking approval status
    // 3. Redirecting appropriately
    console.log('[auth/callback] User authenticated:', user.email)
    console.log('[auth/callback] User ID:', user.id)
    console.log('[auth/callback] Redirecting to complete-signup for profile check')

    return NextResponse.redirect(`${requestUrl.origin}/auth/complete-signup`)
  }

  // No code provided
  return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`)
}
