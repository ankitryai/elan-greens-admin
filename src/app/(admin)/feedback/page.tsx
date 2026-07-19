import { createServerSupabaseClient } from '@/lib/supabase.server'

export const dynamic = 'force-dynamic'

type FeedbackRow = {
  id: string
  created_at: string
  property_id: string
  topic: string
  subtopic: string
  reference_name: string | null
  details: string
  contact_email: string | null
  status: string
}

const TOPIC_LABELS: Record<string, string> = {
  species_correction: '🌿 Plant correction',
  missing_species:    '➕ Missing plant',
  location_fix:       '📍 Location issue',
  landmark_issue:     '🏛️ Landmark note',
  general:            '💡 General',
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  unread:    { bg: '#FEF3C7', text: '#92400E' },
  actioned:  { bg: '#D1FAE5', text: '#065F46' },
  dismissed: { bg: '#F3F4F6', text: '#6B7280' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

async function updateStatus(id: string, status: string) {
  'use server'
  const { createServerSupabaseClient } = await import('@/lib/supabase.server')
  const supabase = await createServerSupabaseClient()
  await supabase.from('feedback').update({ status }).eq('id', id)
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; topic?: string }>
}) {
  const { status: filterStatus, topic: filterTopic } = await searchParams
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('feedback')
    .select('id, created_at, property_id, topic, subtopic, reference_name, details, contact_email, status')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus)
  if (filterTopic  && filterTopic  !== 'all') query = query.eq('topic',  filterTopic)

  const { data: rows, error } = await query
  const feedback = (rows ?? []) as FeedbackRow[]

  const unreadCount = feedback.filter(f => f.status === 'unread').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Community submissions from the Elan Greens app
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <form className="flex gap-2">
            <select
              name="status"
              defaultValue={filterStatus ?? 'all'}
              onChange={e => {
                const url = new URL(window.location.href)
                url.searchParams.set('status', e.target.value)
                window.location.href = url.toString()
              }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="unread">Unread</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select
              name="topic"
              defaultValue={filterTopic ?? 'all'}
              onChange={e => {
                const url = new URL(window.location.href)
                url.searchParams.set('topic', e.target.value)
                window.location.href = url.toString()
              }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
            >
              <option value="all">All types</option>
              {Object.entries(TOPIC_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Error loading feedback: {error.message}
        </div>
      )}

      {feedback.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No feedback yet{(filterStatus || filterTopic) ? ' matching these filters' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map(row => {
            const statusStyle = STATUS_STYLES[row.status] ?? STATUS_STYLES.unread
            const topicLabel  = TOPIC_LABELS[row.topic] ?? row.topic
            return (
              <div
                key={row.id}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3"
              >
                {/* Top row: topic badge + status + date */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{topicLabel}</span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-600">{row.subtopic}</span>
                    </div>
                    {row.reference_name && (
                      <p className="text-xs text-gray-500">
                        Re: <span className="font-medium text-gray-700">{row.reference_name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: statusStyle.bg, color: statusStyle.text }}
                    >
                      {row.status}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatDate(row.created_at)}</span>
                  </div>
                </div>

                {/* Details */}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{row.details}</p>

                {/* Contact */}
                {row.contact_email && (
                  <p className="text-xs text-gray-500">
                    Contact: <a href={`mailto:${row.contact_email}`} className="text-green-700 underline">{row.contact_email}</a>
                  </p>
                )}

                {/* Status actions */}
                <div className="flex gap-2 pt-1 border-t border-gray-50">
                  {row.status !== 'actioned' && (
                    <form action={updateStatus.bind(null, row.id, 'actioned')}>
                      <button type="submit" className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium">
                        ✓ Mark actioned
                      </button>
                    </form>
                  )}
                  {row.status !== 'dismissed' && (
                    <form action={updateStatus.bind(null, row.id, 'dismissed')}>
                      <button type="submit" className="text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors font-medium">
                        Dismiss
                      </button>
                    </form>
                  )}
                  {row.status !== 'unread' && (
                    <form action={updateStatus.bind(null, row.id, 'unread')}>
                      <button type="submit" className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                        Mark unread
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
