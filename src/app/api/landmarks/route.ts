// GET /api/landmarks — list all landmarks for a property
// POST /api/landmarks — create a new landmark

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { getLandmarks, createLandmark } from '@/lib/queries'
import { NextResponse, type NextRequest } from 'next/server'
import type { Landmark } from '@/types'

async function requireAdmin(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) return null
  return user
}

export async function GET(request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get('property_id') ?? 'elan'
  const landmarks = await getLandmarks(propertyId).catch(() => [])
  return NextResponse.json(landmarks)
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json() as Partial<Landmark>
  const { name, lat, lng, category, property_id, sub_label, icon, active } = body
  if (!name || lat == null || lng == null || !category) {
    return NextResponse.json({ error: 'name, lat, lng and category are required' }, { status: 400 })
  }
  try {
    const landmark = await createLandmark({
      property_id: property_id ?? 'elan',
      name: name.trim(),
      sub_label: sub_label?.trim() || null,
      icon: icon?.trim() || null,
      lat: Number(lat),
      lng: Number(lng),
      category,
      active: active ?? true,
    })
    return NextResponse.json(landmark, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Database error' }, { status: 500 })
  }
}
