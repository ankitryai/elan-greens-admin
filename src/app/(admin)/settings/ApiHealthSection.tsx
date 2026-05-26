// =============================================================================
// API Health Section — isolated Server Component
//
// WHY a separate file? The parent settings/page.tsx defines Server Actions with
// inline 'use server'. Mixing additional data-fetching (getApiLogStats etc.)
// directly into that file interferes with Next.js's static Server Action
// registration, causing a React serialization error on the existing onClick
// delete buttons. Isolating here keeps the two concerns fully separate.
// =============================================================================

import { getApiLogStats, getApiLogs } from '@/lib/queries'
import type { ApiLog, ApiLogStats } from '@/types'

export default async function ApiHealthSection() {
  const [apiStats, apiLogsFetched] = await Promise.all([
    getApiLogStats().catch((): ApiLogStats[] => []),
    Promise.all([
      getApiLogs('google_vision', 20).catch((): ApiLog[] => []),
      getApiLogs('plant_id',      20).catch((): ApiLog[] => []),
      getApiLogs('iucn',          20).catch((): ApiLog[] => []),
      getApiLogs('gbif',          20).catch((): ApiLog[] => []),
      getApiLogs('inaturalist',   20).catch((): ApiLog[] => []),
    ]),
  ])

  const [visionLogs, plantIdLogs, iucnLogs, gbifLogs, inatLogs] = apiLogsFetched
  const apiLogsMap: Record<string, ApiLog[]> = {
    google_vision: visionLogs,
    plant_id:      plantIdLogs,
    iucn:          iucnLogs,
    gbif:          gbifLogs,
    inaturalist:   inatLogs,
  }

  return (
    <section className="space-y-4">
      <div className="border-b border-gray-200 pb-2">
        <h2 className="text-lg font-semibold text-gray-800">API Health</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          External API calls logged over the last 30 days. P50 / P90 latency in ms.
          Logs auto-purge after 30 days.
        </p>
      </div>

      {apiStats.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No API calls logged yet — upload a plant photo to trigger the first Vision call.
        </p>
      ) : (
        <>
          {/* Summary stats table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">API</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Success</th>
                  <th className="px-4 py-3 text-right">P50</th>
                  <th className="px-4 py-3 text-right">P90</th>
                  <th className="px-4 py-3 text-right">Last called</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apiStats.map(stat => (
                  <tr key={stat.api_name} className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{stat.api_name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{stat.total_calls}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        Number(stat.success_pct) >= 90 ? 'text-green-600'
                        : Number(stat.success_pct) >= 50 ? 'text-yellow-600'
                        : 'text-red-600'
                      }`}>
                        {stat.success_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{stat.p50_ms}ms</td>
                    <td className="px-4 py-3 text-right text-gray-600">{stat.p90_ms}ms</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {stat.last_called
                        ? new Date(stat.last_called).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-API collapsible recent logs */}
          {apiStats.map(stat => {
            const logs = apiLogsMap[stat.api_name] ?? []
            if (logs.length === 0) return null
            return (
              <details key={stat.api_name} className="rounded-xl border border-gray-200 overflow-hidden">
                <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors select-none">
                  {stat.api_name} — last {logs.length} calls
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 text-left">Time</th>
                        <th className="px-4 py-2 text-right">Status</th>
                        <th className="px-4 py-2 text-right">Duration</th>
                        <th className="px-4 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map(log => (
                        <tr key={log.id} className={log.success ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-4 py-2 text-gray-500 font-mono whitespace-nowrap">
                            {new Date(log.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`font-mono font-medium ${log.success ? 'text-green-600' : 'text-red-600'}`}>
                              {log.status_code ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500 font-mono">{log.duration_ms}ms</td>
                          <td className="px-4 py-2 text-gray-400 max-w-xs truncate" title={log.error_msg ?? ''}>
                            {log.error_msg ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </>
      )}
    </section>
  )
}
