import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient, isPortalAdminUser } from '@/lib/supabase/admin'
import {
  canManageCommunications,
  loadCurrentTermMembers,
  selectCurrentTermRecipients,
} from '@/lib/current-term-recipients'
import { sendEmail } from '@/lib/email/send'
import { bodyToParagraphs } from '@/lib/email/body-to-paragraphs'
import {
  accountApprovedEmail,
  announcementEmail,
  duesEmail,
  eventInviteEmail,
  tempPasswordEmail,
  type BuiltEmail,
} from '@/lib/email/templates'

const TIME_ZONE = 'America/Chicago'
const KINDS = ['event', 'announcement', 'approval', 'dues', 'password'] as const
type Kind = (typeof KINDS)[number]
type Mode = 'plan' | 'preview' | 'send'

const titleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function googleDate(date: Date) {
  return date.toISOString().replace(/-|:|\.\d+/g, '')
}

type Built = { email: BuiltEmail; recipients: { to?: string; bcc?: string[] }; label: string; count: number }

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const kind = body?.kind as Kind
    const mode = body?.mode as Mode
    if (!KINDS.includes(kind) || !['plan', 'preview', 'send'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid email request.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const origin = new URL(request.url).origin

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = isPortalAdminUser(user) || callerProfile?.role === 'admin'

    let built: Built

    if (kind === 'event' || kind === 'announcement') {
      const id = typeof body?.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'Missing item.' }, { status: 400 })

      const context = await loadCurrentTermMembers(admin)
      const currentMember = context.members.find((member) => member.id === user.id)

      if (kind === 'event') {
        const { data: event } = await admin.from('events').select('*').eq('id', id).maybeSingle()
        if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
        const isOwner = event.created_by === user.id && canManageCommunications(currentMember?.role)
        if (!isAdmin && !isOwner) return NextResponse.json({ error: 'You cannot email this event.' }, { status: 403 })

        const recipients = selectCurrentTermRecipients(context, {
          roleScope: event.audience_scope,
          roleScopeMode: event.audience_scope_mode,
          targetUserIds: event.target_user_ids,
        })
        const start = new Date(event.start_at)
        const end = new Date(event.end_at)
        const calendarTitle = /^bosso\b/i.test(event.title) ? event.title : `BOSSO ${event.title}`
        const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&dates=${googleDate(start)}/${googleDate(end)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`
        built = {
          email: eventInviteEmail({
            title: event.title,
            when: start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: TIME_ZONE }),
            location: event.location,
            notes: event.description,
            calendarUrl,
            portalUrl: `${origin}/calendar`,
          }),
          recipients: { bcc: recipients.map((recipient) => recipient.email) },
          label: `${recipients.length} current member${recipients.length === 1 ? '' : 's'} (${context.term.name})`,
          count: recipients.length,
        }
      } else {
        const { data: announcement } = await admin.from('announcements').select('*').eq('id', id).maybeSingle()
        if (!announcement) return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 })
        const isOwner = announcement.created_by === user.id && canManageCommunications(currentMember?.role)
        if (!isAdmin && !isOwner) return NextResponse.json({ error: 'You cannot email this announcement.' }, { status: 403 })

        const { data: author } = await admin.from('profiles').select('full_name').eq('id', announcement.created_by).maybeSingle()
        const recipients = selectCurrentTermRecipients(context, {
          roleScope: announcement.role_scope,
          roleScopeMode: announcement.role_scope_mode,
          targetUserIds: announcement.target_user_ids,
        })
        built = {
          email: announcementEmail({
            title: announcement.title,
            paragraphs: bodyToParagraphs(announcement.body),
            links: (announcement.reference_links || []).map((link: { label: string; url: string }) => [link.label, link.url] as [string, string]),
            postedBy: author?.full_name,
            announcementUrl: `${origin}/announcements/${announcement.id}`,
          }),
          recipients: { bcc: recipients.map((recipient) => recipient.email) },
          label: `${recipients.length} current member${recipients.length === 1 ? '' : 's'} (${context.term.name})`,
          count: recipients.length,
        }
      }
    } else {
      if (!isAdmin) return NextResponse.json({ error: 'Only the portal admin can send account emails.' }, { status: 403 })
      const userId = typeof body?.userId === 'string' ? body.userId : ''
      const { data: target } = await admin.from('profiles').select('full_name, email, role').eq('id', userId).maybeSingle()
      if (!target?.email) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })

      const roleLabel = titleCase(typeof body?.role === 'string' && body.role ? body.role : target.role)
      const firstName = String(target.full_name || 'there').split(' ')[0]

      let email: BuiltEmail
      if (kind === 'approval') {
        email = accountApprovedEmail({ name: target.full_name, email: target.email, role: roleLabel, loginUrl: `${origin}/login` })
      } else if (kind === 'dues') {
        email = duesEmail({
          name: firstName,
          role: roleLabel,
          semesterPrice: typeof body?.semesterPrice === 'string' ? body.semesterPrice : null,
          annualPrice: typeof body?.annualPrice === 'string' ? body.annualPrice : null,
          portalUrl: origin,
        })
      } else {
        const password = typeof body?.password === 'string' ? body.password : ''
        if (!password) return NextResponse.json({ error: 'A temporary password is required.' }, { status: 400 })
        email = tempPasswordEmail({ name: firstName, password, loginUrl: `${origin}/login` })
      }
      built = { email, recipients: { to: target.email }, label: `${target.full_name} (${target.email})`, count: 1 }
    }

    if (mode === 'plan') {
      return NextResponse.json({ subject: built.email.subject, label: built.label, count: built.count, previewTo: user.email })
    }

    if (built.count === 0) {
      return NextResponse.json({ error: 'No approved members in the current semester match this audience.' }, { status: 400 })
    }

    if (mode === 'preview') {
      if (!user.email) return NextResponse.json({ error: 'Your account has no email address for the preview.' }, { status: 400 })
      await sendEmail({ to: user.email, email: built.email, subjectPrefix: '[PREVIEW] ' })
      return NextResponse.json({ sent: 1, failed: [], previewTo: user.email })
    }

    const result = await sendEmail({ ...built.recipients, email: built.email })
    return NextResponse.json({ sent: result.sent, failed: result.failed })
  } catch (error) {
    console.error('Error sending portal email', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The email could not be sent.' }, { status: 500 })
  }
}
