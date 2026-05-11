// =============================================================================
// Tests for subImageHelpers — the functions that process API image responses
// before they reach the React components.
//
// WHY these tests exist:
//   The fetch-images API returns a _debug object alongside the 5 image arrays.
//   Passing the raw response to React components caused "x.map is not a
//   function" because _debug is an object, not an array.  sanitiseSubImages()
//   was added to fix this; these tests ensure the fix never regresses.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  sanitiseSubImages,
  hasAnySubImages,
  buildSubImageFields,
  IMAGE_PART_KEYS,
} from '@/lib/subImageHelpers'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IMG1 = { url: 'https://example.com/flower1.jpg', attribution: '© Alice', title: 'Flower 1' }
const IMG2 = { url: 'https://example.com/flower2.jpg', attribution: '© Bob',   title: 'Flower 2' }

const FULL_RESPONSE = {
  flowers: [IMG1, IMG2],
  fruits:  [IMG1],
  leaves:  [],
  bark:    [],
  roots:   [],
  _debug: {
    flowers: { source: 'wikimedia', query: 'Plumbago auriculata flowers' },
    fruits:  { source: 'inaturalist', query: 'Plumbago auriculata', level: 'species' },
  },
}

// ── sanitiseSubImages ─────────────────────────────────────────────────────────

describe('sanitiseSubImages', () => {
  it('strips _debug from the response', () => {
    const result = sanitiseSubImages(FULL_RESPONSE as Record<string, unknown>)
    expect(result).not.toHaveProperty('_debug')
  })

  it('keeps all 5 known image category keys', () => {
    const result = sanitiseSubImages(FULL_RESPONSE as Record<string, unknown>)
    for (const key of IMAGE_PART_KEYS) {
      expect(result).toHaveProperty(key)
    }
  })

  it('preserves image arrays correctly', () => {
    const result = sanitiseSubImages(FULL_RESPONSE as Record<string, unknown>)
    expect(result.flowers).toHaveLength(2)
    expect(result.fruits).toHaveLength(1)
    expect(result.leaves).toHaveLength(0)
  })

  it('returns empty arrays for missing categories', () => {
    const result = sanitiseSubImages({ flowers: [IMG1] })
    expect(result.fruits).toEqual([])
    expect(result.leaves).toEqual([])
    expect(result.bark).toEqual([])
    expect(result.roots).toEqual([])
  })

  it('replaces non-array values with empty arrays (the _debug crash scenario)', () => {
    // This is the exact scenario that caused "r.map is not a function":
    // a non-array value for a category key must become []
    const raw = {
      flowers: { source: 'wikimedia' },  // accidentally an object, not an array
      fruits:  null,
      leaves:  undefined,
      bark:    'broken',
      roots:   42,
    }
    const result = sanitiseSubImages(raw as Record<string, unknown>)
    for (const key of IMAGE_PART_KEYS) {
      expect(Array.isArray(result[key])).toBe(true)
    }
  })

  it('all returned values are arrays (so .map() never throws)', () => {
    const result = sanitiseSubImages(FULL_RESPONSE as Record<string, unknown>)
    for (const key of IMAGE_PART_KEYS) {
      expect(Array.isArray(result[key])).toBe(true)
    }
  })
})

// ── hasAnySubImages ───────────────────────────────────────────────────────────

describe('hasAnySubImages', () => {
  it('returns true when at least one category has images', () => {
    const imgs = sanitiseSubImages(FULL_RESPONSE as Record<string, unknown>)
    expect(hasAnySubImages(imgs)).toBe(true)
  })

  it('returns false when all categories are empty', () => {
    expect(hasAnySubImages({
      flowers: [], fruits: [], leaves: [], bark: [], roots: [],
    })).toBe(false)
  })

  it('returns true for a single image in any category', () => {
    for (const key of IMAGE_PART_KEYS) {
      const imgs = { flowers: [], fruits: [], leaves: [], bark: [], roots: [], [key]: [IMG1] }
      expect(hasAnySubImages(imgs)).toBe(true)
    }
  })
})

// ── buildSubImageFields ───────────────────────────────────────────────────────

describe('buildSubImageFields', () => {
  it('returns empty object for null input', () => {
    expect(buildSubImageFields(null)).toEqual({})
  })

  it('maps flowers[0] to img_flower_1_url and img_flower_1_attr', () => {
    const result = buildSubImageFields({ flowers: [IMG1], fruits: [], leaves: [], bark: [], roots: [] })
    expect(result.img_flower_1_url).toBe(IMG1.url)
    expect(result.img_flower_1_attr).toBe(IMG1.attribution)
  })

  it('maps flowers[1] to img_flower_2_url and img_flower_2_attr', () => {
    const result = buildSubImageFields({ flowers: [IMG1, IMG2], fruits: [], leaves: [], bark: [], roots: [] })
    expect(result.img_flower_2_url).toBe(IMG2.url)
    expect(result.img_flower_2_attr).toBe(IMG2.attribution)
  })

  it('sets _2 slots to null when only one image', () => {
    const result = buildSubImageFields({ flowers: [IMG1], fruits: [], leaves: [], bark: [], roots: [] })
    expect(result.img_flower_2_url).toBeNull()
    expect(result.img_flower_2_attr).toBeNull()
  })

  it('produces exactly 20 fields (5 categories × 2 slots × url+attr)', () => {
    const result = buildSubImageFields({ flowers: [], fruits: [], leaves: [], bark: [], roots: [] })
    expect(Object.keys(result)).toHaveLength(20)
  })

  it('sets all fields to null when all categories are empty', () => {
    const result = buildSubImageFields({ flowers: [], fruits: [], leaves: [], bark: [], roots: [] })
    for (const v of Object.values(result)) {
      expect(v).toBeNull()
    }
  })

  it('maps all 5 category prefixes correctly', () => {
    const imgs = { flowers: [IMG1], fruits: [IMG1], leaves: [IMG1], bark: [IMG1], roots: [IMG1] }
    const result = buildSubImageFields(imgs)
    expect(result.img_flower_1_url).toBe(IMG1.url)
    expect(result.img_fruit_1_url).toBe(IMG1.url)
    expect(result.img_leaf_1_url).toBe(IMG1.url)
    expect(result.img_bark_1_url).toBe(IMG1.url)
    expect(result.img_root_1_url).toBe(IMG1.url)
  })
})
