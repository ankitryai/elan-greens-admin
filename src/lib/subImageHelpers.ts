// =============================================================================
// Sub-image helper utilities — pure functions, no side effects.
// Extracted here so they can be unit tested independently of React components.
// =============================================================================

import type { WikimediaImage } from '@/types'

export interface SubImages {
  flowers: WikimediaImage[]
  fruits:  WikimediaImage[]
  leaves:  WikimediaImage[]
  bark:    WikimediaImage[]
  roots:   WikimediaImage[]
}

// Known image category keys — exactly what the DB and API support.
// Declared as a const so callers can iterate safely without hitting _debug etc.
export const IMAGE_PART_KEYS = ['flowers', 'fruits', 'leaves', 'bark', 'roots'] as const
export type ImagePartKey = typeof IMAGE_PART_KEYS[number]

/**
 * Strips unknown fields (e.g. _debug) from a raw API response and ensures
 * every known category is a proper array.  This prevents "x.map is not a
 * function" crashes when the API response contains non-array extra fields.
 */
export function sanitiseSubImages(raw: Record<string, unknown>): SubImages {
  const toArr = (v: unknown): WikimediaImage[] =>
    Array.isArray(v) ? (v as WikimediaImage[]) : []

  return {
    flowers: toArr(raw.flowers),
    fruits:  toArr(raw.fruits),
    leaves:  toArr(raw.leaves),
    bark:    toArr(raw.bark),
    roots:   toArr(raw.roots),
  }
}

/** Returns true when at least one category has at least one image. */
export function hasAnySubImages(imgs: SubImages): boolean {
  return IMAGE_PART_KEYS.some(k => imgs[k].length > 0)
}

/**
 * Flattens SubImages into the 20 flat DB column fields
 * (img_flower_1_url, img_flower_1_attr … img_root_2_attr).
 *
 * Writes an explicit null for every empty category. Correct for the Add
 * form (a brand-new row has nothing to preserve) — do NOT use this for
 * updating an existing row; use `buildSubImageFieldsForUpdate` instead,
 * or a fetch that found nothing for e.g. "bark" will wipe out an existing
 * saved bark photo.
 */
export function buildSubImageFields(subImages: SubImages | null): Record<string, string | null> {
  if (!subImages) return {}
  const f: Record<string, string | null> = {}
  const map: [string, ImagePartKey][] = [
    ['flower', 'flowers'], ['fruit', 'fruits'],
    ['leaf',   'leaves'],  ['bark',  'bark'],  ['root', 'roots'],
  ]
  for (const [prefix, key] of map) {
    const imgs = subImages[key]
    f[`img_${prefix}_1_url`]  = imgs[0]?.url          ?? null
    f[`img_${prefix}_1_attr`] = imgs[0]?.attribution  ?? null
    f[`img_${prefix}_2_url`]  = imgs[1]?.url          ?? null
    f[`img_${prefix}_2_attr`] = imgs[1]?.attribution  ?? null
  }
  return f
}

/**
 * Same mapping as `buildSubImageFields`, but categories with zero fetched
 * images are omitted entirely instead of written as null. Use this on the
 * Edit form so a fetch that found nothing for a category never overwrites
 * an existing saved image for that category (see CLAUDE.md lesson 6).
 */
export function buildSubImageFieldsForUpdate(subImages: SubImages): Record<string, string | null> {
  const f: Record<string, string | null> = {}
  const map: [string, ImagePartKey][] = [
    ['flower', 'flowers'], ['fruit', 'fruits'],
    ['leaf',   'leaves'],  ['bark',  'bark'],  ['root', 'roots'],
  ]
  for (const [prefix, key] of map) {
    const imgs = subImages[key]
    if (imgs.length === 0) continue
    f[`img_${prefix}_1_url`]  = imgs[0]?.url          ?? null
    f[`img_${prefix}_1_attr`] = imgs[0]?.attribution  ?? null
    f[`img_${prefix}_2_url`]  = imgs[1]?.url          ?? null
    f[`img_${prefix}_2_attr`] = imgs[1]?.attribution  ?? null
  }
  return f
}
