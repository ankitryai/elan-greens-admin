// GET /api/plant-landmark-tags/[speciesId] — list landmark IDs tagged to a species
// PUT /api/plant-landmark-tags/[speciesId] — replace all tags for a species

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { getLandmarkTagsForSpecies, setLandmarkTagsForSpecies } from '@/lib/queries'
import { NextResponse, type NextRequest } from 'next/server'

async function requireAdmin(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) return null
  return user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ speciesId: string }> }
) {
  const { speciesId } = await params
  const landmarkIds = await getLandmarkTagsForSpecies(speciesId).catch(() => [])
  return NextResponse.json({ landmark_ids: landmarkIds })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ speciesId: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { speciesId } = await params
  const body = await request.json() as { landmark_ids: string[] }
  if (!Array.isArray(body.landmark_ids)) {
    return NextResponse.json({ error: 'landmark_ids must be an array' }, { status: 400 })
  }
  try {
    await setLandmarkTagsForSpecies(speciesId, body.landmark_ids)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Database error' }, { status: 500 })
  }
}
