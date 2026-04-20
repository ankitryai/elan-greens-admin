// =============================================================================
// Elan Greens Admin — Health Check Route Handler
//
// Pings the database with SELECT 1 to keep the Supabase free-tier project
// active (it pauses after 7 days with no activity).
// Can be called by a Vercel cron job daily — see DEPLOYMENT.md.
// =============================================================================

import { createServiceRoleClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = createServiceRoleClient()
  // A minimal query — just checks the DB connection is alive.
  const { error } = await db.from('plant_species').select('id').limit(1)
  if (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 503 })
  }
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
