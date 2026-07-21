// =============================================================================
// Elan Greens Admin — "Generate with AI" Route Handler
//
// Given a photo + common name + botanical name, drafts the remaining
// plant-form fields (description, uses, local names, etc.) so the admin only
// has to review and correct rather than type from scratch. Generated data is
// always TENTATIVE until an admin publishes it — this route never writes to
// the DB, it only returns a draft for the form to pre-fill.
//
// Two separate OpenAI-compatible chat-completions providers, both swappable
// via env vars with no code change (provider-agnostic on purpose — started
// on a free Kimi K2 text tier, may move providers as free-tier limits shift):
//   1. Text drafting  — LLM_API_KEY        (default: Moonshot Kimi K2)
//   2. Photo → visual description — LLM_VISION_API_KEY (default: NVIDIA NIM)
// The vision step is optional and independent: it turns a photo into a plain
// text visual description, which then becomes one more input to the text
// model. If no photo or no vision key is configured, generation proceeds
// text-only from the botanical + common name.
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

const LLM_API_BASE_URL        = process.env.LLM_API_BASE_URL        ?? 'https://api.moonshot.ai/v1'
const LLM_MODEL                = process.env.LLM_MODEL               ?? 'kimi-k2-0711-preview'
const LLM_VISION_API_BASE_URL = process.env.LLM_VISION_API_BASE_URL ?? 'https://integrate.api.nvidia.com/v1'
const LLM_VISION_MODEL         = process.env.LLM_VISION_MODEL         ?? 'meta/llama-3.2-90b-vision-instruct'

function hostnameOf(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

/** Turns a photo into a plain-text visual description via an OpenAI-compatible vision model. Returns null on any failure — vision is a nice-to-have, never blocks text generation. */
async function describeImage(imageUrlOrDataUri: string): Promise<string | null> {
  const apiKey = process.env.LLM_VISION_API_KEY
  if (!apiKey) return null

  try {
    const response = await timedFetch(
      'llm_vision',
      hostnameOf(LLM_VISION_API_BASE_URL),
      () => fetch(`${LLM_VISION_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: LLM_VISION_MODEL,
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Objectively describe this plant photo for a botanical catalogue: leaf shape and arrangement, bark texture and colour, flower colour and form if visible, fruit if visible, overall growth habit. Plain prose, no speculation about species identity, 3-4 sentences.' },
              { type: 'image_url', image_url: { url: imageUrlOrDataUri } },
            ],
          }],
        }),
      })
    )
    if (!response.ok) return null
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return payload.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  // Auth — only superadmin may trigger these (rate-limited free-tier) API calls.
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

  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LLM_API_KEY is not configured on the server.' }, { status: 502 })
  }

  // Few-shot examples from already-verified plants — format grounding only.
  let fewShotBlock = '(no verified examples available — use your own judgement on format)'
  try {
    const allSpecies = await getAllSpecies()
    fewShotBlock = buildFewShotExamples(allSpecies)
  } catch {
    // Non-fatal — proceed without examples rather than failing the whole request.
  }

  // Vision step is independent of the text provider — pass either a fresh
  // data URI or the saved photo's public Storage URL straight through
  // (OpenAI-compatible image_url accepts both, no server-side re-encoding needed).
  const imageInput = body.imageBase64 || body.imageUrl || null
  const visualDescription = imageInput ? await describeImage(imageInput) : null

  const systemPrompt = `You are drafting plant directory entries for a residential society's plant catalogue.
Given a botanical name, common name, and optionally a visual description of a photo, fill in the remaining fields below.

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

  const userText = [
    `Common name: ${commonName}`,
    `Botanical name: ${botanicalName}`,
    visualDescription ? `Photo description: ${visualDescription}` : null,
  ].filter(Boolean).join('\n')

  const response = await timedFetch(
    'llm_text',
    hostnameOf(LLM_API_BASE_URL),
    () => fetch(`${LLM_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
    }),
    { botanical_name: botanicalName }
  )

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json(
      { error: `LLM API error: ${response.status} ${text}` },
      { status: 502 }
    )
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const textBlock = payload.choices?.[0]?.message?.content
  if (!textBlock) {
    return NextResponse.json({ error: 'LLM returned no text content.' }, { status: 502 })
  }

  let parsed: unknown
  try {
    // Model is instructed to return raw JSON, but strip markdown fences defensively.
    const cleaned = textBlock.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'LLM response was not valid JSON.' }, { status: 502 })
  }

  const result = sanitiseAiGenerateResult(parsed)
  return NextResponse.json(result)
}
