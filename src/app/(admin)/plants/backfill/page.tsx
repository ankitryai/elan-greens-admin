'use client'
import { useState } from 'react'

export default function BackfillPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setStatus('Running… this may take 1–2 minutes for many plants.')
    try {
      const res = await fetch('/api/backfill-tags', { method: 'POST' })
      const data = await res.json() as { processed: number; failed: number; total: number; message?: string; error?: string }
      if (data.error) setStatus(`Error: ${data.error}`)
      else if (data.message) setStatus(data.message)
      else setStatus(`Done! Tagged ${data.processed} plants. ${data.failed > 0 ? `${data.failed} failed.` : ''}`)
    } catch (e) {
      setStatus(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Compute Search Tags</h1>
      <p className="text-sm text-gray-600">
        Calls Google Vision (LABEL_DETECTION + IMAGE_PROPERTIES) for every plant that has a main photo
        but no search tags yet. Uses your free 1,000/month Vision quota. Safe to re-run — skips plants
        that already have tags.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: '#2E7D32' }}
      >
        {running ? '⏳ Processing…' : '🏷 Run Backfill'}
      </button>
      {status && (
        <p className={`text-sm rounded-lg px-3 py-2 ${status.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {status}
        </p>
      )}
      <a href="/plants" className="block text-sm text-blue-600 hover:underline">← Back to Plants</a>
    </div>
  )
}
