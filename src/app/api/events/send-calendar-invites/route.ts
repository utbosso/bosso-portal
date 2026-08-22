import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import { createCalendarEvent } from '@/lib/google-calendar'
import { getRoleScopeLabel } from '@/lib/role-scope'
import { loadCurrentTermMembers, selectCurrentTermRecipients } from '@/lib/current-term-recipients'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const admin = createAdminClient()
    const currentContext = await loadCurrentTermMembers(admin)
    const isAdmin = isPortalAdminUser(user)
    const isCreator = event.created_by === user.id
    const isCurrentMember = currentContext.members.some((member) => member.id === user.id)

    if (!isAdmin && (!isCreator || !isCurrentMember)) {
      return NextResponse.json({
        error: 'Forbidden: Only the current-semester event creator or portal admin can send calendar invites'
      }, { status: 403 })
    }

    if (event.term_id && event.term_id !== currentContext.term.id) {
      return NextResponse.json({ error: 'Archived-semester events cannot email the current member list.' }, { status: 409 })
    }

    const eligibleUsers = selectCurrentTermRecipients(currentContext, {
      roleScope: event.audience_scope,
      roleScopeMode: event.audience_scope_mode,
      targetUserIds: event.target_user_ids,
    })

    if (eligibleUsers.length === 0) {
      return NextResponse.json({ error: 'No approved current-semester members match this audience.' }, { status: 409 })
    }

    const audienceLabel = event.target_user_ids?.length
      ? `${event.target_user_ids.length} selected member(s)`
      : getRoleScopeLabel(event.audience_scope, event.audience_scope_mode)

    const results = await Promise.allSettled(
      eligibleUsers.map(async (user) => {
        try {
          await createCalendarEvent({
            summary: calendarSummary,
            description: event.description || `Event for ${audienceLabel}`,
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
      term: currentContext.term.name,
      sent: successful,
      failed,
      total: eligibleUsers.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Failed' }),
    })
  } catch (error: any) {
    console.error('Error sending calendar invites:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
