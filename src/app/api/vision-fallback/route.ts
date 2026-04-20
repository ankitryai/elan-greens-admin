// =============================================================================
// Elan Greens Admin — Google Vision Web Detection Fallback Route Handler
//
// Called when Plant.id confidence < 70% or monthly quota is exhausted.
// Web Detection returns a list of "web entities" — names Google associates
// with the image based on matching pages. For plants, this usually returns
// the botanical name as the top entity.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

interface VisionWebEntity {
  entityId: string
  score: number
  description: string  // usually the botanical or common name
}

interface VisionResponse {
  responses: [{
    webDetection?: {
      webEntities?: VisionWebEntity[]
      bestGuessLabels?: { label: string }[]
    }
  }]
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageBase64 } = await request.json() as { imageBase64: string }
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          // WEB_DETECTION returns matched web entities and best-guess labels.
          features: [{ type: 'WEB_DETECTION', maxResults: 5 }],
        }],
      }),
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: `Google Vision API error: ${response.status}` },
      { status: 502 }
    )
  }

  const result = await response.json() as VisionResponse
  const webDetection = result.responses[0]?.webDetection

  // Return top entities and best-guess labels in a clean shape.
  // The UI shows these as suggestions with a "Search on Google Images" link.
  return NextResponse.json({
    webEntities: webDetection?.webEntities?.slice(0, 3) ?? [],
    bestGuessLabel: webDetection?.bestGuessLabels?.[0]?.label ?? null,
  })
}
