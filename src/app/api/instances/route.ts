// POST /api/instances — creates a new plant_instance (physical location)

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { createInstance } from '@/lib/queries'
import { plantInstanceSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { species_id: string } & Record<string, unknown>
  const { species_id, ...rest } = body

  const parsed = plantInstanceSchema.safeParse(rest)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const instance = await createInstance(species_id, parsed.data)
  return NextResponse.json(instance, { status: 201 })
}
