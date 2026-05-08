// =============================================================================
// Elan Greens Admin — Database Query Functions
//
// All DB interactions are in this one file. WHY? Keeps SQL/Supabase syntax out
// of page components. If the DB schema changes, there is exactly one place to
// update — here.
//
// PATTERN: Each function is async, accepts typed params, and throws on error
// so the caller (Server Action or page) decides how to handle it.
// =============================================================================

import { createServiceRoleClient } from '@/lib/supabase.server'
import type { PlantSpecies, PlantInstance, StaffMember, DashboardStats, LinkedSpeciesCard, SpeciesSnippet } from '@/types'
import type { PlantSpeciesFormData, PlantInstanceFormData, StaffFormData } from '@/lib/validations'

// ── generatePlantId ────────────────────────────────────────────────────────────
// Finds the next available P-number by reading the highest existing plant_id.
// WHY not use a DB sequence? Keeps the P001 format visible to the admin
// without needing a custom Postgres function.
async function generatePlantId(): Promise<string> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from('plant_species')
    .select('plant_id')
    .order('plant_id', { ascending: false })
    .limit(1)
    .single()
  if (!data) return 'P001'
  const num = parseInt(data.plant_id.replace('P', ''), 10)
  return `P${String(num + 1).padStart(3, '0')}`
}

async function generateStaffId(): Promise<string> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from('staff_data')
    .select('staff_id')
    .order('staff_id', { ascending: false })
    .limit(1)
    .single()
  if (!data) return 'S001'
  const num = parseInt(data.staff_id.replace('S', ''), 10)
  return `S${String(num + 1).padStart(3, '0')}`
}

// ── PLANT SPECIES ─────────────────────────────────────────────────────────────

export async function getAllSpecies(): Promise<PlantSpecies[]> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species')
    .select('*')
    .is('deleted_at', null)
    .order('common_name')
  if (error) throw new Error(`Failed to load species: ${error.message}`)
  return data as PlantSpecies[]
}

export async function getSpeciesById(id: string): Promise<PlantSpecies> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(`Species not found: ${error.message}`)
  return data as PlantSpecies
}

// Checks if a species with the same common_name already exists (case-insensitive).
// Used in the Add Species flow to detect duplicates and prompt "add location instead".
export async function findSpeciesByName(name: string): Promise<PlantSpecies | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from('plant_species')
    .select('*')
    .ilike('common_name', name.trim())
    .is('deleted_at', null)
    .maybeSingle()
  return data as PlantSpecies | null
}

export async function createSpecies(
  formData: PlantSpeciesFormData,
  imageFields: Partial<PlantSpecies>
): Promise<PlantSpecies> {
  const db = createServiceRoleClient()
  const plant_id = await generatePlantId()
  const { data, error } = await db
    .from('plant_species')
    .insert({ ...formData, ...imageFields, plant_id, active: true })
    .select()
    .single()
  if (error) throw new Error(`Failed to create species: ${error.message}`)
  return data as PlantSpecies
}

export async function updateSpecies(
  id: string,
  fields: Partial<PlantSpecies>
): Promise<PlantSpecies> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update species: ${error.message}`)
  return data as PlantSpecies
}

// Soft delete — sets deleted_at to now. The DB row is preserved for recovery.
export async function softDeleteSpecies(id: string): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('plant_species')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id)
  if (error) throw new Error(`Failed to delete species: ${error.message}`)
}

export async function restoreSpecies(id: string): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('plant_species')
    .update({ deleted_at: null, active: true })
    .eq('id', id)
  if (error) throw new Error(`Failed to restore species: ${error.message}`)
}

// ── PLANT INSTANCES ───────────────────────────────────────────────────────────

export async function getInstancesBySpecies(speciesId: string): Promise<PlantInstance[]> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_instances')
    .select('*')
    .eq('species_id', speciesId)
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw new Error(`Failed to load locations: ${error.message}`)
  return data as PlantInstance[]
}

export async function createInstance(
  speciesId: string,
  formData: PlantInstanceFormData
): Promise<PlantInstance> {
  const db = createServiceRoleClient()
  const payload = {
    species_id: speciesId,
    internal_identification_no: formData.internal_identification_no || null,
    custom_location_desc: formData.custom_location_desc || null,
    lat: formData.lat || null,
    lng: formData.lng || null,
    date_of_plantation: formData.date_of_plantation || null,
    active: true,
  }
  const { data, error } = await db
    .from('plant_instances')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(`Failed to add location: ${error.message}`)
  return data as PlantInstance
}

export async function softDeleteInstance(id: string): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('plant_instances')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id)
  if (error) throw new Error(`Failed to remove location: ${error.message}`)
}

// ── STAFF ─────────────────────────────────────────────────────────────────────

export async function getAllStaff(): Promise<StaffMember[]> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('staff_data')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(`Failed to load staff: ${error.message}`)
  return data as StaffMember[]
}

export async function createStaff(
  formData: StaffFormData,
  photoUrl: string | null
): Promise<StaffMember> {
  const db = createServiceRoleClient()
  const staff_id = await generateStaffId()
  const { data, error } = await db
    .from('staff_data')
    .insert({ ...formData, staff_id, photo_url: photoUrl, active: true })
    .select()
    .single()
  if (error) throw new Error(`Failed to add staff member: ${error.message}`)
  return data as StaffMember
}

export async function updateStaff(
  id: string,
  fields: Partial<StaffMember>
): Promise<StaffMember> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('staff_data')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update staff: ${error.message}`)
  return data as StaffMember
}

export async function softDeleteStaff(id: string): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('staff_data')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id)
  if (error) throw new Error(`Failed to remove staff: ${error.message}`)
}

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────

// Three COUNT queries run in parallel with Promise.all to avoid waterfall.
export async function getDashboardStats(): Promise<Omit<DashboardStats, 'storageUsedBytes'>> {
  const db = createServiceRoleClient()
  const [species, instances, staff] = await Promise.all([
    db.from('plant_species').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('plant_instances').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('staff_data').select('*', { count: 'exact', head: true }).is('deleted_at', null),
  ])
  return {
    speciesCount:  species.count  ?? 0,
    instanceCount: instances.count ?? 0,
    staffCount:    staff.count    ?? 0,
  }
}

// ── LAST UPDATED ──────────────────────────────────────────────────────────────
// Returns the most recent updated_at across all three tables.
// Shown on the public main app as "Data updated: X".
export async function getLastUpdatedTimestamp(): Promise<string | null> {
  const db = createServiceRoleClient()
  const [s, i, st] = await Promise.all([
    db.from('plant_species').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
    db.from('plant_instances').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
    db.from('staff_data').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
  ])
  const timestamps = [s.data?.updated_at, i.data?.updated_at, st.data?.updated_at]
    .filter(Boolean) as string[]
  if (timestamps.length === 0) return null
  return timestamps.sort().reverse()[0]
}

// ── SPECIES LINKS ─────────────────────────────────────────────────────────────

export async function getLinkedSpecies(speciesId: string): Promise<LinkedSpeciesCard[]> {
  const db = createServiceRoleClient()
  // Fetch all link rows where this species appears on either side
  const { data, error } = await db
    .from('plant_species_links')
    .select('id, species_a_id, species_b_id, link_label')
    .or(`species_a_id.eq.${speciesId},species_b_id.eq.${speciesId}`)
  if (error) throw new Error(`Failed to load linked species: ${error.message}`)
  if (!data || data.length === 0) return []

  // Collect the IDs of the "other" side for each link
  const otherIds = data.map(row =>
    row.species_a_id === speciesId ? row.species_b_id : row.species_a_id
  )

  const { data: others, error: othersErr } = await db
    .from('plant_species')
    .select('id, common_name, botanical_name, category, img_main_url')
    .in('id', otherIds)
  if (othersErr) throw new Error(`Failed to load linked species details: ${othersErr.message}`)

  const othersMap = new Map((others ?? []).map(s => [s.id, s]))

  return data.map(row => {
    const otherId = row.species_a_id === speciesId ? row.species_b_id : row.species_a_id
    const other   = othersMap.get(otherId)
    return {
      link_id:        row.id,
      link_label:     row.link_label,
      species_id:     otherId,
      common_name:    other?.common_name    ?? 'Unknown',
      botanical_name: other?.botanical_name ?? null,
      category:       other?.category       ?? '',
      img_main_url:   other?.img_main_url   ?? null,
    }
  })
}

export async function getAllSpeciesSnippets(): Promise<SpeciesSnippet[]> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species')
    .select('id, plant_id, common_name, botanical_name')
    .is('deleted_at', null)
    .order('common_name')
  if (error) throw new Error(`Failed to load species list: ${error.message}`)
  return data as SpeciesSnippet[]
}
