'use client'
// Persistent error banner — stays on screen until explicitly closed.
// Use this for server errors on admin forms instead of auto-dismissing toasts.

interface Props {
  message: string
  onClose: () => void
}

export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-4 shadow-sm">
      <span className="text-red-500 text-xl leading-none shrink-0 mt-0.5">⚠</span>
      <p className="text-sm text-red-800 leading-relaxed flex-1 font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss error"
        className="shrink-0 text-red-400 hover:text-red-700 text-2xl leading-none font-light mt-0.5 transition-colors"
      >
        ×
      </button>
    </div>
  )
}
