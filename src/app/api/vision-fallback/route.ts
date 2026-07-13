// =============================================================================
// Elan Greens Admin — Google Vision Web Detection Fallback Route Handler
//
// Called when Plant.id confidence < 70% or monthly quota is exhausted.
// Web Detection returns a list of "web entities" — names Google associates
// with the image based on matching pages. For plants, this usually returns
// the botanical name as the top entity.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import { timedFetch } from '@/lib/apiLogger'

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
    labelAnnotations?: Array<{ description: string; score: number }>
    imagePropertiesAnnotation?: {
      dominantColors?: {
        colors?: Array<{ color: { red: number; green: number; blue: number }; score: number; pixelFraction: number }>
      }
    }
  }]
}

// ── Color extraction ──────────────────────────────────────────────────────────
function rgbToColorName(r: number, g: number, b: number): string | null {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (l > 0.85 && (max - min) < 0.15) return 'white'
  if (l < 0.18) return null
  if ((max - min) < 0.12) return null  // grey / unsaturated
  const h = max === min ? 0 :
    max === rn ? ((gn - bn) / (max - min) + (gn < bn ? 6 : 0)) / 6 :
    max === gn ? ((bn - rn) / (max - min) + 2) / 6 :
               ((rn - gn) / (max - min) + 4) / 6
  const hd = h * 360
  if (hd < 15 || hd >= 345) return 'red'
  if (hd < 45)  return 'orange'
  if (hd < 75)  return 'yellow'
  if (hd < 165) return 'green'
  if (hd < 200) return 'cyan'
  if (hd < 255) return 'blue'
  if (hd < 290) return 'purple'
  return 'pink'
}

// Builds the pipe-separated search_tags string from Vision label + color results.
// Skips overly generic biological taxonomy labels.
const SKIP_LABELS = new Set([
  'nature','organism','biology','terrestrial plant','vascular plant','plant',
  'botany','flora','wildlife','green','vegetation','natural environment',
])

function computeSearchTags(
  labels: Array<{ description: string; score: number }>,
  colors: Array<{ color: { red: number; green: number; blue: number }; score: number }>
): string {
  const tags = new Set<string>()
  // Top labels with score > 0.70
  for (const l of labels) {
    if (l.score < 0.70) continue
    const t = l.description.toLowerCase().trim()
    if (!SKIP_LABELS.has(t) && t.length > 2) tags.add(t)
  }
  // Dominant colors — only include if they cover ≥10% of image pixels.
  // Vision sorts by `score` (saturation-weighted), not raw pixel area, so a
  // tiny yellow highlight can outscore large neutral areas. pixelFraction is
  // the ground truth for "this color is actually prominent in the photo".
  for (const c of colors) {
    if ((c.pixelFraction ?? 0) < 0.10) continue
    const name = rgbToColorName(c.color.red ?? 0, c.color.green ?? 0, c.color.blue ?? 0)
    if (name) tags.add(name)
  }
  return [...tags].slice(0, 12).join('|')
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

  const response = await timedFetch(
    'google_vision',
    'vision.googleapis.com',
    () => fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [
              { type: 'WEB_DETECTION',     maxResults: 5  },
              { type: 'LABEL_DETECTION',   maxResults: 10 },
              { type: 'IMAGE_PROPERTIES'                  },
            ],
          }],
        }),
      }
    )
  )

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`[vision-fallback] Google Vision API ${response.status}:`, errorBody)
    return NextResponse.json(
      { error: `Google Vision API error: ${response.status}`, detail: errorBody },
      { status: 502 }
    )
  }

  const result = await response.json() as VisionResponse
  const webDetection = result.responses[0]?.webDetection

  const labels = result.responses[0]?.labelAnnotations ?? []
  const colors = result.responses[0]?.imagePropertiesAnnotation?.dominantColors?.colors ?? []
  const searchTags = computeSearchTags(labels, colors)

  // Return top entities and best-guess labels in a clean shape.
  // The UI shows these as suggestions with a "Search on Google Images" link.
  return NextResponse.json({
    webEntities: webDetection?.webEntities?.slice(0, 3) ?? [],
    bestGuessLabel: webDetection?.bestGuessLabels?.[0]?.label ?? null,
    searchTags,   // new field
  })
}
