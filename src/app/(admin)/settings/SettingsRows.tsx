'use client'
// =============================================================================
// Settings Row Components — Client Components
//
// WHY 'use client'? These rows contain onClick handlers (confirm dialogs on
// delete buttons). In Next.js, event handlers on components require 'use client'.
// Server Actions (toggleAction, deleteSourceAction, etc.) are passed as props
// from the parent Server Component — this is the documented Next.js pattern;
// Server Actions are serialised as action references, not plain functions.
// =============================================================================

import type { NewsSource, AppSetting, NewsTopicQuery } from '@/types'

// ── SourceRow ─────────────────────────────────────────────────────────────────
export function SourceRow({
  source,
  toggleAction,
  setPriorityAction,
  deleteSourceAction,
}: {
  source: NewsSource
  toggleAction: (fd: FormData) => Promise<void>
  setPriorityAction: (fd: FormData) => Promise<void>
  deleteSourceAction: (fd: FormData) => Promise<void>
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        source.enabled
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
    >
      {/* Enabled toggle */}
      <form action={toggleAction}>
        <input type="hidden" name="id"      value={source.id} />
        <input type="hidden" name="enabled" value={String(source.enabled)} />
        <button
          type="submit"
          title={source.enabled ? 'Disable this source' : 'Enable this source'}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
            source.enabled ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              source.enabled ? 'translate-x-4 left-0.5' : 'translate-x-0 left-0.5'
            }`}
          />
        </button>
      </form>

      {/* Domain + label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{source.label}</p>
        <p className="text-xs text-gray-400 truncate font-mono">{source.domain}</p>
      </div>

      {/* Priority spinner */}
      <form action={setPriorityAction} className="flex items-center gap-1 shrink-0">
        <input type="hidden" name="id" value={source.id} />
        <label className="text-xs text-gray-400 sr-only">Priority</label>
        <input
          name="priority"
          type="number"
          min={0}
          max={10}
          defaultValue={source.priority}
          className="w-14 text-center px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="submit"
          className="text-xs text-green-700 hover:text-green-900 px-1 py-1 transition-colors"
          title="Save priority"
        >
          ✓
        </button>
      </form>

      {/* Delete */}
      <form action={deleteSourceAction}>
        <input type="hidden" name="id" value={source.id} />
        <button
          type="submit"
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
          title="Remove this source"
          onClick={e => {
            if (!confirm(`Remove "${source.label}" from the whitelist?`)) e.preventDefault()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

// ── TopicQueryRow ─────────────────────────────────────────────────────────────
export function TopicQueryRow({
  query,
  toggleAction,
  setPriorityAction,
  deleteAction,
}: {
  query: NewsTopicQuery
  toggleAction: (fd: FormData) => Promise<void>
  setPriorityAction: (fd: FormData) => Promise<void>
  deleteAction: (fd: FormData) => Promise<void>
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        query.enabled
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
    >
      {/* Enabled toggle */}
      <form action={toggleAction}>
        <input type="hidden" name="id"      value={query.id} />
        <input type="hidden" name="enabled" value={String(query.enabled)} />
        <button
          type="submit"
          title={query.enabled ? 'Disable this query' : 'Enable this query'}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
            query.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              query.enabled ? 'translate-x-4 left-0.5' : 'translate-x-0 left-0.5'
            }`}
          />
        </button>
      </form>

      {/* Chip icon */}
      <span className="text-lg shrink-0" aria-hidden>{query.chip_icon}</span>

      {/* Query text + chip label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate font-mono">{query.query_text}</p>
        <p className="text-xs text-gray-400 truncate">chip: {query.chip_label}</p>
      </div>

      {/* Priority spinner */}
      <form action={setPriorityAction} className="flex items-center gap-1 shrink-0">
        <input type="hidden" name="id" value={query.id} />
        <input
          name="priority"
          type="number"
          min={0}
          max={10}
          defaultValue={query.priority}
          className="w-14 text-center px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="text-xs text-blue-700 hover:text-blue-900 px-1 py-1 transition-colors"
          title="Save priority"
        >
          ✓
        </button>
      </form>

      {/* Delete */}
      <form action={deleteAction}>
        <input type="hidden" name="id" value={query.id} />
        <button
          type="submit"
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
          title="Remove this query"
          onClick={e => {
            if (!confirm(`Remove query "${query.query_text}"?`)) e.preventDefault()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

// ── SettingRow ────────────────────────────────────────────────────────────────
export function SettingRow({
  setting,
  saveAction,
}: {
  setting: AppSetting
  saveAction: (fd: FormData) => Promise<void>
}) {
  const friendlyKey = setting.key
    .replace(/^news_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <form action={saveAction} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
      <input type="hidden" name="key" value={setting.key} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{friendlyKey}</p>
        {setting.description && (
          <p className="text-xs text-gray-400 mt-0.5">{setting.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          name="value"
          type="number"
          min={1}
          max={100}
          defaultValue={setting.value}
          className="w-20 text-center px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          className="bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
        >
          Save
        </button>
      </div>
    </form>
  )
}
