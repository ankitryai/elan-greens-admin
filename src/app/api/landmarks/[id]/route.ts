// PUT /api/landmarks/[id] — update a landmark
// DELETE /api/landmarks/[id] — delete a landmark

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { updateLandmark, deleteLandmark } from '@/lib/queries'
import { NextResponse, type NextRequest } from 'next/server'
import type { Landmark } from '@/types'

async function requireAdmin(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) return null
  return user
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json() as Partial<Landmark>
  const { name, lat, lng, category, sub_label, icon, active } = body
  try {
    const landmark = await updateLandmark(id, {
      ...(name        != null && { name: name.trim() }),
      ...(lat         != null && { lat: Number(lat) }),
      ...(lng         != null && { lng: Number(lng) }),
      ...(category    != null && { category }),
      ...(sub_label   !== undefined && { sub_label: sub_label?.trim() || null }),
      ...(icon        !== undefined && { icon: icon?.trim() || null }),
      ...(active      != null && { active }),
    })
    return NextResponse.json(landmark)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Database error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await deleteLandmark(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Database error' }, { status: 500 })
  }
}
