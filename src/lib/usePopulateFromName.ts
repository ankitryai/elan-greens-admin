'use client'
// =============================================================================
// Shared "Populate from Name" hook — fires GBIF/POWO/iNaturalist/IUCN
// enrichment and Wikimedia image fetches in parallel from a botanical name.
//
// Used by both the Add page and the Edit form. The two forms differ only in
// how aggressively they apply the result:
//   mode: 'create' — form starts empty, so every returned field is set.
//   mode: 'edit'   — form may already hold admin-entered data, so only
//                    currently-empty fields are filled (never silently
//                    overwrites something the admin typed).
// =============================================================================

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'
import type { EnrichmentResult, FetchDebug } from '@/types'
import { sanitiseSubImages, type SubImages } from '@/lib/subImageHelpers'

type FormMethods = ReturnType<typeof useForm<PlantSpeciesFormData>>

const ENRICHMENT_FIELDS: Array<[keyof PlantSpeciesFormData, keyof EnrichmentResult, string]> = [
  ['foliage_type',         'foliage_type',         'Foliage'],
  ['conservation_status',  'conservation_status',  'Conservation'],
  ['observations_count',   'observations_count',   'iNat Observations'],
  ['growth_rate',          'growth_rate',           'Growth Rate'],
  ['propagation_methods',  'propagation_methods',  'Propagation'],
  ['habitat_type',         'habitat_type',          'Habitat'],
]

export function usePopulateFromName({
  mode,
  watch,
  setValue,
  commonName,
  onImagesFetched,
}: {
  mode: 'create' | 'edit'
  watch: FormMethods['watch']
  setValue: FormMethods['setValue']
  commonName: string
  /** Called with the sanitised fetch result so the caller can store it (and, on the Edit form, the raw per-category debug info for genus-mismatch warnings). */
  onImagesFetched: (imgs: SubImages, debug: Record<string, FetchDebug> | null) => void
}) {
  const [populatingFromName, setPopulatingFromName] = useState(false)
  const [populateStatus, setPopulateStatus] = useState<string | null>(null)

  async function handlePopulateFromName() {
    const botanical = (watch('botanical_name') ?? '').trim()
    if (!botanical) {
      setPopulateStatus('Fill in the Botanical Name first.')
      return
    }

    setPopulatingFromName(true)
    setPopulateStatus('Fetching from GBIF · POWO · iNaturalist · IUCN · Wikimedia…')

    try {
      const [enrichRes, imagesRes] = await Promise.all([
        fetch(`/api/fetch-enrichment?name=${encodeURIComponent(botanical)}`),
        fetch(`/api/fetch-images?name=${encodeURIComponent(botanical)}&common=${encodeURIComponent(commonName)}`),
      ])

      const filled: string[] = []

      if (enrichRes.ok) {
        const e = await enrichRes.json() as EnrichmentResult
        for (const [field, key, label] of ENRICHMENT_FIELDS) {
          const value = e[key]
          if (value === null || value === undefined || value === '') continue
          if (mode === 'edit' && (watch(field) ?? '').toString().trim()) continue
          setValue(field, value as never)
          filled.push(label)
        }
      }

      if (imagesRes.ok) {
        const raw = await imagesRes.json() as Record<string, unknown>
        const { _debug, ...rest } = raw
        const imgs = sanitiseSubImages(rest)
        const count = Object.values(imgs).flat().length
        onImagesFetched(imgs, (_debug && typeof _debug === 'object') ? _debug as Record<string, FetchDebug> : null)
        if (count > 0) filled.push(`${count} Image${count !== 1 ? 's' : ''}`)
      }

      setPopulateStatus(
        filled.length > 0
          ? `✅ Filled: ${filled.join(' · ')}. Review before saving.`
          : `No data found for "${botanical}" across free APIs — fill remaining fields manually.`
      )
    } catch {
      setPopulateStatus('Fetch failed — check your connection and try again.')
    } finally {
      setPopulatingFromName(false)
    }
  }

  return { populatingFromName, populateStatus, handlePopulateFromName }
}
