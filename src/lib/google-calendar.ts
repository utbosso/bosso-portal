import { google } from 'googleapis'

// Initialize Google Calendar API
const calendar = google.calendar('v3')

// Service account authentication
function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Calendar credentials are not configured')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  return auth
}

export interface CalendarEventOptions {
  summary: string // Event title
  description?: string
  location?: string
  startDateTime: string // ISO 8601 format
  endDateTime: string // ISO 8601 format
  attendeeEmail: string // Single attendee email
  meetLink?: boolean // Whether to create a Google Meet link
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
}

export async function createCalendarEvent(options: CalendarEventOptions) {
  try {
    const auth = await getAuth()

    const event = {
      summary: options.summary,
      description: options.description || '',
      location: options.location || '',
      start: {
        dateTime: options.startDateTime,
        timeZone: 'America/Chicago', // Austin, TX timezone
      },
      end: {
        dateTime: options.endDateTime,
        timeZone: 'America/Chicago',
      },
      attendees: [
        {
          email: options.attendeeEmail,
          responseStatus: 'needsAction',
        }
      ],
      // Add Google Meet link if requested
      conferenceData: options.meetLink ? {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      } : undefined,
      // Set up reminders - Google will send these automatically
      reminders: options.reminders || {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'email', minutes: 60 }, // 1 hour before
        ],
      },
    }

    const response = await calendar.events.insert({
      auth: auth as any,
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      conferenceDataVersion: options.meetLink ? 1 : undefined,
      sendUpdates: 'all', // Google automatically sends invitation email
      requestBody: event,
    })

    console.log(`Calendar event sent to ${options.attendeeEmail}: ${response.data.id}`)

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink,
    }
  } catch (error: any) {
    console.error('Google Calendar API error:', error.message)
    throw new Error(`Failed to create calendar event: ${error.message}`)
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventOptions>
) {
  try {
    const auth = await getAuth()

    const event: any = {}

    if (updates.summary) event.summary = updates.summary
    if (updates.description) event.description = updates.description
    if (updates.location) event.location = updates.location
    if (updates.startDateTime) {
      event.start = {
        dateTime: updates.startDateTime,
        timeZone: 'America/Chicago',
      }
    }
    if (updates.endDateTime) {
      event.end = {
        dateTime: updates.endDateTime,
        timeZone: 'America/Chicago',
      }
    }

    const response = await calendar.events.patch({
      auth: auth as any,
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Google sends update emails automatically
      requestBody: event,
    })

    console.log(`Calendar event updated: ${eventId}`)
    return { success: true, eventId: response.data.id }
  } catch (error: any) {
    console.error('Google Calendar API error:', error.message)
    throw new Error(`Failed to update calendar event: ${error.message}`)
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    const auth = await getAuth()

    await calendar.events.delete({
      auth: auth as any,
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Google sends cancellation email automatically
    })

    console.log(`Calendar event deleted: ${eventId}`)
    return { success: true }
  } catch (error: any) {
    console.error('Google Calendar API error:', error.message)
    throw new Error(`Failed to delete calendar event: ${error.message}`)
  }
}
