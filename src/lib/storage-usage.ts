import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'
import { storageAlertEmail } from '@/lib/email/templates'

// Supabase free tier: 1GB storage included. Override with STORAGE_CAP_BYTES
// once the real plan is confirmed (e.g. Pro's 100GB).
export const STORAGE_CAP_BYTES = Number(process.env.STORAGE_CAP_BYTES || 1_073_741_824)
const WARN_RATIO = 0.8
const CRITICAL_RATIO = 0.95
const ALERT_TO = 'internal@txbosso.com'

type Level = 'ok' | 'warn' | 'critical' | 'full'
const LEVEL_RANK: Record<Level, number> = { ok: 0, warn: 1, critical: 2, full: 3 }

export class StorageFullError extends Error {
  constructor() {
    super("Sorry, we've hit our storage limit for now. The team has been notified and will free up space soon - please try again later.")
    this.name = 'StorageFullError'
  }
}

export async function getTotalStorageBytes(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc('get_total_storage_bytes')
  if (error) throw new Error(`Storage usage could not be checked: ${error.message}`)
  return Number(data || 0)
}

function levelFor(bytes: number): Level {
  if (bytes >= STORAGE_CAP_BYTES) return 'full'
  if (bytes >= STORAGE_CAP_BYTES * CRITICAL_RATIO) return 'critical'
  if (bytes >= STORAGE_CAP_BYTES * WARN_RATIO) return 'warn'
  return 'ok'
}

// Compares current usage against the last level we alerted on and emails
// internal@txbosso.com only when usage has newly crossed into a MORE severe
// level - not on every upload once past a threshold, but again if usage
// later drops back down (files deleted) and re-crosses it.
export async function checkStorageUsageAndAlert(admin: SupabaseClient, forceBytes?: number) {
  const bytes = forceBytes ?? (await getTotalStorageBytes(admin))
  const level = levelFor(bytes)

  const { data: state } = await admin.from('storage_usage_state').select('last_level').eq('id', 1).maybeSingle()
  const lastLevel = (state?.last_level as Level) || 'ok'

  if (level !== lastLevel) {
    await admin.from('storage_usage_state').update({ last_level: level, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  if (LEVEL_RANK[level] > LEVEL_RANK[lastLevel] && level !== 'ok') {
    try {
      await sendEmail({ to: ALERT_TO, email: storageAlertEmail({ level, usedBytes: bytes, capBytes: STORAGE_CAP_BYTES }) })
    } catch (emailError) {
      console.error('Storage alert email failed to send', emailError)
    }
  }

  return { bytes, level }
}

// Call before writing a new file. Refuses (without writing anything) if
// adding incomingBytes would put total usage at or over the cap, and makes
// sure the "full" alert fires even though the write itself never happened
// (so plain usage-based alerting wouldn't otherwise see anything new).
export async function assertStorageRoom(admin: SupabaseClient, incomingBytes: number) {
  const bytes = await getTotalStorageBytes(admin)
  if (bytes + incomingBytes > STORAGE_CAP_BYTES) {
    await checkStorageUsageAndAlert(admin, STORAGE_CAP_BYTES)
    throw new StorageFullError()
  }
  return bytes
}
