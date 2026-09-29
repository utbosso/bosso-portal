import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { isPortalAdminUser } from '@/lib/supabase/admin'
import { parseNewsletterIssueHtml } from '@/lib/newsletter-import'

async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isPortalAdminUser(user)) return null
  return user
}

const ALLOWED_HOST = 'txbosso.com'

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return NextResponse.json({ error: 'Enter the newsletter issue URL.' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'That is not a valid URL.' }, { status: 400 })
  }
  if (parsed.hostname !== ALLOWED_HOST && !parsed.hostname.endsWith(`.${ALLOWED_HOST}`)) {
    return NextResponse.json({ error: `Only ${ALLOWED_HOST} URLs can be imported.` }, { status: 400 })
  }

  let html: string
  try {
    const response = await fetch(parsed.toString(), { cache: 'no-store' })
    if (!response.ok) return NextResponse.json({ error: `Could not fetch that page (${response.status}).` }, { status: 400 })
    html = await response.text()
  } catch {
    return NextResponse.json({ error: 'Could not reach that URL.' }, { status: 400 })
  }

  const issue = parseNewsletterIssueHtml(html)
  if (!issue.title || issue.stories.length === 0) {
    return NextResponse.json({ error: 'Could not find a newsletter issue on that page.' }, { status: 400 })
  }

  return NextResponse.json(issue)
}
