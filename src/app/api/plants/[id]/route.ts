// PATCH /api/plants/[id] — updates an existing species.
// Optionally replaces the main image if a new imageBase64 is provided.

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase.server'
import { updateSpecies } from '@/lib/queries'
import { plantSpeciesSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'
import type { PlantSpecies } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json() as Record<string, unknown>
  const { imageBase64, ...formPayload } = body

  const parsed = plantSpeciesSchema.safeParse(formPayload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const fields: Partial<PlantSpecies> = { ...parsed.data }

  // Only replace the main image if a new photo was uploaded
  if (imageBase64 && typeof imageBase64 === 'string') {
    const db = createServiceRoleClient()
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `${Date.now()}_${parsed.data.common_name.replace(/\s+/g, '_')}.jpg`
    const { data: uploadData, error: uploadError } = await db.storage
      .from('plant-images')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })
    if (!uploadError && uploadData) {
      const { data: urlData } = db.storage.from('plant-images').getPublicUrl(uploadData.path)
      fields.img_main_url = urlData.publicUrl
      fields.img_main_attr = 'Uploaded by admin'
    }
  }

  // Carry over any Wikimedia sub-image fields sent from the form
  const imgKeys = [
    'img_flower_1_url','img_flower_1_attr','img_flower_2_url','img_flower_2_attr',
    'img_fruit_1_url','img_fruit_1_attr','img_fruit_2_url','img_fruit_2_attr',
    'img_leaf_1_url','img_leaf_1_attr','img_leaf_2_url','img_leaf_2_attr',
    'img_bark_1_url','img_bark_1_attr','img_bark_2_url','img_bark_2_attr',
    'img_root_1_url','img_root_1_attr','img_root_2_url','img_root_2_attr',
  ] as const
  for (const key of imgKeys) {
    if (key in body) (fields as Record<string, unknown>)[key] = body[key]
  }

  const species = await updateSpecies(id, fields)
  return NextResponse.json(species)
}
