'use client'
// Auto-filtering search input for the plants listing.
// Triggers a URL push after 400 ms debounce when ≥ 4 characters are typed,
// or clears the filter when the field is emptied.
// Preserves existing sort/dir params so the sort state survives a search.

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Minimal SpeechRecognition interface for TypeScript — not in all lib.dom.d.ts versions
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResultItem { [index: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResultItem }
interface SpeechRecognitionEvent { results: SpeechRecognitionResultList }
interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onend:   (() => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  start: () => void
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function PlantSearchInput({
  defaultValue,
  sort,
  dir,
}: {
  defaultValue: string
  sort: string
  dir: string
}) {
  const [value, setValue]     = useState(defaultValue)
  const [listening, setListening] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
  const router                = useRouter()
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHasSpeech('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  function startVoice() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'en-IN'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onstart = () => setListening(true)
    r.onend   = () => setListening(false)
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setValue(transcript)
    }
    r.start()
  }

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
      {hasSpeech && (
        <button
          type="button"
          onClick={startVoice}
          title="Voice search (Indian English)"
          className={`absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-700 transition-colors ${listening ? 'text-red-500 animate-pulse' : ''}`}
          aria-label="Voice search"
        >
          🎤
        </button>
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
