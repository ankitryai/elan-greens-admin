'use client'
// =============================================================================
// ApiCounter — Displays Plant.id and Google Vision API usage
//
// WHY show this on the upload screen?
// Plant.id has a one-time lifetime grant of 100 credits (NOT per month — they
// do NOT reset). Google Vision has a monthly free-tier limit of 1,000 calls.
// Making the count visible encourages careful usage and avoids exhausting the
// Plant.id lifetime budget.
//
// Counts are stored in localStorage because neither API provides a remaining-
// quota endpoint on the free tier. localStorage resets when the user clears
// their browser data — acceptable for a single-admin hobby app.
// =============================================================================

import { useEffect, useState } from 'react'

const PLANT_ID_LIMIT  = 100
const VISION_LIMIT    = 1000
const STORAGE_KEY_PREFIX = 'elan_api_usage_'

function getMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}_${d.getMonth() + 1}`  // e.g. "2026_4"
}

// Read or initialise usage counts for the current calendar month.
export function incrementApiCount(api: 'plantid' | 'vision') {
  const key = `${STORAGE_KEY_PREFIX}${api}_${getMonthKey()}`
  const current = parseInt(localStorage.getItem(key) ?? '0', 10)
  localStorage.setItem(key, String(current + 1))
}

export function getApiCount(api: 'plantid' | 'vision'): number {
  const key = `${STORAGE_KEY_PREFIX}${api}_${getMonthKey()}`
  return parseInt(localStorage.getItem(key) ?? '0', 10)
}

export default function ApiCounter() {
  const [plantIdCount, setPlantIdCount] = useState(0)
  const [visionCount, setVisionCount]   = useState(0)

  useEffect(() => {
    setPlantIdCount(getApiCount('plantid'))
    setVisionCount(getApiCount('vision'))
  }, [])

  function row(label: string, used: number, limit: number) {
    const remaining = limit - used
    const isLow = remaining <= limit * 0.1  // below 10% remaining
    return (
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className={isLow ? 'text-amber-600 font-medium' : 'text-gray-600'}>
          {used} / {limit} used {isLow && '⚠️'}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
      <p className="text-xs font-medium text-gray-700 mb-2">API usage</p>
      {row('Plant.id identifications (lifetime)', plantIdCount, PLANT_ID_LIMIT)}
      {row('Google Vision (monthly, fallback)',   visionCount,  VISION_LIMIT)}
    </div>
  )
}
