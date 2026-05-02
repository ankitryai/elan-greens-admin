'use client'
// Auto-filtering search input for the plants listing.
// Triggers a URL push after 400 ms debounce when ≥ 4 characters are typed,
// or clears the filter when the field is emptied.
// Preserves existing sort/dir params so the sort state survives a search.

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function PlantSearchInput({
  defaultValue,
  sort,
  dir,
}: {
  defaultValue: string
  sort: string
  dir: string
}) {
  const [value, setValue]   = useState(defaultValue)
  const router              = useRouter()
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams({ sort, dir })
      if (value.length >= 4)   params.set('q', value)
      else if (value.length === 0) { /* no q = show all */ }
      else return   // 1–3 chars: wait for more input, don't navigate
      router.push(`/plants?${params}`)
    }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, sort, dir, router])

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Type 4+ characters to filter plants…"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 pr-8"
      />
      {value.length > 0 && value.length < 4 && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {4 - value.length} more…
        </span>
      )}
      {value.length >= 4 && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
