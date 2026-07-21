// =============================================================================
// Elan Greens Admin — "Generate with AI" Route Handler
//
// Given a photo + common name + botanical name, asks Claude to draft the
// remaining plant-form fields (description, uses, local names, etc.) so the
// admin only has to review and correct rather than type from scratch.
// Generated data is always TENTATIVE until an admin publishes it — this route
// never writes to the DB, it only returns a draft for the form to pre-fill.
//
// The botanical name is the grounding key: it disambiguates species that
// share a common name (e.g. two different plants both called "Jasmine").
// Few-shot examples come from already-VERIFIED plants in the DB — they teach
// the model the expected format/tone, never facts about the new species.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import { getAllSpecies } from '@/lib/queries'
import { timedFetch } from '@/lib/apiLogger'
import { AI_GENERATE_FIELDS } from '@/types'
import { sanitiseAiGenerateResult, buildFewShotExamples } from '@/lib/aiGenerate'

const CLAUDE_MODEL = 'claude-sonnet-5'

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], data: match[2] }
}

export async function POST(request: NextRequest) {
  // Auth — only superadmin may trigger a (paid) Claude API call.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { commonName?: string; botanicalName?: string; imageBase64?: string; imageUrl?: string }
  const commonName = (body.commonName ?? '').trim()
  const botanicalName = (body.botanicalName ?? '').trim()

  if (!commonName || !botanicalName || !botanicalName.includes(' ')) {
    return NextResponse.json(
      { error: 'Provide both a common name and a full two-word botanical name.' },
      { status: 400 }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 502 })
  }

  // Few-shot examples from already-verified plants — format grounding only.
  let fewShotBlock = '(no verified examples available — use your own judgement on format)'
  try {
    const allSpecies = await getAllSpecies()
    fewShotBlock = buildFewShotExamples(allSpecies)
  } catch {
    // Non-fatal — proceed without examples rather than failing the whole request.
  }

  let image = body.imageBase64 ? parseDataUrl(body.imageBase64) : null
  // Edit form passes the saved photo's public Storage URL rather than re-encoding
  // it client-side — fetch and base64-encode it server-side (Anthropic's Messages
  // API image source only supports base64, unlike Vision's imageUri).
  if (!image && body.imageUrl) {
    try {
      const imgRes = await fetch(body.imageUrl)
      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
        if (/^image\/(jpeg|png|webp)$/.test(contentType)) {
          const buf = Buffer.from(await imgRes.arrayBuffer())
          image = { mediaType: contentType, data: buf.toString('base64') }
        }
      }
    } catch {
      // Non-fatal — proceed text-only rather than failing the whole request.
    }
  }

  const systemPrompt = `You are drafting plant directory entries for a residential society's plant catalogue.
Given a botanical name, common name, and optionally a photo, fill in the remaining fields below.

The botanical name is the grounding key — base every fact on that exact species, not on the common name alone
(different species can share a common name). If you are not confident about a field, still make your best
attempt but mark it with low confidence rather than leaving it blank, EXCEPT where you have no reasonable basis
at all (e.g. no Tamil name is well known) — then return null for that field.

Match the tone and field format of these already-verified entries from the same catalogue (format only —
do not copy their facts, they are a different species):
${fewShotBlock}

Fields to generate: ${AI_GENERATE_FIELDS.join(', ')}.
- category: one of Tree, Palm, Shrub, Herb, Creeper, Climber, Hedge, Grass
- height_category: one of Short, Medium, Tall
- flowering_type: one of Flowering, Non-Flowering
- description: 2-3 sentences, directional not encyclopaedic
- medicinal_properties: pipe-separated short claims, e.g. "Treats fever|Reduces inflammation" (be conservative — this is the field most prone to overclaiming)
- Local names (hindi_name, kannada_name, tamil_name): regional variants exist and you can hallucinate here — mark confidence low unless well known

Respond with ONLY a single JSON object, no prose, no markdown fences, in this exact shape:
{ ${AI_GENERATE_FIELDS.map(f => `"${f}": string | null`).join(', ')}, "_confidence": { "<field>": "high" | "medium" | "low", ... } }`

  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: `Common name: ${commonName}\nBotanical name: ${botanicalName}` },
  ]
  if (image) {
    userContent.unshift({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.data },
    })
  }

  const response = await timedFetch(
    'anthropic_claude',
    'api.anthropic.com',
    () => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    }),
    { botanical_name: botanicalName }
  )

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json(
      { error: `Claude API error: ${response.status} ${text}` },
      { status: 502 }
    )
  }

  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> }
  const textBlock = payload.content?.find(b => b.type === 'text')?.text
  if (!textBlock) {
    return NextResponse.json({ error: 'Claude returned no text content.' }, { status: 502 })
  }

  let parsed: unknown
  try {
    // Model is instructed to return raw JSON, but strip markdown fences defensively.
    const cleaned = textBlock.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Claude response was not valid JSON.' }, { status: 502 })
  }

  const result = sanitiseAiGenerateResult(parsed)
  return NextResponse.json(result)
}
