// Server Component — fetches the species on the server, hands data to the
// client form. This avoids a useEffect + loading state in the client component.

import { notFound } from 'next/navigation'
import { getSpeciesById, getLinkedSpecies, getAllSpeciesSnippets } from '@/lib/queries'
import EditSpeciesForm from './EditSpeciesForm'

export default async function EditSpeciesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [species, initialLinkedSpecies, allSnippets] = await Promise.all([
    getSpeciesById(id).catch(() => null),
    getLinkedSpecies(id).catch(() => []),
    getAllSpeciesSnippets().catch(() => []),
  ])
  if (!species) notFound()

  return (
    <EditSpeciesForm
      species={species}
      initialLinkedSpecies={initialLinkedSpecies}
      allSpeciesSnippets={allSnippets.filter(s => s.id !== id)}
    />
  )
}
