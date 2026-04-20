// Server Component — fetches the species on the server, hands data to the
// client form. This avoids a useEffect + loading state in the client component.

import { notFound } from 'next/navigation'
import { getSpeciesById } from '@/lib/queries'
import EditSpeciesForm from './EditSpeciesForm'

export default async function EditSpeciesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const species = await getSpeciesById(id).catch(() => null)
  if (!species) notFound()

  return <EditSpeciesForm species={species} />
}
