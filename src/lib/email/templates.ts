// "Game Day Ticket" email design. Every builder returns { subject, html, text }.
// HTML is table-based with inline styles so Gmail and Outlook render it;
// the perforation notches use border-radius, which Outlook desktop ignores,
// so they are hidden there via MSO conditional comments.

const ORANGE = '#BF5700'
const DEEP = '#833C00'
const BG = '#14110f'
const PAPER = '#fffaf3'
const HEAD = "'Arial Black',Impact,Arial,sans-serif"
const MONO = "'Courier New',monospace"
const BODY = 'Arial,Helvetica,sans-serif'

export const PORTAL_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bosso-portal.vercel.app'

type Cta = { label: string; url: string; primary?: boolean }

interface TicketModel {
  ticketLabel: string
  eyebrow: string
  title: string
  kicker: string
  greeting?: string
  intro: string[]
  credential?: string
  details?: [string, string][]
  stepsTitle?: string
  steps?: string[]
  links?: [string, string][]
  warning?: string
  ctas: Cta[]
  note?: string
  signoff: string
}

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

const esc = (value: string) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? esc(url) : '#')

function paragraphs(items: string[]) {
  return items
    .map((p) => `<p style="margin:0 0 14px;color:#292524;font:15px/1.6 ${BODY}">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function renderHtml(m: TicketModel) {
  const notch = (left: boolean) =>
    `<!--[if !mso]><!--><td width="18" style="background:${BG};border-radius:${left ? '0 18px 18px 0' : '18px 0 0 18px'};font-size:0;line-height:0">&nbsp;</td><!--<![endif]-->`
  const perforation = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="height:36px"><tr>${notch(true)}<td valign="middle" style="font-size:0;line-height:0"><div style="border-top:2px dashed #d9c9b4;height:0;line-height:0;font-size:0">&nbsp;</div></td>${notch(false)}</tr></table>`

  const widths = [2, 5, 2, 3, 6, 2, 4, 2, 2, 6, 3, 2, 5, 2, 4, 6, 2, 3, 2, 5, 2, 6, 3, 2, 4, 2, 5, 2, 3, 6, 2, 4, 2]
  const barcode = `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${widths
    .map((w, i) => `<td width="${w}" height="34" style="background:${i % 2 === 0 ? BG : PAPER};font-size:0;line-height:0">&nbsp;</td>`)
    .join('')}</tr></table>`

  const details = (m.details || [])
    .map(
      ([label, value]) =>
        `<tr><td width="90" valign="top" style="padding:9px 0;border-bottom:1px solid #eadfce;color:#a16207;font:700 11px ${MONO};letter-spacing:2px;text-transform:uppercase">${esc(label)}</td><td style="padding:9px 0;border-bottom:1px solid #eadfce;color:#1c1917;font:700 15px ${MONO}">${esc(value)}</td></tr>`
    )
    .join('')

  const steps = (m.steps || [])
    .map(
      (step, i) =>
        `<tr><td width="40" valign="top" style="padding:8px 0;color:${ORANGE};font:400 22px ${HEAD}">${i + 1}</td><td style="padding:10px 0;border-bottom:1px solid #eadfce;color:#292524;font:15px/1.5 ${BODY}">${esc(step)}</td></tr>`
    )
    .join('')

  const links = (m.links || []).length
    ? `<div style="color:#a16207;font:700 11px ${MONO};letter-spacing:3px;text-transform:uppercase;margin:4px 0 6px">Links</div>${(m.links || [])
        .map(
          ([label, url]) =>
            `<p style="margin:0 0 6px;font:700 14px ${MONO}"><a href="${safeUrl(url)}" style="color:${DEEP};text-decoration:underline">${esc(label)}</a></p>`
        )
        .join('')}`
    : ''

  const credential = m.credential
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px"><tr><td align="center" style="background:#ffffff;border:2px dashed ${BG};padding:18px;color:${BG};font:700 26px ${MONO};letter-spacing:4px">${esc(m.credential)}</td></tr></table>`
    : ''

  const warning = m.warning
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="background:#fff1e0;border-left:4px solid ${ORANGE};padding:12px 16px;color:#7c2d12;font:600 14px/1.5 ${BODY}">${esc(m.warning)}</td></tr></table>`
    : ''

  const ctas = m.ctas
    .map((cta) =>
      cta.primary
        ? `<a href="${safeUrl(cta.url)}" style="display:block;background:${BG};color:#ffb066;font:400 16px ${HEAD};letter-spacing:2px;text-transform:uppercase;text-align:center;text-decoration:none;padding:16px;margin-bottom:10px">${esc(cta.label)} &rarr;</a>`
        : `<a href="${safeUrl(cta.url)}" style="display:block;color:${DEEP};font:700 13px ${MONO};text-align:center;padding:8px;text-decoration:underline">${esc(cta.label)}</a>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(m.title)}</title></head>
<body style="margin:0;padding:0;background:${BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:32px 12px">
 <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${PAPER}">
  <tr><td style="background:${ORANGE};padding:12px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="color:#ffffff;font:700 12px ${MONO};letter-spacing:3px;text-transform:uppercase">&#9733; ${esc(m.ticketLabel)}</td>
    <td align="right" style="color:#ffe1c2;font:700 12px ${MONO};letter-spacing:3px;text-transform:uppercase">BOSSO</td></tr></table></td></tr>
  <tr><td style="padding:28px 28px 8px">
    <div style="color:#a16207;font:700 11px ${MONO};letter-spacing:3px;text-transform:uppercase">${esc(m.eyebrow)}</div>
    <h1 style="margin:8px 0 10px;color:${BG};font:400 34px/1.05 ${HEAD};text-transform:uppercase">${esc(m.title)}</h1>
    <p style="margin:0 0 16px;color:${DEEP};font:italic 700 15px/1.5 Georgia,serif">${esc(m.kicker)}</p>
    ${m.greeting ? `<p style="margin:0 0 10px;color:#292524;font:16px ${BODY}">${esc(m.greeting)}</p>` : ''}
    ${paragraphs(m.intro)}
    ${credential}
  </td></tr>
  <tr><td>${perforation}</td></tr>
  <tr><td style="padding:8px 28px 8px">
    ${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">${details}</table>` : ''}
    ${steps ? `<div style="color:#a16207;font:700 11px ${MONO};letter-spacing:3px;text-transform:uppercase;margin:4px 0 4px">${esc(m.stepsTitle || 'Steps')}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">${steps}</table>` : ''}
    ${links}
    ${warning}
    <div style="margin-top:14px">${ctas}</div>
    ${m.note ? `<p style="margin:14px 0 0;color:#78716c;font:13px/1.6 ${BODY};text-align:center">${esc(m.note)}</p>` : ''}
  </td></tr>
  <tr><td style="padding:22px 28px 26px;text-align:center">${barcode}<div style="margin-top:10px;color:#a8a29e;font:11px ${MONO};letter-spacing:2px">BOSSO &middot; UT AUSTIN</div></td></tr>
 </table>
</td></tr></table>
</body></html>`
}

function wrap(text: string, width = 64) {
  const lines: string[] = []
  let current = ''
  text.split(' ').forEach((word) => {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current)
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  })
  if (current) lines.push(current)
  return lines
}

function renderText(m: TicketModel) {
  const rule = '----------------------------------------'
  const out: string[] = [`BOSSO - ${m.eyebrow.toUpperCase()}`, rule, '', m.title.toUpperCase(), '']
  if (m.greeting) out.push(m.greeting, '')
  m.intro.forEach((p) => out.push(...wrap(p), ''))
  if (m.credential) out.push(`  ${m.credential}`, '')
  if (m.details) {
    m.details.forEach(([label, value]) => out.push(`  ${label.padEnd(9)}${value}`))
    out.push('')
  }
  if (m.steps) {
    out.push(`${m.stepsTitle || 'Steps'}:`)
    m.steps.forEach((step, i) => out.push(`  ${i + 1}. ${step}`))
    out.push('')
  }
  if (m.links?.length) {
    out.push('Links:')
    m.links.forEach(([label, url]) => out.push(`  ${label}: ${url}`))
    out.push('')
  }
  if (m.warning) out.push(`Heads up: ${m.warning}`, '')
  out.push(rule)
  m.ctas.forEach((cta) => out.push(cta.label, cta.url, ''))
  if (m.note) out.push(...wrap(m.note), '')
  out.push(rule, m.signoff, '', 'Business of Sports Student Organization @ UT Austin')
  return out.join('\n')
}

function build(subject: string, model: TicketModel): BuiltEmail {
  return { subject, html: renderHtml(model), text: renderText(model) }
}

export function eventInviteEmail(input: {
  title: string
  when: string
  location?: string | null
  notes?: string | null
  calendarUrl: string
  portalUrl?: string
}): BuiltEmail {
  const details: [string, string][] = [
    ['When', input.when],
    ['Where', input.location || 'TBA'],
  ]
  if (input.notes) details.push(['Notes', input.notes])
  return build(`BOSSO Event: ${input.title}`, {
    ticketLabel: 'New event',
    eyebrow: 'Event invite',
    title: input.title,
    kicker: "We can't wait to see you!",
    intro: ['Come join us at our BOSSO event!'],
    details,
    ctas: [
      { label: 'Add to your calendar', url: input.calendarUrl, primary: true },
      { label: 'View on portal', url: input.portalUrl || `${PORTAL_URL}/calendar` },
    ],
    signoff: 'See you there,\nThe BOSSO Board',
  })
}

export function announcementEmail(input: {
  title: string
  paragraphs: string[]
  links?: [string, string][]
  postedBy?: string
  announcementUrl: string
}): BuiltEmail {
  return build(`BOSSO Announcement: ${input.title}`, {
    ticketLabel: 'New announcement',
    eyebrow: input.postedBy ? `Announcement from ${input.postedBy}` : 'Announcement',
    title: input.title,
    kicker: 'Latest from the board.',
    intro: input.paragraphs,
    links: input.links,
    ctas: [{ label: 'Read on the portal', url: input.announcementUrl, primary: true }],
    signoff: "Hook 'em,\nThe BOSSO Board",
  })
}

export function accountApprovedEmail(input: { name: string; email: string; role: string; loginUrl?: string }): BuiltEmail {
  return build('Welcome to BOSSO Portal - Account Approved!', {
    ticketLabel: 'Approved',
    eyebrow: 'Account approved',
    title: "You're in.",
    kicker: 'Welcome to the team!',
    greeting: `Hi ${input.name},`,
    intro: ['Great news! Your BOSSO Portal account has been approved and is now active.'],
    details: [
      ['Name', input.name],
      ['Email', input.email],
      ['Role', input.role],
    ],
    ctas: [{ label: 'Log in to the portal', url: input.loginUrl || `${PORTAL_URL}/login`, primary: true }],
    note: 'Next up: finish your profile in Settings so the board has your info.',
    signoff: 'Welcome to the team!\nThe BOSSO Board',
  })
}

export function duesEmail(input: {
  name: string
  role: string
  semesterPrice?: string | null
  annualPrice?: string | null
  portalUrl?: string
}): BuiltEmail {
  const details: [string, string][] = [['Position', input.role]]
  if (input.semesterPrice) details.push(['Semester', input.semesterPrice])
  if (input.annualPrice) details.push(['Full year', input.annualPrice])
  return build('BOSSO Portal - Pay Your Dues', {
    ticketLabel: 'Pay your dues',
    eyebrow: 'Dues',
    title: 'One last step to unlock the portal',
    kicker: "Pay your dues and you're in!",
    greeting: `Hi ${input.name},`,
    intro: ['Thanks for signing up with BOSSO! To finish activating your portal access, pay your dues directly in the portal.'],
    stepsTitle: 'How it works',
    steps: [
      'Log in to the portal',
      'You will land on the "Pay your dues" screen automatically',
      'Choose Semester or Full Year and pay by card or bank transfer',
    ],
    details,
    ctas: [{ label: 'Pay your dues', url: input.portalUrl || PORTAL_URL, primary: true }],
    note: 'Access opens automatically the moment your payment clears. Bank transfers can take a few business days.',
    signoff: 'Best,\nThe BOSSO Board',
  })
}

export function tempPasswordEmail(input: { name: string; password: string; loginUrl?: string }): BuiltEmail {
  return build('BOSSO Portal - Temporary Password', {
    ticketLabel: 'Get back in',
    eyebrow: 'Password reset',
    title: 'Your temporary password',
    kicker: 'Reset your password to get back in.',
    greeting: `Hi ${input.name},`,
    intro: ['We reset your BOSSO Portal password.'],
    credential: input.password,
    stepsTitle: 'Do this next',
    steps: [
      'Go to the portal login page',
      'Sign in with your email and the temporary password',
      'Open Settings, then Security',
      'Set your own new password right away',
    ],
    warning: 'Treat this like a secret, and change it as soon as you sign in.',
    ctas: [{ label: 'Sign in', url: input.loginUrl || `${PORTAL_URL}/login`, primary: true }],
    note: 'Trouble logging in? Just reply to this email and we will help.',
    signoff: 'Best,\nThe BOSSO Board',
  })
}
