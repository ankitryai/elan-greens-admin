// =============================================================================
// Elan Greens Admin — TypeScript Types
// These mirror the Supabase DB schema exactly so TypeScript catches any
// mismatch between what the DB returns and what the UI expects.
// =============================================================================

// Allowed values for category — must match the CHECK constraint in schema.sql
export type PlantCategory =
  | 'Tree' | 'Palm' | 'Shrub' | 'Herb'
  | 'Creeper' | 'Climber' | 'Hedge' | 'Grass'

export type HeightCategory = 'Short' | 'Medium' | 'Tall'
export type FloweringType = 'Flowering' | 'Non-Flowering'
export type StaffRole = 'Head Gardener' | 'Assistant Gardener' | 'Maintenance Staff'

// ── plant_species row ────────────────────────────────────────────────────────
export interface PlantSpecies {
  id: string
  plant_id: string
  common_name: string
  botanical_name: string | null
  hindi_name: string | null
  kannada_name: string | null
  tamil_name: string | null
  category: PlantCategory
  height_category: HeightCategory | null
  flowering_type: FloweringType | null
  flowering_season: string | null
  description: string | null
  medicinal_properties: string | null
  plant_family: string | null
  genus: string | null
  toxicity: string | null
  edible_parts: string | null
  native_region: string | null
  sunlight_needs: string | null
  watering_needs: string | null
  interesting_fact: string | null
  life_span_description: string | null
  foliage_type: string | null           // Evergreen | Deciduous | Semi-evergreen
  conservation_status: string | null   // IUCN status e.g. Least Concern | Vulnerable
  observations_count: number | null    // iNaturalist global observation count
  growth_rate: string | null           // Slow | Moderate | Fast
  propagation_methods: string | null   // pipe-separated e.g. "Seeds|Stem cuttings"
  habitat_type: string | null          // e.g. "Tropical dry forest, scrublands"
  not_applicable_parts: string | null  // pipe-separated e.g. "fruit|bark|root"
  tentative: boolean
  active: boolean
  img_main_url: string | null
  img_main_attr: string | null
  img_flower_1_url: string | null; img_flower_1_attr: string | null
  img_flower_2_url: string | null; img_flower_2_attr: string | null
  img_fruit_1_url: string | null;  img_fruit_1_attr: string | null
  img_fruit_2_url: string | null;  img_fruit_2_attr: string | null
  img_leaf_1_url: string | null;   img_leaf_1_attr: string | null
  img_leaf_2_url: string | null;   img_leaf_2_attr: string | null
  img_bark_1_url: string | null;   img_bark_1_attr: string | null
  img_bark_2_url: string | null;   img_bark_2_attr: string | null
  img_root_1_url: string | null;   img_root_1_attr: string | null
  img_root_2_url: string | null;   img_root_2_attr: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ── plant_instances row ──────────────────────────────────────────────────────
export interface PlantInstance {
  id: string
  species_id: string
  internal_identification_no: number | null
  lat: number | null
  lng: number | null
  custom_location_desc: string | null
  date_of_plantation: string | null  // ISO date string "YYYY-MM-DD"
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ── staff_data row ───────────────────────────────────────────────────────────
export interface StaffMember {
  id: string
  staff_id: string
  name: string
  role: StaffRole
  date_of_joining: string | null  // ISO date string "YYYY-MM-DD"
  speciality: string | null
  photo_url: string | null
  tribute_note: string | null
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ── Plant.id API response shape ──────────────────────────────────────────────
export interface PlantIdSuggestion {
  plant_name: string       // botanical name
  plant_details: {
    common_names: string[] | null
    wiki_description?: { value: string } | null
    taxonomy?: { family: string; genus?: string } | null
    edible_parts?: string[] | null
    watering?: { min: number; max: number } | null
  }
  probability: number      // 0.0 – 1.0 confidence score
}

export interface PlantIdResult {
  suggestions: PlantIdSuggestion[]
  // Plant.id returns other fields; we only type what we use
}

// ── Wikimedia Commons image result ───────────────────────────────────────────
export interface WikimediaImage {
  url: string
  attribution: string  // "© Author, License, via Wikimedia Commons"
  title: string
}

// ── Admin dashboard stats ────────────────────────────────────────────────────
export interface DashboardStats {
  speciesCount: number
  instanceCount: number
  staffCount: number
  storageUsedBytes: number   // from Supabase Storage API
}

// ── plant_species_links ───────────────────────────────────────────────────────
// Normalised view — always exposes the "other" species relative to the one
// being displayed. One DB row covers both directions via OR query.
export interface LinkedSpeciesCard {
  link_id:        string
  link_label:     string
  species_id:     string
  common_name:    string
  botanical_name: string | null
  category:       string
  img_main_url:   string | null
}

export interface SpeciesSnippet {
  id:             string
  plant_id:       string
  common_name:    string
  botanical_name: string | null
}
