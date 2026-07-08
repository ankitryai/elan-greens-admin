// Server Component — fetches the species on the server, hands data to the
// client form. This avoids a useEffect + loading state in the client component.

import { notFound } from 'next/navigation'
import { getSpeciesById, getLinkedSpecies, getAllSpeciesSnippets, getLandmarks, getLandmarkTagsForSpecies } from '@/lib/queries'
import EditSpeciesForm from './EditSpeciesForm'
import type { Landmark } from '@/types'

const PROPERTY_ID   = 'elan'
const PROPERTY_NAME = 'Divyasree Elan Homes'

// Lightweight IF-text → landmark matcher (no NLP library needed).
// Checks block codes (1a–1h, 2a), sub-names (Caldra, Clayton…),
// gate aliases, and amenity name substrings.
function suggestFromIF(ifText: string | null, landmarks: Landmark[]): string[] {
  if (!ifText) return []
  const t = ifText.toLowerCase()
  const hits = new Set<string>()

  for (const lm of landmarks) {
    const name = lm.name.toLowerCase()
    const sub  = lm.sub_label?.toLowerCase() ?? ''

    // Sub-label match first (most specific — e.g. "caldra" → Block 1A)
    if (sub && t.includes(sub)) { hits.add(lm.id); continue }

    // Block shorthand: extract code from "Block 1B" → test \b1b\b in text
    if (name.startsWith('block ')) {
      const code = name.replace('block ', '')          // "1b", "2a" etc.
      if (new RegExp(`\\b${code}\\b`).test(t)) { hits.add(lm.id); continue }
    }

    // Direct full-name substring match (catches "swimming pool", "back gate", etc.)
    if (t.includes(name)) { hits.add(lm.id); continue }

    // Gate aliases
    if (name === 'entry gate' && /(entry\s*gate|main\s*gate|entrance\s*gate)/.test(t)) {
      hits.add(lm.id); continue
    }
    if (name === 'back gate'  && /(back\s*gate|rear\s*gate)/.test(t)) {
      hits.add(lm.id); continue
    }
  }

  return [...hits]
}

export default async function EditSpeciesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [species, initialLinkedSpecies, allSnippets, allLandmarks, initialLandmarkIds] = await Promise.all([
    getSpeciesById(id).catch(() => null),
    getLinkedSpecies(id).catch(() => []),
    getAllSpeciesSnippets().catch(() => []),
    getLandmarks(PROPERTY_ID).catch(() => []),
    getLandmarkTagsForSpecies(id).catch(() => []),
  ])
  if (!species) notFound()

  // Only suggest when no tags are saved yet; don't overwrite deliberate choices
  const suggestedLandmarkIds = initialLandmarkIds.length === 0
    ? suggestFromIF(species.interesting_fact ?? null, allLandmarks)
    : []

  return (
    <EditSpeciesForm
      species={species}
      initialLinkedSpecies={initialLinkedSpecies}
      allSpeciesSnippets={allSnippets.filter(s => s.id !== id)}
      allLandmarks={allLandmarks}
      initialLandmarkIds={initialLandmarkIds}
      suggestedLandmarkIds={suggestedLandmarkIds}
      propertyName={PROPERTY_NAME}
    />
  )
}
