// =============================================================================
// Elan Greens Admin — Plant Species List (Server Component)
//
// Lists all non-deleted species. Search and soft-delete/restore actions are
// handled by Server Actions defined inline — no separate API route needed.
// =============================================================================

import Link from 'next/link'
import { getAllSpecies, softDeleteSpecies, restoreSpecies } from '@/lib/queries'
import { formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { revalidatePath } from 'next/cache'

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; showDeleted?: string }>
}) {
  const { q = '', showDeleted } = await searchParams
  const allSpecies = await getAllSpecies()

  // Filter client-query on the server — no client-side state needed.
  const filtered = allSpecies.filter(s => {
    const matchesSearch = !q || s.common_name.toLowerCase().includes(q.toLowerCase())
    return matchesSearch
  })

  // Server Actions — inline because they're specific to this page.
  async function deleteAction(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await softDeleteSpecies(id)
    revalidatePath('/plants')
  }

  async function restoreAction(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await restoreSpecies(id)
    revalidatePath('/plants')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Plants</h1>
        <Link
          href="/plants/new"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#2E7D32' }}
        >
          + Add Species
        </Link>
      </div>

      {/* Search */}
      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by common name…"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </form>

      <p className="text-sm text-gray-500">{filtered.length} species found</p>

      {/* Species table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Common Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(species => (
              <tr key={species.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{species.plant_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {species.common_name}
                  {species.botanical_name && (
                    <span className="block text-xs text-gray-400 italic">{species.botanical_name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-800 border border-green-200">
                    {species.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {species.tentative && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs mr-1">
                      TENTATIVE
                    </Badge>
                  )}
                  {!species.active && (
                    <Badge variant="outline" className="text-gray-400 text-xs">HIDDEN</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(species.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/plants/${species.id}/edit`} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </Link>
                    <Link href={`/plants/${species.id}/locations`} className="text-green-700 hover:underline text-xs">
                      Locations
                    </Link>
                    {!species.deleted_at ? (
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={species.id} />
                        <button type="submit" className="text-red-500 hover:underline text-xs">
                          Remove
                        </button>
                      </form>
                    ) : (
                      <form action={restoreAction}>
                        <input type="hidden" name="id" value={species.id} />
                        <button type="submit" className="text-green-600 hover:underline text-xs">
                          Restore
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="text-center py-12 text-gray-400">No species found.</p>
        )}
      </div>
    </div>
  )
}
