import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'
import { createAdminClient } from '@/lib/supabase/admin'

export const DEMOGRAPHIC_SCHOOLS = [
  'McCombs School of Business',
  'College of Liberal Arts',
  'College of Education',
  'College of Natural Sciences',
  'Undecided',
  'Moody College of Communication',
  'Cockrell School of Engineering',
  'Other Schools',
] as const

const CLASS_STANDINGS = ['freshman', 'sophomore', 'junior', 'senior'] as const

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to submit this.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const schools = Array.isArray(body?.schools) ? body.schools.filter((s: unknown) => typeof s === 'string') : []
  const classStanding = body?.classStanding
  const major = typeof body?.major === 'string' ? body.major.trim().slice(0, 200) : ''
  const hasMinor = body?.hasMinor
  const minor = typeof body?.minor === 'string' ? body.minor.trim().slice(0, 200) : ''

  if (schools.length === 0 || schools.some((s: string) => !DEMOGRAPHIC_SCHOOLS.includes(s as any))) {
    return NextResponse.json({ error: 'Select at least one school/college.' }, { status: 400 })
  }
  if (!CLASS_STANDINGS.includes(classStanding)) {
    return NextResponse.json({ error: 'Select your class standing.' }, { status: 400 })
  }
  if (major.length < 2) {
    return NextResponse.json({ error: 'Enter your major.' }, { status: 400 })
  }
  if (typeof hasMinor !== 'boolean') {
    return NextResponse.json({ error: 'Let us know whether you have a minor or certificate.' }, { status: 400 })
  }
  if (hasMinor && minor.length < 2) {
    return NextResponse.json({ error: 'Enter your minor or certificate.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      demographics_schools: schools,
      demographics_class_standing: classStanding,
      demographics_major: major,
      demographics_has_minor: hasMinor,
      demographics_minor: hasMinor ? minor : null,
      demographics_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
