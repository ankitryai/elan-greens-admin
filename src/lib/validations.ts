// =============================================================================
// Elan Greens Admin — Zod Validation Schemas (Zod v4)
//
// WHY define schemas here instead of inline in each form?
// These schemas are used both client-side (React Hook Form) for UX feedback
// AND server-side (Server Actions / Route Handlers) for security. One source
// of truth means a rule change automatically applies to both layers.
// =============================================================================

import { z } from 'zod'

// Allowed enum values must match the CHECK constraints in schema.sql exactly.
const CATEGORIES = ['Tree','Palm','Shrub','Herb','Creeper','Climber','Hedge','Grass'] as const
const HEIGHTS = ['Short','Medium','Tall'] as const
const FLOWERING = ['Flowering','Non-Flowering'] as const
const STAFF_ROLES = ['Head Gardener','Assistant Gardener','Maintenance Staff'] as const

// Reusable: name-like string (letters, spaces, brackets, hyphens, ampersand)
const nameString = (max: number) =>
  z.string()
    .min(2, 'Must be at least 2 characters')
    .max(max, `Must be ${max} characters or fewer`)
    .regex(/^[\w\s\(\)\-\u2013&,.']+$/u, 'Contains unsupported special characters')

// ── plantSpeciesSchema ────────────────────────────────────────────────────────
// Used on the Add/Edit Species form.
export const plantSpeciesSchema = z.object({
  common_name:          nameString(100),
  botanical_name:       z.string().max(150).optional().or(z.literal('')),
  hindi_name:           z.string().max(100).optional().or(z.literal('')),
  kannada_name:         z.string().max(100).optional().or(z.literal('')),
  tamil_name:           z.string().max(100).optional().or(z.literal('')),
  category:             z.enum(CATEGORIES, { error: 'Select a valid category' }),
  height_category:      z.enum(HEIGHTS).optional().or(z.literal('')),
  flowering_type:       z.enum(FLOWERING).optional().or(z.literal('')),
  flowering_season:     z.string().max(50).optional().or(z.literal('')),
  description:          z.string().max(500, 'Max 500 characters').optional().or(z.literal('')),
  medicinal_properties: z.string().max(300, 'Max 300 characters').optional().or(z.literal('')),
  plant_family:         z.string().max(100).optional().or(z.literal('')),
  toxicity:             z.string().max(50).optional().or(z.literal('')),
  edible_parts:         z.string().max(200).optional().or(z.literal('')),
  native_region:        z.string().max(150).optional().or(z.literal('')),
  sunlight_needs:       z.string().max(30).optional().or(z.literal('')),
  watering_needs:       z.string().max(20).optional().or(z.literal('')),
  interesting_fact:     z.string().max(300).optional().or(z.literal('')),
  life_span_description:z.string().max(100).optional().or(z.literal('')),
  not_applicable_parts: z.string().optional().or(z.literal('')),
  tentative:            z.boolean().default(true),
  notes:                z.string().max(300).optional().or(z.literal('')),
})
// Warn (not error) if botanical_name is a single word — likely incomplete.
// We handle this as a UI hint only, not a hard validation error.

export type PlantSpeciesFormData = z.infer<typeof plantSpeciesSchema>

// ── plantInstanceSchema ───────────────────────────────────────────────────────
// Used on the Add/Edit Location (plant instance) form.
export const plantInstanceSchema = z.object({
  internal_identification_no: z.coerce
    .number({ error: 'Must be a number' })
    .int('Must be a whole number')
    .positive('Must be positive')
    .optional()
    .or(z.literal('')),
  custom_location_desc: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
  lat: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  lng: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
  date_of_plantation:   z.string().optional().or(z.literal('')),
})

export type PlantInstanceFormData = z.infer<typeof plantInstanceSchema>

// ── staffSchema ───────────────────────────────────────────────────────────────
export const staffSchema = z.object({
  name:             nameString(100),
  role:             z.enum(STAFF_ROLES, { error: 'Select a valid role' }),
  date_of_joining:  z.string().optional().or(z.literal('')),
  speciality:       z.string().max(150).optional().or(z.literal('')),
  tribute_note:     z.string().max(300, 'Max 300 characters').optional().or(z.literal('')),
})

export type StaffFormData = z.infer<typeof staffSchema>
