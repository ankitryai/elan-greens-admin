// POST /api/backfill-tags
// Processes all plants that have img_main_url but no search_tags.
// Uses Vision imageUri (public URL) instead of base64 — no storage overhead.
// Safe to call multiple times — skips plants that already have tags.

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'

// Re-use the same helpers from vision-fallback
function rgbToColorName(r: number, g: number, b: number): string | null {
  const rn = r/255, gn = g/255, bn = b/255
  const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn)
  const l = (max+min)/2
  if (l > 0.85 && (max-min) < 0.15) return 'white'
  if (l < 0.18 || (max-min) < 0.12) return null
  const h = max===min ? 0 :
    max===rn ? ((gn-bn)/(max-min)+(gn<bn?6:0))/6 :
    max===gn ? ((bn-rn)/(max-min)+2)/6 :
               ((rn-gn)/(max-min)+4)/6
  const hd = h*360
  if (hd<15||hd>=345) return 'red'
  if (hd<45) return 'orange'
  if (hd<75) return 'yellow'
  if (hd<165) return 'green'
  if (hd<200) return 'cyan'
  if (hd<255) return 'blue'
  if (hd<290) return 'purple'
  return 'pink'
}
const SKIP = new Set(['nature','organism','biology','terrestrial plant','vascular plant','plant','botany','flora','wildlife','green','vegetation','natural environment'])
function computeTags(
  labels: Array<{description:string;score:number}>,
  colors: Array<{color:{red:number;green:number;blue:number};score:number;pixelFraction?:number}>
): string {
  const tags = new Set<string>()
  for (const l of labels) { if (l.score>=0.70) { const t=l.description.toLowerCase().trim(); if(!SKIP.has(t)&&t.length>2) tags.add(t) } }
  // Require pixelFraction ≥ 10% so background tints (yellow sky, warm concrete)
  // don't pollute color tags — Vision's `score` is saturation-weighted, not area.
  for (const c of colors) {
    if ((c.pixelFraction??0) < 0.10) continue
    const n=rgbToColorName(c.color.red??0,c.color.green??0,c.color.blue??0)
    if(n) tags.add(n)
  }
  return [...tags].slice(0,12).join('|')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { overwrite?: boolean }
  const overwrite = body.overwrite === true

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  let query = db
    .from('plant_species')
    .select('id, common_name, img_main_url')
    .not('img_main_url', 'is', null)
    .is('deleted_at', null)

  // Without overwrite: skip plants that already have tags (safe incremental run).
  // With overwrite: re-process all plants with photos to regenerate tags fresh.
  if (!overwrite) {
    query = query.or('search_tags.is.null,search_tags.eq.')
  }

  const { data: plants, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!plants || plants.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No plants to process.' })
  }

  let processed = 0, failed = 0
  const key = process.env.GOOGLE_VISION_API_KEY

  for (const plant of plants) {
    if (!plant.img_main_url || !key) continue
    try {
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { source: { imageUri: plant.img_main_url } },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'IMAGE_PROPERTIES' },
              ],
            }],
          }),
        }
      )
      if (!res.ok) { failed++; continue }
      const result = await res.json() as { responses: [{ labelAnnotations?: Array<{description:string;score:number}>; imagePropertiesAnnotation?: { dominantColors?: { colors?: Array<{color:{red:number;green:number;blue:number};score:number;pixelFraction?:number}> } } }] }
      const labels = result.responses[0]?.labelAnnotations ?? []
      const colors = result.responses[0]?.imagePropertiesAnnotation?.dominantColors?.colors ?? []
      const tags = computeTags(labels, colors)
      if (tags) {
        await db.from('plant_species').update({ search_tags: tags }).eq('id', plant.id)
        processed++
      }
      // Small delay to avoid hammering Vision API
      await new Promise(r => setTimeout(r, 200))
    } catch { failed++ }
  }

  return NextResponse.json({ processed, failed, total: plants.length, overwrite })
}
