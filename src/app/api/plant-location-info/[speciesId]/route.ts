import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { getPlantLocationInfoForSpecies, setPlantLocationInfo } from '@/lib/queries'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ speciesId: string }> }
) {
  const { speciesId } = await params
  const location_info = await getPlantLocationInfoForSpecies(speciesId).catch(() => null)
  return NextResponse.json({ location_info })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ speciesId: string }> }
) {
  const { speciesId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { location_info, property_id = 'elan' } = await req.json()
  await setPlantLocationInfo(speciesId, property_id, location_info ?? null)
  return NextResponse.json({ ok: true })
}
