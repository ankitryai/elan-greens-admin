// Check if a species with the given common name already exists (case-insensitive).
// Used by the Add Species form before saving to prevent duplicates.

import { findSpeciesByName } from '@/lib/queries'
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ existing: null })

  const existing = await findSpeciesByName(name)
  return NextResponse.json({ existing: existing ? { id: existing.id, common_name: existing.common_name } : null })
}
