'use client'
// =============================================================================
// StorageMeter — Live Supabase Storage Usage Bar
//
// Fetches storage usage from /api/storage-usage on mount and after each
// upload. Shows a coloured bar and warns when < 100 MB (10%) remains.
// =============================================================================

import { useEffect, useState } from 'react'
import { formatBytes, formatStoragePercent } from '@/lib/formatters'

const ONE_GB = 1024 * 1024 * 1024

interface StorageMeterProps {
  // Pass a revision number from the parent; incrementing it triggers a refresh.
  revision?: number
}

export default function StorageMeter({ revision = 0 }: StorageMeterProps) {
  const [usedBytes, setUsedBytes] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/storage-usage')
      .then(r => r.json())
      .then(d => setUsedBytes(d.usedBytes ?? 0))
      .catch(() => setUsedBytes(null))
  }, [revision])  // re-runs whenever revision changes (i.e. after each upload)

  if (usedBytes === null) return null

  const pct = formatStoragePercent(usedBytes)
  const isCritical = usedBytes > ONE_GB * 0.9   // > 900 MB
  const isWarning  = usedBytes > ONE_GB * 0.75  // > 750 MB

  const barColour = isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-green-600'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Storage used</span>
        <span className={isCritical ? 'text-red-600 font-medium' : ''}>
          {formatBytes(usedBytes)} of 1 GB ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-red-600">
          ⚠️ Less than 100 MB remaining. Consider removing unused images or upgrading Supabase.
        </p>
      )}
    </div>
  )
}
