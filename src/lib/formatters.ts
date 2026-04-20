// =============================================================================
// Elan Greens Admin — Formatting Utilities
//
// All display-layer transformations live here. No business logic — just
// converting raw DB values into human-readable strings.
// =============================================================================

import { formatDistanceStrict, parseISO, differenceInMonths } from 'date-fns'

// ── formatTenure ─────────────────────────────────────────────────────────────
// Converts a date string to "X yrs Y months with us".
// Used for staff cards.  Returns null if no date provided.
export function formatTenure(dateOfJoining: string | null): string | null {
  if (!dateOfJoining) return null
  const joined = parseISO(dateOfJoining)
  const now = new Date()
  const totalMonths = differenceInMonths(now, joined)
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''} with us`
  if (months === 0) return `${years} yr${years !== 1 ? 's' : ''} with us`
  return `${years} yr${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} with us`
}

// ── formatPlantAge ────────────────────────────────────────────────────────────
// Converts a plantation date to "Age: X yrs Y months".
// Used in the location list on the instance form.
export function formatPlantAge(dateOfPlantation: string | null): string | null {
  if (!dateOfPlantation) return null
  const planted = parseISO(dateOfPlantation)
  const now = new Date()
  const totalMonths = differenceInMonths(now, planted)
  if (totalMonths < 1) return 'Less than 1 month old'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''} old`
  if (months === 0) return `${years} yr${years !== 1 ? 's' : ''} old`
  return `${years} yr${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} old`
}

// ── formatBytes ───────────────────────────────────────────────────────────────
// Converts raw byte count to "12.4 MB" style string.
// Used in the storage meter component.
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// ── formatStoragePercent ──────────────────────────────────────────────────────
// Returns storage used as a percentage of the 1 GB free limit.
export function formatStoragePercent(usedBytes: number): number {
  const onGigabyte = 1024 * 1024 * 1024
  return Math.min(100, (usedBytes / onGigabyte) * 100)
}

// ── formatDate ────────────────────────────────────────────────────────────────
// Converts ISO date string to "20 Apr 2026" for display in tables.
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── splitPipe ─────────────────────────────────────────────────────────────────
// Splits a pipe-separated DB field into an array and removes empty entries.
// Used for medicinal_properties and not_applicable_parts.
export function splitPipe(value: string | null): string[] {
  if (!value) return []
  return value.split('|').map(s => s.trim()).filter(Boolean)
}
