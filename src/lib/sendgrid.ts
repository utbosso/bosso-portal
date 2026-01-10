import sgMail from '@sendgrid/mail'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@bosso.org'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY is not set')
    throw new Error('Email service is not configured')
  }

  try {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })

    console.log(`Email sent successfully to ${to}`)
    return { success: true }
  } catch (error: any) {
    console.error('SendGrid error:', error.response?.body || error.message)
    throw new Error('Failed to send email')
  }
}

// Email templates for custom notifications
// Note: Email verification and password resets are handled by Supabase Auth

export function getAccountApprovedEmail(userName: string, loginLink: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #BF5700 0%, #833C00 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 30px; background: #BF5700; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to BOSSO!</h1>
        </div>
        <div class="content">
          <h2>Your Account Has Been Approved!</h2>
          <p>Hi ${userName},</p>
          <p>Great news! Your BOSSO Member Portal account has been approved by an administrator.</p>
          <p>You can now access all features of the portal including:</p>
          <ul>
            <li>Events and announcements</li>
            <li>Networking directory</li>
            <li>Learning resources</li>
            <li>Job opportunities</li>
            <li>And much more!</li>
          </ul>
          <a href="${loginLink}" class="button">Login to Portal</a>
          <p>We're excited to have you as part of the BOSSO community!</p>
        </div>
        <div class="footer">
          <p>Business of Sports Student Organization @ UT Austin</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return {
    subject: 'Your BOSSO Portal Account is Approved!',
    html,
  }
}
