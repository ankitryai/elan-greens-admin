// Server Component — fetches the species on the server, hands data to the
// client form. This avoids a useEffect + loading state in the client component.

import { notFound } from 'next/navigation'
import { getSpeciesById, getLinkedSpecies, getAllSpeciesSnippets, getLandmarks, getLandmarkTagsForSpecies } from '@/lib/queries'
import EditSpeciesForm from './EditSpeciesForm'

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
    getLandmarks('elan').catch(() => []),
    getLandmarkTagsForSpecies(id).catch(() => []),
  ])
  if (!species) notFound()

  return (
    <EditSpeciesForm
      species={species}
      initialLinkedSpecies={initialLinkedSpecies}
      allSpeciesSnippets={allSnippets.filter(s => s.id !== id)}
      allLandmarks={allLandmarks}
      initialLandmarkIds={initialLandmarkIds}
    />
  )
}
