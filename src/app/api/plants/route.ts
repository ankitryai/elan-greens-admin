// =============================================================================
// Elan Greens Admin — Plants API Route
// POST /api/plants — creates a new species and uploads the main image.
//
// WHY an API route instead of a pure Server Action for the image upload?
// Server Actions receive FormData well, but uploading a base64 image to
// Supabase Storage requires the service-role client which must stay server-side.
// The image bytes + form data arrive as JSON, are processed here, and the
// resulting Storage URL is saved to the DB.
// =============================================================================

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase.server'
import { createSpecies } from '@/lib/queries'
import { plantSpeciesSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'
import type { PlantSpecies } from '@/types'

export async function POST(request: NextRequest) {
  // Auth check on every write route
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as Record<string, unknown>
  const { imageBase64, ...formPayload } = body

  // Server-side validation — never trust client-only validation
  const parsed = plantSpeciesSchema.safeParse(formPayload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Upload main image to Supabase Storage if provided
  let imgMainUrl: string | null = null
  let uploadedPath: string | null = null
  const storageDb = imageBase64 ? createServiceRoleClient() : null

  if (imageBase64 && typeof imageBase64 === 'string' && storageDb) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `${Date.now()}_${parsed.data.common_name.replace(/\s+/g, '_')}.jpg`

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
    imgMainUrl = urlData.publicUrl
  }

  // Extract image URL fields that came from Wikimedia (already URLs, not base64)
  const imageFields: Partial<PlantSpecies> = {
    img_main_url:  imgMainUrl,
    img_main_attr: imgMainUrl ? 'Uploaded by admin' : null,
  }
  const imgKeys = [
    'img_flower_1_url','img_flower_1_attr','img_flower_2_url','img_flower_2_attr',
    'img_fruit_1_url','img_fruit_1_attr','img_fruit_2_url','img_fruit_2_attr',
    'img_leaf_1_url','img_leaf_1_attr','img_leaf_2_url','img_leaf_2_attr',
    'img_bark_1_url','img_bark_1_attr','img_bark_2_url','img_bark_2_attr',
    'img_root_1_url','img_root_1_attr','img_root_2_url','img_root_2_attr',
  ] as const
  for (const key of imgKeys) {
    if (body[key]) (imageFields as Record<string, unknown>)[key] = body[key]
  }

  try {
    const species = await createSpecies(parsed.data, imageFields)
    return NextResponse.json(species, { status: 201 })
  } catch (err) {
    // DB insert failed — clean up the image we already uploaded so Storage stays consistent
    if (uploadedPath && storageDb) {
      await storageDb.storage.from('plant-images').remove([uploadedPath])
    }
    return NextResponse.json(
      { error: `Failed to save species: ${err instanceof Error ? err.message : 'Database error'}` },
      { status: 500 }
    )
  }
}
