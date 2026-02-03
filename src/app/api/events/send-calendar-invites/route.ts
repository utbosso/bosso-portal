import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createCalendarEvent } from '@/lib/google-calendar'
import { filterUsersByRoleScope, getRoleScopeLabel } from '@/lib/role-scope'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get event details from request
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    // Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const calendarSummary = /^bosso\b/i.test(event.title) ? event.title : `BOSSO ${event.title}`

    // Verify user is either admin or event creator
    const isAdmin = profile.role === 'admin'
    const isCreator = event.created_by === user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json({
        error: 'Forbidden: Only admins or event creators can send calendar invites'
      }, { status: 403 })
    }

    // Get users who should receive this event based on audience scope
    let usersQuery = supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('account_status', 'active')

    // If event has audience_scope, filter users
    if (event.audience_scope) {
      // Fetch all active users and filter by role scope rules
      const { data: allUsers, error: usersError } = await usersQuery

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }

      const eligibleUsers = filterUsersByRoleScope(
        allUsers || [],
        event.audience_scope,
        event.audience_scope_mode
      )

      // Send calendar invites to all eligible users
      const results = await Promise.allSettled(
        eligibleUsers.map(async (user) => {
          try {
            await createCalendarEvent({
              summary: calendarSummary,
              description: event.description || `Event for ${getRoleScopeLabel(event.audience_scope, event.audience_scope_mode)}`,
              location: event.location || '',
              startDateTime: event.start_at,
              endDateTime: event.end_at,
              attendeeEmail: user.email,
              meetLink: false, // Set to true if you want Google Meet links
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 }, // 1 day before
                  { method: 'email', minutes: 60 }, // 1 hour before
                  { method: 'popup', minutes: 30 }, // 30 minutes before (popup in calendar)
                ],
              },
            })
            return { success: true, email: user.email }
          } catch (error: any) {
            console.error(`Failed to send invite to ${user.email}:`, error.message)
            return { success: false, email: user.email, error: error.message }
          }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
      const failed = results.filter(r => r.status === 'rejected' || !(r.value as any).success).length

      return NextResponse.json({
        message: 'Calendar invites sent',
        sent: successful,
        failed: failed,
        total: eligibleUsers.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Failed' })
      })
    } else {
      // Event is for all members
      const { data: allUsers, error: usersError } = await usersQuery

      if (usersError) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }

      const results = await Promise.allSettled(
        (allUsers || []).map(async (user) => {
          try {
            await createCalendarEvent({
              summary: calendarSummary,
              description: event.description || 'BOSSO event for all members',
              location: event.location || '',
              startDateTime: event.start_at,
              endDateTime: event.end_at,
              attendeeEmail: user.email,
              meetLink: false,
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 },
                  { method: 'email', minutes: 60 },
                  { method: 'popup', minutes: 30 },
                ],
              },
            })
            return { success: true, email: user.email }
          } catch (error: any) {
            console.error(`Failed to send invite to ${user.email}:`, error.message)
            return { success: false, email: user.email, error: error.message }
          }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
      const failed = results.filter(r => r.status === 'rejected' || !(r.value as any).success).length

      return NextResponse.json({
        message: 'Calendar invites sent to all members',
        sent: successful,
        failed: failed,
        total: allUsers?.length || 0,
      })
    }
  } catch (error: any) {
    console.error('Error sending calendar invites:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
