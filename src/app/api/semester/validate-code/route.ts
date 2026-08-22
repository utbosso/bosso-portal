import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (code.length < 4 || code.length > 80) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: term, error: termError } = await admin.from('academic_terms').select('id').eq('status', 'current').maybeSingle()
  if (termError && ['42P01', 'PGRST205'].includes(termError.code || '')) {
    const { data: legacyResult } = await admin.rpc('validate_registration_code', { code_text: code } as any)
    const legacyRow = Array.isArray(legacyResult) ? legacyResult[0] : null
    return NextResponse.json({ valid: Boolean(legacyRow?.is_valid), intendedRole: legacyRow?.intended_role })
  }
  if (!term) return NextResponse.json({ valid: false }, { status: 409 })

  const { data: positionCode } = await admin
    .from('position_codes')
    .select('intended_role, is_active, expires_at')
    .eq('term_id', term.id)
    .eq('code_hash', hashCode(code))
    .maybeSingle()

  const valid = Boolean(
    positionCode?.is_active &&
      (!positionCode.expires_at || new Date(positionCode.expires_at).getTime() >= Date.now())
  )

  return NextResponse.json({ valid, intendedRole: valid ? positionCode?.intended_role : undefined })
}
