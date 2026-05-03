// =============================================================================
// Elan Greens Admin — Wikimedia + iNaturalist Image Fetch Route Handler
//
// For each of 5 plant-part categories (flowers/fruits/leaves/bark/roots):
//
//   Pass 1 — Wikimedia Commons
//     botanical+keyword → botanical alone → common+keyword
//
//   Pass 2 — iNaturalist (fallback when Wikimedia finds nothing)
//     exact species + annotation filter → genus + annotation filter
//     iNaturalist has real-world observation photos with CC attribution.
//     Annotation IDs (controlled_terms API):
//       term 12 "Flowers and Fruits": 13=Flowers, 14=Fruits or Seeds
//       term 36 "Leaves":             38=Green Leaves
//     bark/roots have no iNaturalist annotation → genus-level general search
//
// ?skip=flowers,bark skips categories with already-saved DB images (post-save).
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import type { WikimediaImage } from '@/types'

// ── Wikimedia ────────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  flowers: ['flower', 'flowers', 'blossom', 'inflorescence'],
  fruits:  ['fruit', 'fruits', 'seed', 'berry'],
  leaves:  ['leaf', 'leaves', 'foliage'],
  bark:    ['bark', 'stem', 'trunk'],
  roots:   ['root', 'roots'],
}

const ACCEPTED_MEDIA_TYPES = new Set(['BITMAP', 'DRAWING'])
const IMAGE_EXT = /\.(jpe?g|png|gif|svg|webp|tiff?)(\?|$)/i

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
      imageinfo?: [{ url: string; thumburl?: string; mediatype?: string
        extmetadata?: { Artist?: { value: string }; LicenseShortName?: { value: string } }
      }]
    }> }
  }
  const page = Object.values(data.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info?.url) return null
  if (!ACCEPTED_MEDIA_TYPES.has(info.mediatype ?? '')) return null
  const displayUrl = info.thumburl ?? info.url
  if (!IMAGE_EXT.test(displayUrl)) return null
  const artist  = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? 'Unknown'
  const license = info.extmetadata?.LicenseShortName?.value ?? 'CC license'
  return { url: displayUrl, attribution: `© ${artist}, ${license}, via Wikimedia Commons`, title }
}

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

async function fetchFromWikimedia(
  botanicalName: string, commonName: string, keywords: string[]
): Promise<{ images: WikimediaImage[]; successQuery: string }> {
  const results: WikimediaImage[] = []
  let successQuery = ''
  const queries = [
    ...keywords.map(k => `${botanicalName} ${k}`),
    botanicalName,
    ...keywords.map(k => `${commonName} ${k}`),
  ]
  for (const query of queries) {
    if (results.length >= 2) break
    const titles = await searchTitles(query)
    for (const title of titles) {
      if (results.length >= 2) break
      if (results.some(r => r.title === title)) continue
      const img = await fetchImageInfo(title)
      if (img) {
        if (!successQuery) successQuery = query
        results.push(img)
      }
    }
  }
  return { images: results, successQuery }
}

// ── iNaturalist ───────────────────────────────────────────────────────────────

// Annotation filters for plant parts.
// term_id=12 "Flowers and Fruits", term_id=36 "Leaves"
// bark/roots have no iNat annotation so we search without one.
const INAT_ANNOTATIONS: Record<string, string> = {
  flowers: '&term_id=12&term_value_id=13',
  fruits:  '&term_id=12&term_value_id=14',
  leaves:  '&term_id=36&term_value_id=38',
  bark:    '',
  roots:   '',
}

const INAT_LICENSES = 'cc-by,cc-by-sa,cc0,cc-by-nc,cc-by-nc-sa,cc-by-nd,cc-by-nc-nd'

async function fetchFromINaturalist(
  botanicalName: string,
  category: string
): Promise<{ images: WikimediaImage[]; level: 'species' | 'genus'; query: string }> {
  const annotation = INAT_ANNOTATIONS[category] ?? ''
  const results: WikimediaImage[] = []

  // Try exact species first, then fall back to genus (first word of botanical name)
  const genus   = botanicalName.split(' ')[0]
  const names   = botanicalName.includes(' ') ? [botanicalName, genus] : [botanicalName]

  let foundLevel: 'species' | 'genus' = 'species'
  let foundQuery = botanicalName

  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (results.length >= 2) break

    const url =
      `https://api.inaturalist.org/v1/observations` +
      `?taxon_name=${encodeURIComponent(name)}&photos=true&per_page=8&order_by=votes` +
      `&photo_license=${encodeURIComponent(INAT_LICENSES)}` +
      annotation

    const res = await fetch(url)
    if (!res.ok) continue

    const data = await res.json() as {
      results?: {
        taxon?: { name?: string }
        photos?: { url?: string; license_code?: string; attribution?: string }[]
      }[]
    }

    const beforeCount = results.length

    for (const obs of data.results ?? []) {
      if (results.length >= 2) break
      const photo = obs.photos?.[0]
      if (!photo?.url || !photo.license_code) continue

      // Replace square thumbnail with medium (500 px) version
      const imgUrl = photo.url
        .replace(/\/square\.(jpe?g|png)$/, '/medium.$1')
        .replace('/square.jpeg', '/medium.jpeg')
        .replace('/square.jpg',  '/medium.jpg')

      // iNaturalist attribution field already formatted: "(c) User, some rights reserved (CC BY-NC)"
      const attr = (photo.attribution ?? '')
        .replace('(c)', '©')
        .replace(', some rights reserved', '')
        .replace(', all rights reserved', '')
        .trim()

      const taxonName = obs.taxon?.name ?? botanicalName
      results.push({
        url: imgUrl,
        attribution: `${attr}, via iNaturalist`,
        title: `iNaturalist: ${taxonName}`,
      })
    }

    // Track which level produced the first results
    if (results.length > beforeCount) {
      foundLevel = i === 0 ? 'species' : 'genus'
      foundQuery = name
    }
  }

  return { images: results, level: foundLevel, query: foundQuery }
}

// ── Debug provenance ──────────────────────────────────────────────────────────

export interface FetchDebug {
  source:  'wikimedia' | 'inaturalist' | 'none'
  query:   string          // the search query / name that produced results
  level?:  'species' | 'genus'   // iNaturalist only
}

// ── Combined fetch per category ───────────────────────────────────────────────

async function fetchCategoryImages(
  botanicalName: string,
  commonName:    string,
  keywords:      string[],
  category:      string
): Promise<{ images: WikimediaImage[]; debug: FetchDebug }> {
  // Try Wikimedia first (has attribution built-in, usually higher quality)
  const { images: wikiImgs, successQuery } =
    await fetchFromWikimedia(botanicalName, commonName, keywords)
  if (wikiImgs.length > 0) {
    return {
      images: wikiImgs,
      debug:  { source: 'wikimedia', query: successQuery },
    }
  }

  // iNaturalist fallback — real-world observation photos
  const { images: inatImgs, level, query: inatQuery } =
    await fetchFromINaturalist(botanicalName, category)
  if (inatImgs.length > 0) {
    return {
      images: inatImgs,
      debug:  { source: 'inaturalist', query: inatQuery, level },
    }
  }

  return { images: [], debug: { source: 'none', query: '' } }
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

  const skip = new Set(
    (request.nextUrl.searchParams.get('skip') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  )

  const none = (label: string): { images: WikimediaImage[]; debug: FetchDebug } =>
    ({ images: [], debug: { source: 'none', query: `skipped — ${label}` } })

  const [flowers, fruits, leaves, bark, roots] = await Promise.all([
    skip.has('flowers') ? Promise.resolve(none('flowers')) : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.flowers, 'flowers'),
    skip.has('fruits')  ? Promise.resolve(none('fruits'))  : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.fruits,  'fruits'),
    skip.has('leaves')  ? Promise.resolve(none('leaves'))  : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.leaves,  'leaves'),
    skip.has('bark')    ? Promise.resolve(none('bark'))    : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.bark,    'bark'),
    skip.has('roots')   ? Promise.resolve(none('roots'))   : fetchCategoryImages(botanicalName, commonName, CATEGORY_KEYWORDS.roots,   'roots'),
  ])

  return NextResponse.json({
    flowers: flowers.images,
    fruits:  fruits.images,
    leaves:  leaves.images,
    bark:    bark.images,
    roots:   roots.images,
    _debug: {
      flowers: flowers.debug,
      fruits:  fruits.debug,
      leaves:  leaves.debug,
      bark:    bark.debug,
      roots:   roots.debug,
    },
  })
}
