// =============================================================================
// Admin — News & App Settings
//
// Three sections:
//   1. News Sources      — whitelist of domains; add, toggle, reprioritise, delete
//   2. News Settings     — numeric tuneable knobs (max articles, plant tags etc.)
//   3. Topic Queries     — admin-configurable RSS search queries for community topics
//
// All mutations use Server Actions (no API routes needed — admin-only, simple).
// =============================================================================

import { revalidatePath } from 'next/cache'
import {
  getNewsSources,
  getAppSettings,
  getNewsTopicQueries,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  updateAppSetting,
  addNewsTopicQuery,
  updateNewsTopicQuery,
  deleteNewsTopicQuery,
} from '@/lib/queries'
import type { NewsSource, AppSetting, NewsTopicQuery } from '@/types'
import ApiHealthSection from './ApiHealthSection'
import { SourceRow, TopicQueryRow, SettingRow } from './SettingsRows'

export default async function SettingsPage() {
  // Each fetch is wrapped individually so one missing/broken table
  // never crashes the whole page — the affected section just shows empty.
  const [sources, settings, topicQueries] = await Promise.all([
    getNewsSources().catch((): NewsSource[] => []),
    getAppSettings().catch((): AppSetting[] => []),
    getNewsTopicQueries().catch((): NewsTopicQuery[] => []),
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

  async function addTopicQueryAction(formData: FormData) {
    'use server'
    const query_text = (formData.get('query_text') as string ?? '').trim()
    const chip_label = (formData.get('chip_label') as string ?? '').trim()
    const chip_icon  = (formData.get('chip_icon')  as string ?? '🌳').trim()
    const priority   = parseInt(formData.get('priority') as string ?? '5', 10)
    if (!query_text || !chip_label) return
    try {
      await addNewsTopicQuery(query_text, chip_label, chip_icon, priority)
    } catch { /* silently ignore */ }
    revalidatePath('/settings')
  }

  async function toggleTopicAction(formData: FormData) {
    'use server'
    const id      = formData.get('id')      as string
    const enabled = formData.get('enabled') === 'true'
    await updateNewsTopicQuery(id, { enabled: !enabled })
    revalidatePath('/settings')
  }

  async function setTopicPriorityAction(formData: FormData) {
    'use server'
    const id       = formData.get('id')       as string
    const priority = parseInt(formData.get('priority') as string ?? '5', 10)
    await updateNewsTopicQuery(id, { priority })
    revalidatePath('/settings')
  }

  async function deleteTopicQueryAction(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await deleteNewsTopicQuery(id)
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

      {/* ── Section 3: Topic Queries ── */}
      <section className="space-y-4">
        <div className="border-b border-gray-200 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">Topic Queries</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Community / landscaping search terms for the News feed. When an article matches
            a query but no garden plant, the chip label is shown instead.
            Priority 0–10 (higher = runs first).
          </p>
        </div>

        <div className="space-y-2">
          {topicQueries.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">
              No topic queries yet — run <code className="bg-gray-100 px-1 rounded text-xs">supabase-news-update-2.sql</code> to seed defaults, or add one below.
            </p>
          )}
          {topicQueries.map(tq => (
            <TopicQueryRow
              key={tq.id}
              query={tq}
              toggleAction={toggleTopicAction}
              setPriorityAction={setTopicPriorityAction}
              deleteAction={deleteTopicQueryAction}
            />
          ))}
        </div>

        {/* Add topic query form */}
        <div className="bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">Add a topic query</p>
          <form action={addTopicQueryAction} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                name="query_text"
                required
                placeholder='Search query, e.g. "Bengaluru landscaping"'
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                name="chip_label"
                required
                placeholder="Chip label, e.g. Green Bengaluru"
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <input
                  name="chip_icon"
                  placeholder="Icon, e.g. 🌳"
                  defaultValue="🌳"
                  maxLength={4}
                  className="w-20 text-center px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  name="priority"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={5}
                  placeholder="Pri"
                  className="w-16 text-center px-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="flex-1 bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* ── Section 4: API Health — rendered by isolated Server Component ── */}
      <ApiHealthSection />

    </div>
  )
}

// SourceRow, TopicQueryRow, SettingRow moved to SettingsRows.tsx ('use client')
// — they contain onClick handlers which require Client Component context.
