import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Service-role client for cron jobs that act on every user. Server-only.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // SUPABASE_SERVICE_ROLE_KEY is the name Vercel's Supabase integration creates
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Vercel cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set
export function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return !secret || req.headers.get('authorization') === `Bearer ${secret}`
}
