'use client'
// Admin-wide error boundary — catches runtime JS errors in any (admin) page
// and shows a clear recovery UI instead of the browser's blank "page couldn't load" screen.

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console so it appears in Vercel function logs
    console.error('[AdminError boundary]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-base font-semibold text-red-800">Something went wrong</h2>
        </div>

        <p className="text-sm text-red-700">
          {error?.message || 'An unexpected error occurred loading this page.'}
        </p>

        {error?.digest && (
          <p className="text-xs text-red-500 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={reset}
            className="text-sm px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            Try again
          </button>
          <a
            href="/plants"
            className="text-sm px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            Back to Plants
          </a>
        </div>
      </div>
    </div>
  )
}
