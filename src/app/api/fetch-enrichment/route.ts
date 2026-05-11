// =============================================================================
// Elan Greens Admin — Plant Enrichment Data Route
//
// Fetches structured enrichment data from four FREE APIs (no credits consumed):
//   1. GBIF        — habitat type, life form (no auth required)
//   2. POWO (Kew)  — propagation methods, growth rate (no auth required)
//   3. iNaturalist — conservation status (India-filtered), observations count
//   4. IUCN        — authoritative conservation status (token via env var)
//
// All calls run in parallel with individual timeouts so a single slow API
// never blocks the whole response. Missing/failed sources return null for
// their fields — admin reviews and saves only what looks correct.
//
// GET /api/fetch-enrichment?name=<botanical_name>
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import type { EnrichmentResult } from '@/types'

// Re-export so any server-side code that already imports from this route still works
export type { EnrichmentResult }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch with a timeout — returns null instead of throwing on timeout/error. */
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── GBIF ──────────────────────────────────────────────────────────────────────
// Endpoint: https://api.gbif.org/v1/species/match?name=<botanical>
// Then:     https://api.gbif.org/v1/species/{key}/speciesProfiles
//           https://api.gbif.org/v1/species/{key}/descriptions
// Returns: habitat_type, foliage hint (isEndemic etc.), growth clues.

interface GbifResult {
  habitat_type:  string | null
  foliage_type:  string | null
  growth_rate:   string | null
}

async function fetchGbif(name: string): Promise<{ data: GbifResult; status: 'ok' | 'miss' | 'error' }> {
  try {
    // Step 1: match name → get GBIF usageKey
    const matchRes = await fetchWithTimeout(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&verbose=false`
    )
    if (!matchRes?.ok) return { data: { habitat_type: null, foliage_type: null, growth_rate: null }, status: 'error' }
    const match = await matchRes.json() as { usageKey?: number; matchType?: string }
    if (!match.usageKey || match.matchType === 'NONE') {
      return { data: { habitat_type: null, foliage_type: null, growth_rate: null }, status: 'miss' }
    }

    // Step 2: speciesProfiles for habitat + life form
    const profilesRes = await fetchWithTimeout(
      `https://api.gbif.org/v1/species/${match.usageKey}/speciesProfiles`
    )
    const profiles = profilesRes?.ok ? await profilesRes.json() as { results?: Array<{ habitat?: string; isFreshwater?: boolean; isTerrestrial?: boolean; isExtinct?: boolean }> } : { results: [] }

    // Collect unique habitat strings from all profiles
    const habitats = (profiles.results ?? [])
      .map(p => p.habitat)
      .filter((h): h is string => !!h && h.length > 0)
    const uniqueHabitats = [...new Set(habitats.map(h => h.trim()))]
    const habitat_type = uniqueHabitats.length > 0 ? uniqueHabitats.slice(0, 3).join(', ') : null

    // Step 3: descriptions for growth / foliage clues
    const descRes = await fetchWithTimeout(
      `https://api.gbif.org/v1/species/${match.usageKey}/descriptions?limit=20`
    )
    const descs = descRes?.ok ? await descRes.json() as { results?: Array<{ type?: string; description?: string }> } : { results: [] }

    // Look for foliage type in description text
    let foliage_type: string | null = null
    let growth_rate: string | null = null
    for (const d of (descs.results ?? [])) {
      const text = (d.description ?? '').toLowerCase()
      if (!foliage_type) {
        if (text.includes('semi-evergreen')) foliage_type = 'Semi-evergreen'
        else if (text.includes('semi evergreen')) foliage_type = 'Semi-evergreen'
        else if (text.includes('deciduous')) foliage_type = 'Deciduous'
        else if (text.includes('evergreen')) foliage_type = 'Evergreen'
      }
      if (!growth_rate) {
        if (text.includes('fast-growing') || text.includes('fast growing') || text.includes('rapid growth')) growth_rate = 'Fast'
        else if (text.includes('slow-growing') || text.includes('slow growing') || text.includes('slow growth')) growth_rate = 'Slow'
        else if (text.includes('moderate growth') || text.includes('moderately fast')) growth_rate = 'Moderate'
      }
      if (foliage_type && growth_rate) break
    }

    const hasData = habitat_type || foliage_type || growth_rate
    return {
      data: { habitat_type, foliage_type, growth_rate },
      status: hasData ? 'ok' : 'miss',
    }
  } catch {
    return { data: { habitat_type: null, foliage_type: null, growth_rate: null }, status: 'error' }
  }
}

// ── POWO (Kew) ────────────────────────────────────────────────────────────────
// Unofficial endpoint: https://powo.science.kew.org/api/2/search?q=<name>&f=species_f
// Then: https://powo.science.kew.org/api/2/taxon/<fqId>
// Best source for propagation methods ("cloning" field) and foliage hints.

interface PowoResult {
  propagation_methods: string | null
  foliage_type:        string | null
  growth_rate:         string | null
}

async function fetchPowo(name: string): Promise<{ data: PowoResult; status: 'ok' | 'miss' | 'error' }> {
  const empty: PowoResult = { propagation_methods: null, foliage_type: null, growth_rate: null }
  try {
    // Search for the taxon
    const searchRes = await fetchWithTimeout(
      `https://powo.science.kew.org/api/2/search?q=${encodeURIComponent(name)}&f=species_f&p=1`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!searchRes?.ok) return { data: empty, status: 'error' }
    const search = await searchRes.json() as { results?: Array<{ fqId?: string; accepted?: boolean }> }
    const results = search.results ?? []

    // Prefer accepted name match
    const match = results.find(r => r.accepted) ?? results[0]
    if (!match?.fqId) return { data: empty, status: 'miss' }

    // Fetch taxon detail
    const detailRes = await fetchWithTimeout(
      `https://powo.science.kew.org/api/2/taxon/${encodeURIComponent(match.fqId)}?fields=descriptions`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!detailRes?.ok) return { data: empty, status: 'miss' }
    const detail = await detailRes.json() as {
      descriptions?: Array<{ type?: string; text?: string }>
    }

    let propagation_methods: string | null = null
    let foliage_type: string | null = null
    let growth_rate: string | null = null

    for (const desc of (detail.descriptions ?? [])) {
      const type = (desc.type ?? '').toLowerCase()
      const text = desc.text ?? ''
      const textLower = text.toLowerCase()

      // POWO "cloning" = propagation
      if (type === 'cloning' && text.trim()) {
        // Extract method keywords from the text
        const methods: string[] = []
        if (textLower.includes('seed')) methods.push('Seeds')
        if (textLower.includes('cutting')) methods.push('Stem cuttings')
        if (textLower.includes('division')) methods.push('Division')
        if (textLower.includes('layer')) methods.push('Air layering')
        if (textLower.includes('graft')) methods.push('Grafting')
        if (textLower.includes('sucker')) methods.push('Suckers')
        if (textLower.includes('offset')) methods.push('Offsets')
        if (textLower.includes('bulb')) methods.push('Bulbs')
        if (textLower.includes('spore')) methods.push('Spores')
        propagation_methods = methods.length > 0 ? methods.join('|') : text.slice(0, 100)
      }

      // Look for foliage and growth in all description types
      if (!foliage_type) {
        if (textLower.includes('semi-evergreen') || textLower.includes('semi evergreen')) foliage_type = 'Semi-evergreen'
        else if (textLower.includes('deciduous')) foliage_type = 'Deciduous'
        else if (textLower.includes('evergreen')) foliage_type = 'Evergreen'
      }
      if (!growth_rate) {
        if (textLower.includes('fast-growing') || textLower.includes('fast growing')) growth_rate = 'Fast'
        else if (textLower.includes('slow-growing') || textLower.includes('slow growing')) growth_rate = 'Slow'
        else if (textLower.includes('moderate growth') || textLower.includes('moderately')) growth_rate = 'Moderate'
      }
    }

    const hasData = propagation_methods || foliage_type || growth_rate
    return {
      data: { propagation_methods, foliage_type, growth_rate },
      status: hasData ? 'ok' : 'miss',
    }
  } catch {
    return { data: empty, status: 'error' }
  }
}

// ── iNaturalist ───────────────────────────────────────────────────────────────
// Endpoint: https://api.inaturalist.org/v1/taxa?q=<name>&rank=species
// India place_id = 6681 for filtered conservation status.

interface InatResult {
  conservation_status: string | null
  observations_count:  number | null
  foliage_type:        string | null
}

async function fetchInat(name: string): Promise<{ data: InatResult; status: 'ok' | 'miss' | 'error' }> {
  const empty: InatResult = { conservation_status: null, observations_count: null, foliage_type: null }
  try {
    const res = await fetchWithTimeout(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=1`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res?.ok) return { data: empty, status: 'error' }
    const json = await res.json() as {
      results?: Array<{
        name?: string
        observations_count?: number
        conservation_status?: { status_name?: string; iucn?: string }
        conservation_statuses?: Array<{ status_name?: string; place?: { id?: number }; authority?: string }>
      }>
    }
    const taxon = json.results?.[0]
    if (!taxon) return { data: empty, status: 'miss' }

    const observations_count = taxon.observations_count ?? null

    // Prefer India-specific status (place_id 6681), fall back to global
    let conservation_status: string | null = null
    const indiaStatus = (taxon.conservation_statuses ?? []).find(
      s => s.place?.id === 6681
    )
    if (indiaStatus?.status_name) {
      conservation_status = capitalizeStatus(indiaStatus.status_name)
    } else if (taxon.conservation_status?.status_name) {
      conservation_status = capitalizeStatus(taxon.conservation_status.status_name)
    }

    return {
      data: { conservation_status, observations_count, foliage_type: null },
      status: (conservation_status || observations_count !== null) ? 'ok' : 'miss',
    }
  } catch {
    return { data: empty, status: 'error' }
  }
}

// ── IUCN Red List ─────────────────────────────────────────────────────────────
// Endpoint: https://api.iucnredlist.org/api/v4/species/scientific_name/<name>
// Requires: IUCN_RED_LIST_API_KEY env var.
// Authoritative global conservation status.

interface IucnResult {
  conservation_status: string | null
}

async function fetchIucn(name: string): Promise<{ data: IucnResult; status: 'ok' | 'miss' | 'error' }> {
  const token = process.env.IUCN_RED_LIST_API_KEY
  if (!token) return { data: { conservation_status: null }, status: 'error' }
  try {
    const res = await fetchWithTimeout(
      `https://api.iucnredlist.org/api/v4/taxa/scientific_name?name=${encodeURIComponent(name)}`,
      {
        headers: {
          'Authorization': `Token token=${token}`,
          'Accept': 'application/json',
        },
      }
    )
    if (!res?.ok) return { data: { conservation_status: null }, status: res?.status === 404 ? 'miss' : 'error' }
    const json = await res.json() as {
      taxon?: {
        red_list_category?: { code?: string; description?: { en?: string } }
      }
      assessments?: Array<{
        red_list_category?: { code?: string; description?: { en?: string } }
      }>
    }

    // Try taxon-level category first, then most recent assessment
    const category =
      json.taxon?.red_list_category?.description?.en ??
      json.assessments?.[0]?.red_list_category?.description?.en ??
      null

    const conservation_status = category ? capitalizeStatus(category) : null
    return {
      data: { conservation_status },
      status: conservation_status ? 'ok' : 'miss',
    }
  } catch {
    return { data: { conservation_status: null }, status: 'error' }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function capitalizeStatus(s: string): string {
  // "least concern" → "Least Concern", "LC" → "Least Concern" etc.
  const map: Record<string, string> = {
    'lc': 'Least Concern', 'least concern': 'Least Concern',
    'nt': 'Near Threatened', 'near threatened': 'Near Threatened',
    'vu': 'Vulnerable', 'vulnerable': 'Vulnerable',
    'en': 'Endangered', 'endangered': 'Endangered',
    'cr': 'Critically Endangered', 'critically endangered': 'Critically Endangered',
    'ew': 'Extinct in the Wild', 'extinct in the wild': 'Extinct in the Wild',
    'ex': 'Extinct', 'extinct': 'Extinct',
    'dd': 'Data Deficient', 'data deficient': 'Data Deficient',
    'ne': 'Not Evaluated', 'not evaluated': 'Not Evaluated',
  }
  const key = s.toLowerCase().trim()
  return map[key] ?? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth — only superadmin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name || name.length < 3) {
    return NextResponse.json({ error: 'Provide a botanical name via ?name=' }, { status: 400 })
  }

  // Fire all four sources in parallel
  const [gbif, powo, inat, iucn] = await Promise.all([
    fetchGbif(name),
    fetchPowo(name),
    fetchInat(name),
    fetchIucn(name),
  ])

  // Merge: IUCN wins for conservation_status, then iNaturalist
  // GBIF + POWO both attempt foliage/growth — POWO wins on overlap
  const result: EnrichmentResult = {
    foliage_type:        powo.data.foliage_type        ?? gbif.data.foliage_type        ?? null,
    conservation_status: iucn.data.conservation_status ?? inat.data.conservation_status ?? null,
    observations_count:  inat.data.observations_count  ?? null,
    growth_rate:         powo.data.growth_rate          ?? gbif.data.growth_rate          ?? null,
    propagation_methods: powo.data.propagation_methods  ?? null,
    habitat_type:        gbif.data.habitat_type          ?? null,
    _sources: {
      gbif:        gbif.status,
      powo:        powo.status,
      inaturalist: inat.status,
      iucn:        iucn.status,
    },
  }

  return NextResponse.json(result)
}
