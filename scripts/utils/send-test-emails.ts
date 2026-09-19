// Sends one sample of each BOSSO email to the addresses you pass in. Nothing goes to members.
//
//   npx tsx --env-file=.env.local scripts/utils/send-test-emails.ts you@example.com other@example.com
import { sendEmail } from '../../src/lib/email/send'
import {
  accountApprovedEmail,
  announcementEmail,
  duesEmail,
  eventInviteEmail,
  tempPasswordEmail,
} from '../../src/lib/email/templates'

const recipients = process.argv.slice(2).filter((arg) => arg.includes('@'))
if (recipients.length === 0) {
  console.error('Pass at least one recipient address.')
  process.exit(1)
}

const samples = [
  eventInviteEmail({
    title: 'Analyst Welcome Social',
    when: 'Thursday, September 17, 2026 at 7:00 PM',
    location: 'Union on 24th',
    notes: 'Movie Room on 17th Floor',
    calendarUrl:
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=BOSSO%20Analyst%20Welcome%20Social&dates=20260918T000000Z/20260918T040000Z&details=Movie%20Room%20on%2017th%20Floor&location=Union%20on%2024th',
  }),
  announcementEmail({
    title: 'Fall Kickoff: What You Need to Know',
    paragraphs: [
      'Welcome back, BOSSO! Here is everything you need to get plugged in this semester.',
      'General meetings are every other Wednesday. Bring a friend, bring your questions, and bring your energy.',
    ],
    links: [['Semester calendar', 'https://bosso-portal.vercel.app/calendar']],
    postedBy: 'Riddhima Yadav',
    announcementUrl: 'https://bosso-portal.vercel.app/announcements',
  }),
  accountApprovedEmail({ name: 'Jordan Smith', email: 'jordan@utexas.edu', role: 'Analyst' }),
  duesEmail({ name: 'Jordan', role: 'Analyst', semesterPrice: '$XX (sample)', annualPrice: '$XX (sample)' }),
  tempPasswordEmail({ name: 'Jordan', password: 'Xk7-Qm2-Pa9' }),
]

async function main() {
  for (const recipient of recipients) {
    for (const email of samples) {
      await sendEmail({ to: recipient, email, subjectPrefix: '[TEST] ' })
      console.log(`sent "${email.subject}" -> ${recipient}`)
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
  }
}

main().catch((error) => {
  console.error('Send failed:', error.message)
  process.exit(1)
})
