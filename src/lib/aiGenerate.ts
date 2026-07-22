// =============================================================================
// "Generate with AI" — pure helpers (no side effects, no network calls).
// Used by src/app/api/generate-with-ai/route.ts. Kept separate so the JSON-
// shape sanitisation and few-shot prompt building can be unit tested without
// mocking the Claude API.
// =============================================================================

import { AI_GENERATE_FIELDS, type AiGenerateField, type AiGenerateResult, type AiConfidence, type PlantSpecies } from '@/types'

const VALID_CONFIDENCE: readonly AiConfidence[] = ['high', 'medium', 'low']

/**
 * Strips unknown keys and coerces types from a raw LLM JSON response.
 * Never trusts the model's output shape directly — mirrors the sanitisation
 * rule already applied to external API responses (sanitiseSubImages).
 */
export function sanitiseAiGenerateResult(raw: unknown): AiGenerateResult {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const rawConfidence = (obj._confidence && typeof obj._confidence === 'object')
    ? obj._confidence as Record<string, unknown>
    : {}

  const result = {} as Record<AiGenerateField, string | null>
  const confidence: Partial<Record<AiGenerateField, AiConfidence>> = {}

  for (const field of AI_GENERATE_FIELDS) {
    const value = obj[field]
    result[field] = (typeof value === 'string' && value.trim()) ? value.trim() : null

    const c = rawConfidence[field]
    if (typeof c === 'string' && (VALID_CONFIDENCE as string[]).includes(c)) {
      confidence[field] = c as AiConfidence
    }
  }

  return { ...result, _confidence: confidence }
}

/** True when the sanitised result has at least one non-null field. */
export function hasAnyGeneratedField(result: AiGenerateResult): boolean {
  return AI_GENERATE_FIELDS.some(f => result[f] !== null)
}

/**
 * Parses a JSON object out of a raw LLM text response, tolerating the ways
 * models commonly fail to return "ONLY JSON" even when explicitly told to:
 *  - reasoning models (e.g. Nemotron) prepending a <think>...</think> block
 *  - markdown code fences around the JSON
 *  - a sentence or two of prose before/after the JSON object
 * Throws if no valid JSON object can be recovered — caller decides how to
 * surface that as an error.
 */
export function extractJsonObject(text: string): unknown {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // Fall back to the outermost {...} span — handles stray prose around the JSON.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) {
      throw new Error('No JSON object found in LLM response')
    }
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

/**
 * Builds a small set of few-shot examples from already-verified plants —
 * grounds the model's output format/tone, not its facts (a new species'
 * description should come from the model's own knowledge of that species,
 * never borrowed from an unrelated example plant).
 */
export function buildFewShotExamples(species: PlantSpecies[], limit = 4): string {
  const verified = species
    .filter(s => !s.tentative && s.description && s.description.trim().length > 0)
    .slice(0, limit)

  if (verified.length === 0) return '(no verified examples available — use your own judgement on format)'

  return verified
    .map(s => JSON.stringify({
      common_name: s.common_name,
      botanical_name: s.botanical_name,
      category: s.category,
      height_category: s.height_category,
      flowering_type: s.flowering_type,
      flowering_season: s.flowering_season,
      description: s.description,
      medicinal_properties: s.medicinal_properties,
      plant_family: s.plant_family,
      genus: s.genus,
      toxicity: s.toxicity,
      edible_parts: s.edible_parts,
      native_region: s.native_region,
      sunlight_needs: s.sunlight_needs,
      watering_needs: s.watering_needs,
      interesting_fact: s.interesting_fact,
      life_span_description: s.life_span_description,
      hindi_name: s.hindi_name,
      kannada_name: s.kannada_name,
      tamil_name: s.tamil_name,
    }))
    .join('\n')
}
