// =============================================================================
// Elan Greens Admin — Wikimedia Commons Auto-Image Fetch Route Handler
//
// Searches Wikimedia Commons for up to 2 images in each of 5 categories:
// flowers, fruits, leaves, bark, roots.
//
// Search strategy (per category, in order until 2 images found):
//   1. botanicalName + keyword
//   2. botanicalName alone  (catches pages titled exactly after the species)
//   3. commonName + keyword (fallback — many plants have better Common coverage)
//
// ?skip=flowers,bark  is supported so callers can avoid re-fetching categories
// that already have saved images. The frontend only sends this after a save.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import type { WikimediaImage } from '@/types'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  flowers: ['flower', 'flowers', 'blossom', 'inflorescence'],
  fruits:  ['fruit', 'fruits', 'seed', 'berry'],
  leaves:  ['leaf', 'leaves', 'foliage'],
  bark:    ['bark', 'stem', 'trunk'],
  roots:   ['root', 'roots'],
}

// Wikimedia media types we accept.
const ACCEPTED_MEDIA_TYPES = new Set(['BITMAP', 'DRAWING'])
const IMAGE_EXT = /\.(jpe?g|png|gif|svg|webp|tiff?)(\?|$)/i

// ── fetchImageInfo ────────────────────────────────────────────────────────────
// Fetches image URL + attribution for a single Wikimedia file title.
// Requests a 600px thumbnail — no multi-megabyte originals.
async function fetchImageInfo(title: string): Promise<WikimediaImage | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|mediatype&iiurlwidth=600` +
    `&format=json&origin=*`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as {
    query?: { pages?: Record<string, {
      imageinfo?: [{
        url: string
        thumburl?: string
        mediatype?: string
        extmetadata?: {
          Artist?: { value: string }
          LicenseShortName?: { value: string }
        }
      }]
    }> }
  }

  const page = Object.values(data.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info?.url) return null

  // Reject non-image files (PDFs, audio, old book scans, etc.)
  if (!ACCEPTED_MEDIA_TYPES.has(info.mediatype ?? '')) return null
  const displayUrl = info.thumburl ?? info.url
  if (!IMAGE_EXT.test(displayUrl)) return null

  const artist  = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? 'Unknown'
  const license = info.extmetadata?.LicenseShortName?.value ?? 'CC license'

  return { url: displayUrl, attribution: `© ${artist}, ${license}, via Wikimedia Commons`, title }
}

// ── searchTitles ─────────────────────────────────────────────────────────────
// Returns up to `limit` file titles matching a free-text query.
async function searchTitles(query: string, limit = 8): Promise<string[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srnamespace=6&srlimit=${limit}&format=json&origin=*`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { query?: { search?: { title: string }[] } }
  return data.query?.search?.map(r => r.title) ?? []
}

// ── fetchCategoryImages ───────────────────────────────────────────────────────
// Tries multiple search queries in order of quality until 2 real images found.
async function fetchCategoryImages(
  botanicalName: string,
  commonName: string,
  keywords: string[]
): Promise<WikimediaImage[]> {
  const results: WikimediaImage[] = []

  // Build an ordered list of search queries to try:
  //   1. botanical + each keyword
  //   2. botanical name alone (catches direct species pages)
  //   3. common name + each keyword (fallback — often better coverage)
  const queries: string[] = [
    ...keywords.map(k => `${botanicalName} ${k}`),
    botanicalName,
    ...keywords.map(k => `${commonName} ${k}`),
  ]

  for (const query of queries) {
    if (results.length >= 2) break
    const titles = await searchTitles(query)
    for (const title of titles) {
      if (results.length >= 2) break
      // Avoid duplicates from overlapping queries
      const already = results.some(r => r.title === title)
      if (already) continue
      const imageInfo = await fetchImageInfo(title)
      if (imageInfo) results.push(imageInfo)
    }
  }

  return results
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botanicalName = request.nextUrl.searchParams.get('name')?.trim() ?? ''
  const commonName    = request.nextUrl.searchParams.get('common')?.trim() ?? botanicalName

  if (!botanicalName && !commonName) {
    return NextResponse.json({ error: 'At least one of name or common is required' }, { status: 400 })
  }

  // ?skip=flowers,bark — only honoured post-save (sent by frontend when DB images exist).
  const skip = new Set(
    (request.nextUrl.searchParams.get('skip') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  )

  const [flowers, fruits, leaves, bark, roots] = await Promise.all([
    skip.has('flowers') ? Promise.resolve([]) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.flowers),
    skip.has('fruits')  ? Promise.resolve([]) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.fruits),
    skip.has('leaves')  ? Promise.resolve([]) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.leaves),
    skip.has('bark')    ? Promise.resolve([]) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.bark),
    skip.has('roots')   ? Promise.resolve([]) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.roots),
  ])

  return NextResponse.json({ flowers, fruits, leaves, bark, roots })
}
