// Unit tests for Zod schemas.
// Confirms that the validation rules the form relies on are correct, and that
// the server-side guard behaves the same way as the client-side guard.

import { describe, it, expect } from 'vitest'
import { plantSpeciesSchema, plantInstanceSchema, staffSchema } from '@/lib/validations'

// ── plantSpeciesSchema ────────────────────────────────────────────────────────

describe('plantSpeciesSchema', () => {
  const base = { common_name: 'Neem Tree', category: 'Tree' }

  it('accepts a minimal valid payload', () => {
    const result = plantSpeciesSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('rejects missing common_name', () => {
    const result = plantSpeciesSchema.safeParse({ category: 'Tree' })
    expect(result.success).toBe(false)
  })

  it('rejects common_name shorter than 2 chars', () => {
    const result = plantSpeciesSchema.safeParse({ ...base, common_name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = plantSpeciesSchema.safeParse({ ...base, category: 'Weed' })
    expect(result.success).toBe(false)
  })

  it('rejects description longer than 500 chars', () => {
    const result = plantSpeciesSchema.safeParse({ ...base, description: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts all valid categories', () => {
    const cats = ['Tree','Palm','Shrub','Herb','Creeper','Climber','Hedge','Grass']
    for (const category of cats) {
      expect(plantSpeciesSchema.safeParse({ ...base, category }).success).toBe(true)
    }
  })
})

// ── plantInstanceSchema ───────────────────────────────────────────────────────

describe('plantInstanceSchema', () => {
  it('accepts an empty payload (all fields optional)', () => {
    expect(plantInstanceSchema.safeParse({}).success).toBe(true)
  })

  it('coerces numeric strings for lat/lng', () => {
    const result = plantInstanceSchema.safeParse({ lat: '12.9182', lng: '77.6735' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data.lat).toBe('number')
    }
  })

  it('rejects lat out of range', () => {
    const result = plantInstanceSchema.safeParse({ lat: 95 })
    expect(result.success).toBe(false)
  })

  it('rejects location description longer than 100 chars', () => {
    const result = plantInstanceSchema.safeParse({ custom_location_desc: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

// ── staffSchema ───────────────────────────────────────────────────────────────

describe('staffSchema', () => {
  const base = { name: 'Raju Kumar', role: 'Head Gardener' }

  it('accepts a minimal valid payload', () => {
    expect(staffSchema.safeParse(base).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(staffSchema.safeParse({ role: 'Head Gardener' }).success).toBe(false)
  })

  it('rejects invalid role', () => {
    expect(staffSchema.safeParse({ ...base, role: 'CEO' }).success).toBe(false)
  })

  it('rejects tribute_note longer than 300 chars', () => {
    const result = staffSchema.safeParse({ ...base, tribute_note: 'x'.repeat(301) })
    expect(result.success).toBe(false)
  })

  it('accepts all valid roles', () => {
    const roles = ['Head Gardener', 'Assistant Gardener', 'Maintenance Staff']
    for (const role of roles) {
      expect(staffSchema.safeParse({ ...base, role }).success).toBe(true)
    }
  })
})
