// =============================================================================
// Elan Greens Admin — API Call Logger
//
// Persists a record of every external API call to the api_logs Supabase table.
// WHY Supabase? Vercel is serverless — the filesystem is ephemeral. Every
// function invocation is a fresh container. Supabase is the only persistent
// store already in the project.
//
// USAGE:
//   const start = Date.now()
//   const res = await fetch(...)
//   await logApiCall({
//     api_name: 'google_vision',
//     endpoint: 'vision.googleapis.com',
//     status_code: res.status,
//     duration_ms: Date.now() - start,
//     success: res.ok,
//     error_msg: res.ok ? undefined : await res.text(),
//   })
//
// RULES:
//  - logApiCall() NEVER throws — logging must never crash the main request flow
//  - Always fire-and-forget (do not await in the hot path if latency matters)
//  - Keep meta small — { botanical_name, plant_id } only
// =============================================================================

import { createServiceRoleClient } from '@/lib/supabase.server'

export interface ApiLogEntry {
  api_name:    string           // 'google_vision' | 'plant_id' | 'iucn' | 'gbif' | 'inaturalist' | 'powo' | 'wikimedia'
  endpoint:    string           // hostname e.g. 'vision.googleapis.com'
  status_code: number           // HTTP status; 0 = network failure / timeout
  duration_ms: number           // wall-clock ms
  success:     boolean
  error_msg?:  string           // omit on success
  meta?:       Record<string, string | number | null>
}

/**
 * Persist one API call record to the api_logs table.
 * Fire-and-forget safe — swallows all errors so logging never crashes routes.
 */
export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  try {
    const db = createServiceRoleClient()
    await db.from('api_logs').insert({
      api_name:    entry.api_name,
      endpoint:    entry.endpoint,
      status_code: entry.status_code,
      duration_ms: entry.duration_ms,
      success:     entry.success,
      error_msg:   entry.error_msg ?? null,
      meta:        entry.meta ?? null,
    })
  } catch (err) {
    // Never let logging crash the main flow — just print to Vercel function logs
    console.error('[apiLogger] Failed to persist log entry:', err)
  }
}

/**
 * Convenience wrapper: times a fetch call and logs the result automatically.
 * Returns the original Response so callers can still read the body.
 *
 * @example
 *   const res = await timedFetch('google_vision', 'vision.googleapis.com', () =>
 *     fetch(`https://vision.googleapis.com/...`, { method: 'POST', ... })
 *   )
 */
export async function timedFetch(
  api_name: string,
  endpoint: string,
  fetchFn: () => Promise<Response>,
  meta?: Record<string, string | number | null>,
): Promise<Response> {
  const start = Date.now()
  let res: Response
  try {
    res = await fetchFn()
  } catch (err) {
    const duration_ms = Date.now() - start
    await logApiCall({
      api_name,
      endpoint,
      status_code: 0,
      duration_ms,
      success: false,
      error_msg: err instanceof Error ? err.message : String(err),
      meta,
    })
    throw err  // re-throw so the route can return its own error response
  }

  const duration_ms = Date.now() - start
  let error_msg: string | undefined
  if (!res.ok) {
    // Clone so caller can still read body — we consume one read here for the log
    try { error_msg = await res.clone().text() } catch { /* ignore */ }
  }

  await logApiCall({
    api_name,
    endpoint,
    status_code: res.status,
    duration_ms,
    success: res.ok,
    error_msg,
    meta,
  })

  return res
}
