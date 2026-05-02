// =============================================================================
// Elan Greens Admin — Plant Species List (Server Component)
//
// Sorting is URL-driven (?sort=field&dir=asc|desc) so no client JS is needed.
// Default sort: updated_at DESC (most recently changed first).
// =============================================================================

import Link from 'next/link'
import { getAllSpecies, softDeleteSpecies, restoreSpecies } from '@/lib/queries'
import { formatDateTime } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { revalidatePath } from 'next/cache'
import { PlantSearchInput } from '@/components/PlantSearchInput'
import type { PlantSpecies } from '@/types'

type SortField = 'plant_id' | 'common_name' | 'category' | 'updated_at'
const VALID_SORTS: SortField[] = ['plant_id', 'common_name', 'category', 'updated_at']

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>
}) {
  const { q = '', sort = 'updated_at', dir = 'desc' } = await searchParams
  const allSpecies = await getAllSpecies()

  const sortField: SortField = VALID_SORTS.includes(sort as SortField) ? (sort as SortField) : 'updated_at'
  const sortDir = dir === 'asc' ? 'asc' : 'desc'

  const filtered = allSpecies
    .filter(s => !q || s.common_name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      let aVal = '', bVal = ''
      if      (sortField === 'plant_id')    { aVal = a.plant_id ?? '';     bVal = b.plant_id ?? '' }
      else if (sortField === 'common_name') { aVal = a.common_name;        bVal = b.common_name }
      else if (sortField === 'category')   { aVal = a.category;           bVal = b.category }
      else                                  { aVal = a.updated_at ?? '';   bVal = b.updated_at ?? '' }
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
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

      {/* Search — client-side debounce, triggers at 4+ chars, no Enter needed */}
      <PlantSearchInput defaultValue={q} sort={sortField} dir={sortDir} />

      <p className="text-sm text-gray-500">{filtered.length} species found</p>

      {/* Species table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh label="ID"          field="plant_id"    sort={sortField} dir={sortDir} q={q} />
              <th className="px-4 py-3 font-medium text-gray-600 text-center w-8">📷</th>
              <SortTh label="Common Name" field="common_name" sort={sortField} dir={sortDir} q={q} />
              <SortTh label="Category"    field="category"    sort={sortField} dir={sortDir} q={q} />
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <SortTh label="Updated"     field="updated_at"  sort={sortField} dir={sortDir} q={q} />
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(species => (
              <SpeciesRow
                key={species.id}
                species={species}
                deleteAction={deleteAction}
                restoreAction={restoreAction}
              />
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

// ── Sortable column header ───────────────────────────────────────────────────

function SortTh({
  label, field, sort, dir, q,
}: {
  label: string; field: SortField; sort: SortField; dir: string; q: string
}) {
  const isActive = sort === field
  const nextDir  = isActive && dir === 'asc' ? 'desc' : 'asc'
  const params   = new URLSearchParams({ sort: field, dir: nextDir, ...(q ? { q } : {}) })
  return (
    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
      <a href={`?${params}`} className="inline-flex items-center gap-1 hover:text-green-700 transition-colors">
        {label}
        <span className="text-gray-400 text-[11px]">
          {isActive ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </a>
    </th>
  )
}

// ── Species row ──────────────────────────────────────────────────────────────

function SpeciesRow({
  species,
  deleteAction,
  restoreAction,
}: {
  species: PlantSpecies
  deleteAction: (f: FormData) => Promise<void>
  restoreAction: (f: FormData) => Promise<void>
}) {
  const editHref = `/plants/${species.id}/edit`
  return (
    <tr className="hover:bg-gray-50">
      {/* ID — clickable to edit */}
      <td className="px-4 py-3">
        <Link href={editHref} className="font-mono text-xs text-blue-600 hover:underline">
          {species.plant_id}
        </Link>
      </td>

      {/* Photo indicator */}
      <td className="px-4 py-3 text-center">
        {species.img_main_url
          ? <span title="Photo uploaded" className="text-green-600 text-base">●</span>
          : <span title="No photo"       className="text-gray-300 text-base">○</span>
        }
      </td>

      {/* Common name — clickable to edit */}
      <td className="px-4 py-3">
        <Link href={editHref} className="font-medium text-gray-900 hover:text-green-700 hover:underline">
          {species.common_name}
        </Link>
        {species.botanical_name && (
          <span className="block text-xs text-gray-400 italic">{species.botanical_name}</span>
        )}
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-800 border border-green-200">
          {species.category}
        </span>
      </td>

      {/* Status badges */}
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

      {/* Updated — with full datetime */}
      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        {formatDateTime(species.updated_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={editHref} className="text-blue-600 hover:underline text-xs">
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
  )
}
