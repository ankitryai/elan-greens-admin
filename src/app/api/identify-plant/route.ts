// =============================================================================
// Elan Greens Admin — Plant.id Identification Route Handler
//
// WHY a Route Handler instead of calling Plant.id from the browser?
// The Plant.id API key must never reach the client bundle. This handler
// receives the image as a base64 string from the admin browser, forwards it
// to Plant.id server-side, and returns only the structured result.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import type { PlantIdResult } from '@/types'

export async function POST(request: NextRequest) {
  // Auth check — only the superadmin may trigger identification calls.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageBase64 } = await request.json() as { imageBase64: string }
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const response = await fetch('https://api.plant.id/v2/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.PLANT_ID_API_KEY!,
    },
    body: JSON.stringify({
      images: [imageBase64],
      // Request extra detail fields that map to our plant_species columns.
      plant_details: ['common_names', 'wiki_description', 'taxonomy', 'edible_parts', 'watering'],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json(
      { error: `Plant.id API error: ${response.status} ${text}` },
      { status: 502 }
    )
  }

  const result = await response.json() as PlantIdResult
  return NextResponse.json(result)
}
