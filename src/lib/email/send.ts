import nodemailer from 'nodemailer'
import type { BuiltEmail } from './templates'

// Sends through the org's Google Workspace mailbox using an app password
// (Google Account -> Security -> 2-Step Verification -> App passwords).
function createTransport() {
  const user = process.env.GMAIL_SMTP_USER
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD
  if (!user || !pass) {
    throw new Error('Email sending is not configured (GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD).')
  }
  return { user, transport: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) }
}

const BCC_CHUNK_SIZE = 50

// One message per recipient chunk, everyone else in BCC so members never see
// each other. Returns which addresses could not be delivered to Gmail.
export async function sendEmail(options: { to?: string | string[]; bcc?: string[]; email: BuiltEmail; subjectPrefix?: string }) {
  const { user, transport } = createTransport()
  const fromName = process.env.EMAIL_FROM_NAME || 'BOSSO'
  const base = {
    from: `"${fromName}" <${user}>`,
    subject: `${options.subjectPrefix || ''}${options.email.subject}`,
    html: options.email.html,
    text: options.email.text,
  }

  if (!options.bcc?.length) {
    await transport.sendMail({ ...base, to: options.to })
    return { sent: Array.isArray(options.to) ? options.to.length : 1, failed: [] as string[] }
  }

  let sent = 0
  const failed: string[] = []
  for (let i = 0; i < options.bcc.length; i += BCC_CHUNK_SIZE) {
    const chunk = options.bcc.slice(i, i + BCC_CHUNK_SIZE)
    try {
      await transport.sendMail({ ...base, to: user, bcc: chunk })
      sent += chunk.length
    } catch (error) {
      console.error('Email chunk failed', error)
      failed.push(...chunk)
    }
  }
  return { sent, failed }
}
