// =============================================================================
// Elan Greens Admin — Dashboard Page (Server Component)
//
// Shows live counts and quick-action links. Server Component so the counts
// are always fresh — no client-side fetch needed.
// =============================================================================

import Link from 'next/link'
import { getDashboardStats, getLastUpdatedTimestamp } from '@/lib/queries'
import { formatDate } from '@/lib/formatters'

export default async function DashboardPage() {
  const [stats, lastUpdated] = await Promise.all([
    getDashboardStats(),
    getLastUpdatedTimestamp(),
  ])

  const cards = [
    { label: 'Unique Species',   value: stats.speciesCount,  href: '/plants',    color: '#2E7D32' },
    { label: 'Total Plants',     value: stats.instanceCount, href: '/plants',    color: '#00796B' },
    { label: 'Green Team Staff', value: stats.staffCount,    href: '/staff',     color: '#5D4037' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {lastUpdated && (
          <p className="text-sm text-gray-500 mt-1">
            Last data update: {formatDate(lastUpdated)}
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(card => (
          <Link key={card.label} href={card.href}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-4xl font-bold mt-1" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/plants/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#2E7D32' }}
          >
            🌿 Add New Plant
          </Link>
          <Link
            href="/staff/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            👐 Add Staff Member
          </Link>
        </div>
      </div>
    </div>
  )
}
