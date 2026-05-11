// PATCH /api/plants/[id] — updates an existing species.
// Optionally replaces the main image if a new imageBase64 is provided.

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase.server'
import { updateSpecies } from '@/lib/queries'
import { plantSpeciesSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'
import type { PlantSpecies } from '@/types'

function friendlyDbError(msg: string): string {
  if (msg.includes('invalid input syntax for type integer'))
    return 'Field "iNat Observations (observations_count)" must be a whole number or left blank — it cannot be empty text.'
  if (msg.includes('invalid input syntax for type'))
    return `A field received the wrong data type. DB detail: ${msg}`
  if (msg.includes('violates not-null constraint'))
    return `A required field is missing. DB detail: ${msg}`
  if (msg.includes('violates unique constraint'))
    return `A value must be unique but already exists. DB detail: ${msg}`
  return msg
}

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

  // Convert empty strings to null so optional fields clear correctly in the DB
  const fields = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v])
  ) as Partial<PlantSpecies>

  // Only replace the main image if a new photo was uploaded
  let uploadedPath: string | null = null
  const storageDb = imageBase64 ? createServiceRoleClient() : null

  if (imageBase64 && typeof imageBase64 === 'string' && storageDb) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `${Date.now()}_${parsed.data.common_name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
    const { data: uploadData, error: uploadError } = await storageDb.storage
      .from('plant-images')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) {
      return NextResponse.json(
        { error: `Image upload failed: ${uploadError.message}. Check that the "plant-images" storage bucket exists and is public in Supabase.` },
        { status: 500 }
      )
    }
    uploadedPath = uploadData.path
    const { data: urlData } = storageDb.storage.from('plant-images').getPublicUrl(uploadData.path)
    fields.img_main_url = urlData.publicUrl
    fields.img_main_attr = 'Uploaded by admin'
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

  try {
    const species = await updateSpecies(id, fields)
    return NextResponse.json(species)
  } catch (err) {
    // DB update failed — clean up any newly uploaded image to keep Storage consistent
    if (uploadedPath && storageDb) {
      await storageDb.storage.from('plant-images').remove([uploadedPath])
    }
    return NextResponse.json(
      { error: `Failed to save changes: ${friendlyDbError(err instanceof Error ? err.message : 'Database error')}` },
      { status: 500 }
    )
  }
}
