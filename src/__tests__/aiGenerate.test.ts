// =============================================================================
// Tests for src/lib/aiGenerate.ts — pure helpers behind "Generate with AI".
// =============================================================================

import { describe, it, expect } from 'vitest'
import { sanitiseAiGenerateResult, hasAnyGeneratedField, buildFewShotExamples, extractJsonObject } from '@/lib/aiGenerate'
import { AI_GENERATE_FIELDS } from '@/types'
import type { PlantSpecies } from '@/types'

// ── sanitiseAiGenerateResult ────────────────────────────────────────────────

describe('sanitiseAiGenerateResult', () => {
  it('returns all-null fields for non-object input', () => {
    const result = sanitiseAiGenerateResult(null)
    for (const field of AI_GENERATE_FIELDS) {
      expect(result[field]).toBeNull()
    }
    expect(result._confidence).toEqual({})
  })

  it('returns all-null fields for a garbage string response', () => {
    const result = sanitiseAiGenerateResult('not an object')
    expect(result.description).toBeNull()
  })

  it('passes through known string fields', () => {
    const result = sanitiseAiGenerateResult({ genus: 'Azadirachta', description: 'A tree.' })
    expect(result.genus).toBe('Azadirachta')
    expect(result.description).toBe('A tree.')
  })

  it('trims whitespace and treats blank strings as null', () => {
    const result = sanitiseAiGenerateResult({ genus: '   ', plant_family: '  Meliaceae  ' })
    expect(result.genus).toBeNull()
    expect(result.plant_family).toBe('Meliaceae')
  })

  it('drops unknown/malicious keys never present in AI_GENERATE_FIELDS', () => {
    const result = sanitiseAiGenerateResult({ genus: 'Azadirachta', __proto__polluted: 'x', not_a_real_field: 'y' })
    expect(Object.keys(result)).not.toContain('not_a_real_field')
    expect((result as Record<string, unknown>).not_a_real_field).toBeUndefined()
  })

  it('coerces non-string field values to null instead of crashing', () => {
    const result = sanitiseAiGenerateResult({ genus: 123, description: { nested: true }, category: ['Tree'] })
    expect(result.genus).toBeNull()
    expect(result.description).toBeNull()
    expect(result.category).toBeNull()
  })

  it('only accepts high/medium/low confidence values, drops anything else', () => {
    const result = sanitiseAiGenerateResult({
      genus: 'Azadirachta',
      _confidence: { genus: 'high', description: 'extremely-confident', plant_family: 42 },
    })
    expect(result._confidence.genus).toBe('high')
    expect(result._confidence.description).toBeUndefined()
    expect(result._confidence.plant_family).toBeUndefined()
  })

  it('ignores a non-object _confidence value', () => {
    const result = sanitiseAiGenerateResult({ genus: 'Azadirachta', _confidence: 'high' })
    expect(result._confidence).toEqual({})
  })

  it('produces exactly the known AI_GENERATE_FIELDS keys plus _confidence', () => {
    const result = sanitiseAiGenerateResult({})
    const keys = Object.keys(result).sort()
    const expected = [...AI_GENERATE_FIELDS, '_confidence'].sort()
    expect(keys).toEqual(expected)
  })

  it('normalises enum fields to canonical casing (case-insensitive match)', () => {
    const result = sanitiseAiGenerateResult({ category: 'herb', height_category: 'MEDIUM', foliage_type: 'evergreen' })
    expect(result.category).toBe('Herb')
    expect(result.height_category).toBe('Medium')
    expect(result.foliage_type).toBe('Evergreen')
  })

  it('drops an enum value that is not in the allowed option list', () => {
    const result = sanitiseAiGenerateResult({ category: 'Bush', growth_rate: 'Very Fast Indeed' })
    expect(result.category).toBeNull()
    expect(result.growth_rate).toBeNull()
  })

  it('leaves non-enum free-text fields untouched by enum validation', () => {
    const result = sanitiseAiGenerateResult({ description: 'Anything goes here.' })
    expect(result.description).toBe('Anything goes here.')
  })

  it('hard-truncates a field longer than its DB/schema character limit', () => {
    const longWatering = 'This is a much longer sentence than the 20-character watering_needs limit allows'
    const result = sanitiseAiGenerateResult({ watering_needs: longWatering })
    expect(result.watering_needs).toHaveLength(20)
    expect(result.watering_needs).toBe(longWatering.slice(0, 20))
  })

  it('does not truncate a field that is already within its limit', () => {
    const result = sanitiseAiGenerateResult({ watering_needs: 'Low' })
    expect(result.watering_needs).toBe('Low')
  })
})

// ── hasAnyGeneratedField ─────────────────────────────────────────────────────

describe('hasAnyGeneratedField', () => {
  it('returns false when every field is null', () => {
    const result = sanitiseAiGenerateResult({})
    expect(hasAnyGeneratedField(result)).toBe(false)
  })

  it('returns true when at least one field is set', () => {
    const result = sanitiseAiGenerateResult({ genus: 'Azadirachta' })
    expect(hasAnyGeneratedField(result)).toBe(true)
  })
})

// ── buildFewShotExamples ─────────────────────────────────────────────────────

function makeSpecies(overrides: Partial<PlantSpecies>): PlantSpecies {
  return {
    id: '1', plant_id: 'P001', common_name: 'Neem', botanical_name: 'Azadirachta indica',
    hindi_name: null, kannada_name: null, tamil_name: null, category: 'Tree',
    height_category: null, flowering_type: null, flowering_season: null,
    description: 'A shade tree.', medicinal_properties: null, plant_family: null, genus: null,
    toxicity: null, edible_parts: null, native_region: null, sunlight_needs: null,
    watering_needs: null, interesting_fact: null, life_span_description: null,
    foliage_type: null, conservation_status: null, observations_count: null,
    growth_rate: null, propagation_methods: null, habitat_type: null,
    not_applicable_parts: null, tentative: false, search_tags: null, active: true,
    img_main_url: null, img_main_attr: null,
    img_flower_1_url: null, img_flower_1_attr: null, img_flower_2_url: null, img_flower_2_attr: null,
    img_fruit_1_url: null, img_fruit_1_attr: null, img_fruit_2_url: null, img_fruit_2_attr: null,
    img_leaf_1_url: null, img_leaf_1_attr: null, img_leaf_2_url: null, img_leaf_2_attr: null,
    img_bark_1_url: null, img_bark_1_attr: null, img_bark_2_url: null, img_bark_2_attr: null,
    img_root_1_url: null, img_root_1_attr: null, img_root_2_url: null, img_root_2_attr: null,
    notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

describe('buildFewShotExamples', () => {
  it('returns a fallback message when there are no verified plants', () => {
    expect(buildFewShotExamples([])).toMatch(/no verified examples/i)
  })

  it('excludes tentative plants even if they have a description', () => {
    const examples = buildFewShotExamples([makeSpecies({ tentative: true })])
    expect(examples).toMatch(/no verified examples/i)
  })

  it('excludes verified plants with no description', () => {
    const examples = buildFewShotExamples([makeSpecies({ tentative: false, description: null })])
    expect(examples).toMatch(/no verified examples/i)
  })

  it('includes verified plants with a description as JSON lines', () => {
    const examples = buildFewShotExamples([makeSpecies({ common_name: 'Neem', tentative: false })])
    expect(examples).toContain('"common_name":"Neem"')
  })

  it('caps the number of examples at the given limit', () => {
    const species = Array.from({ length: 10 }, (_, i) => makeSpecies({ common_name: `Plant ${i}`, tentative: false }))
    const examples = buildFewShotExamples(species, 2)
    expect(examples.split('\n')).toHaveLength(2)
  })
})

// ── extractJsonObject ─────────────────────────────────────────────────────────

describe('extractJsonObject', () => {
  it('parses a clean JSON object as-is', () => {
    expect(extractJsonObject('{"genus": "Azadirachta"}')).toEqual({ genus: 'Azadirachta' })
  })

  it('strips markdown code fences', () => {
    expect(extractJsonObject('```json\n{"genus": "Azadirachta"}\n```')).toEqual({ genus: 'Azadirachta' })
  })

  it('strips a <think>...</think> reasoning block from reasoning models', () => {
    const text = '<think>Let me consider the taxonomy here...</think>\n{"genus": "Azadirachta"}'
    expect(extractJsonObject(text)).toEqual({ genus: 'Azadirachta' })
  })

  it('extracts JSON embedded in surrounding prose', () => {
    const text = 'Sure, here is the plant data:\n{"genus": "Azadirachta"}\nLet me know if you need more.'
    expect(extractJsonObject(text)).toEqual({ genus: 'Azadirachta' })
  })

  it('handles a reasoning block plus trailing prose together', () => {
    const text = '<think>reasoning...</think>\nHere you go: {"genus": "Azadirachta"} Hope that helps!'
    expect(extractJsonObject(text)).toEqual({ genus: 'Azadirachta' })
  })

  it('throws when no JSON object is present at all', () => {
    expect(() => extractJsonObject('Sorry, I cannot help with that.')).toThrow()
  })

  it('throws when the extracted braces do not contain valid JSON', () => {
    expect(() => extractJsonObject('{not: valid, json}')).toThrow()
  })
})
