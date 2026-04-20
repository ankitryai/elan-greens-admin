// =============================================================================
// Manage Locations Page — Lists all instances for a species
// Server Component: fetches species + all instances, renders a table.
// Soft-delete handled by an inline Server Action.
// =============================================================================

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSpeciesById, getInstancesBySpecies, softDeleteInstance } from '@/lib/queries'
import { formatDate, formatPlantAge } from '@/lib/formatters'
import { Button } from '@/components/ui/button'

export default async function ManageLocationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [species, instances] = await Promise.all([
    getSpeciesById(id).catch(() => null),
    getInstancesBySpecies(id),
  ])
  if (!species) notFound()

  async function removeLocation(formData: FormData) {
    'use server'
    const instanceId = formData.get('instanceId') as string
    await softDeleteInstance(instanceId)
    revalidatePath(`/plants/${id}/locations`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/plants" className="hover:underline">Plants</Link> /
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          Locations — {species.common_name}
        </h1>
        {species.botanical_name && (
          <p className="text-sm italic text-gray-500">{species.botanical_name}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href={`/plants/${id}/locations/new`}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#2E7D32' }}
        >
          + Add Location
        </Link>
        <Link href={`/plants/${id}/edit`} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
          Edit Species
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tree No.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Planted</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Age</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {instances.map(inst => (
              <tr key={inst.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {inst.internal_identification_no ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-800">
                  {inst.custom_location_desc ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                  {inst.lat && inst.lng
                    ? `${inst.lat.toFixed(5)}, ${inst.lng.toFixed(5)}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(inst.date_of_plantation)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatPlantAge(inst.date_of_plantation) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <form action={removeLocation}>
                    <input type="hidden" name="instanceId" value={inst.id} />
                    <button type="submit" className="text-red-500 hover:underline text-xs">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {instances.length === 0 && (
          <p className="text-center py-12 text-gray-400">
            No locations recorded yet. Add one above.
          </p>
        )}
      </div>
    </div>
  )
}
