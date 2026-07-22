// =============================================================================
// "Generate with AI" — pure helpers (no side effects, no network calls).
// Used by src/app/api/generate-with-ai/route.ts. Kept separate so the JSON-
// shape sanitisation and few-shot prompt building can be unit tested without
// mocking the Claude API.
// =============================================================================

import { AI_GENERATE_FIELDS, type AiGenerateField, type AiGenerateResult, type AiConfidence, type PlantSpecies } from '@/types'

const VALID_CONFIDENCE: readonly AiConfidence[] = ['high', 'medium', 'low']

// Mirrors the DB/Zod constraints in src/lib/validations.ts (plantSpeciesSchema).
// LLMs don't reliably respect "keep it under N characters" in the prompt —
// hard-truncate here as a safety net, same reasoning as the maxLength
// attribute already enforced on every bounded input in the form.
const MAX_LENGTHS: Partial<Record<AiGenerateField, number>> = {
  hindi_name: 100, kannada_name: 100, tamil_name: 100,
  flowering_season: 50,
  description: 500, medicinal_properties: 300,
  plant_family: 100, genus: 100, toxicity: 50, edible_parts: 200,
  native_region: 150, sunlight_needs: 30, watering_needs: 20,
  interesting_fact: 300, life_span_description: 100,
  foliage_type: 50, conservation_status: 100, growth_rate: 20,
  propagation_methods: 200, habitat_type: 200,
}

// Fields that must be one of a fixed set (matching the Select options / DB
// CHECK constraints) rather than freeform text — validated case-insensitively
// and normalised to the canonical casing, or dropped to null if the model
// returns something outside the set (better an empty Select than a value
// that silently fails to render as selected).
const ENUM_FIELDS: Partial<Record<AiGenerateField, readonly string[]>> = {
  category: ['Tree', 'Palm', 'Shrub', 'Herb', 'Creeper', 'Climber', 'Hedge', 'Grass'],
  height_category: ['Short', 'Medium', 'Tall'],
  flowering_type: ['Flowering', 'Non-Flowering'],
  foliage_type: ['Evergreen', 'Deciduous', 'Semi-evergreen'],
  growth_rate: ['Slow', 'Moderate', 'Fast'],
}

function normaliseEnumValue(field: AiGenerateField, value: string): string | null {
  const options = ENUM_FIELDS[field]
  if (!options) return value
  const match = options.find(o => o.toLowerCase() === value.toLowerCase())
  return match ?? null
}

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
    let cleaned = (typeof value === 'string' && value.trim()) ? value.trim() : null

    if (cleaned) cleaned = normaliseEnumValue(field, cleaned)

    const max = MAX_LENGTHS[field]
    if (cleaned && max && cleaned.length > max) cleaned = cleaned.slice(0, max)

    result[field] = cleaned

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
      foliage_type: s.foliage_type,
      conservation_status: s.conservation_status,
      growth_rate: s.growth_rate,
      propagation_methods: s.propagation_methods,
      habitat_type: s.habitat_type,
    }))
    .join('\n')
}
