// =============================================================================
// Admin — News & App Settings
//
// Two sections:
//   1. News Sources  — whitelist of domains; add, toggle, reprioritise, delete
//   2. News Settings — numeric tuneable knobs (max articles, plant tags etc.)
//
// All mutations use Server Actions (no API routes needed — admin-only, simple).
// =============================================================================

import { revalidatePath } from 'next/cache'
import {
  getNewsSources,
  getAppSettings,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  updateAppSetting,
} from '@/lib/queries'
import type { NewsSource, AppSetting } from '@/types'

export default async function SettingsPage() {
  const [sources, settings] = await Promise.all([
    getNewsSources(),
    getAppSettings(),
  ])

  // ── Server Actions ────────────────────────────────────────────────────────

  async function addSourceAction(formData: FormData) {
    'use server'
    const domain   = (formData.get('domain')   as string ?? '').trim()
    const label    = (formData.get('label')    as string ?? '').trim()
    const priority = parseInt(formData.get('priority') as string ?? '5', 10)
    if (!domain || !label) return
    try {
      await addNewsSource(domain, label, priority)
    } catch { /* silently ignore duplicate */ }
    revalidatePath('/settings')
  }

  async function toggleAction(formData: FormData) {
    'use server'
    const id      = formData.get('id')      as string
    const enabled = formData.get('enabled') === 'true'
    await updateNewsSource(id, { enabled: !enabled })
    revalidatePath('/settings')
  }

  async function setPriorityAction(formData: FormData) {
    'use server'
    const id       = formData.get('id')       as string
    const priority = parseInt(formData.get('priority') as string ?? '5', 10)
    await updateNewsSource(id, { priority })
    revalidatePath('/settings')
  }

  async function deleteSourceAction(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await deleteNewsSource(id)
    revalidatePath('/settings')
  }

  async function saveSettingAction(formData: FormData) {
    'use server'
    const key   = formData.get('key')   as string
    const value = (formData.get('value') as string ?? '').trim()
    if (!key || !value) return
    await updateAppSetting(key, value)
    revalidatePath('/settings')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const newsSettings = settings.filter(s => s.key.startsWith('news_'))

  return (
    <div className="space-y-10 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the News feed — changes take effect on the next hourly cache refresh.
        </p>
      </div>

      {/* ── Section 1: News Sources ── */}
      <section className="space-y-4">
        <div className="border-b border-gray-200 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">News Sources</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Only articles from enabled domains appear in the News feed.
            Priority 0–10 (higher = preferred when breaking ties).
          </p>
        </div>

        {/* Source list */}
        <div className="space-y-2">
          {sources.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No sources yet — add one below.</p>
          )}
          {sources.map(src => (
            <SourceRow
              key={src.id}
              source={src}
              toggleAction={toggleAction}
              setPriorityAction={setPriorityAction}
              deleteSourceAction={deleteSourceAction}
            />
          ))}
        </div>

        {/* Add source form */}
        <div className="bg-green-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-green-800">Add a source domain</p>
          <form action={addSourceAction} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                name="domain"
                required
                placeholder="e.g. thebetterindia.com"
                className="col-span-1 sm:col-span-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                name="label"
                required
                placeholder="Display name"
                className="col-span-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex gap-2">
                <input
                  name="priority"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={5}
                  placeholder="Priority"
                  className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  className="flex-1 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* ── Section 2: News Tuneable Settings ── */}
      <section className="space-y-4">
        <div className="border-b border-gray-200 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">News Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Numeric knobs for the feed algorithm. All values must be positive integers.
          </p>
        </div>

        <div className="space-y-3">
          {newsSettings.map(setting => (
            <SettingRow key={setting.key} setting={setting} saveAction={saveSettingAction} />
          ))}
          {newsSettings.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Run the Supabase migration SQL first to seed default settings.
            </p>
          )}
        </div>
      </section>

    </div>
  )
}

// ── SourceRow — one editable row in the sources table ────────────────────────
function SourceRow({
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

// ── SettingRow — one editable key-value setting ───────────────────────────────
function SettingRow({
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
