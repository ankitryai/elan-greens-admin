// =============================================================================
// Elan Greens Admin — Wikimedia Commons Auto-Image Fetch Route Handler
//
// After Plant.id identifies the botanical name, this handler searches
// Wikimedia Commons for up to 2 images in each of 5 categories:
// flowers, fruits, leaves, bark, roots.
//
// WHY Wikimedia Commons?
//   - Free, no API key, no rate limits (reasonable use)
//   - All images are CC-licensed with attribution built into the API response
//   - Excellent coverage of common tropical and ornamental plants
//
// The client receives { flowers: [...], fruits: [...], ... } and shows a
// preview grid. The admin approves or swaps before saving.
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase.server'
import { NextResponse, type NextRequest } from 'next/server'
import type { WikimediaImage } from '@/types'

// Image categories to search. Each maps to a DB column pair (url + attr).
const CATEGORIES: Record<string, string[]> = {
  flowers: ['flower', 'flowers', 'blossom'],
  fruits:  ['fruit', 'fruits', 'seed'],
  leaves:  ['leaf', 'leaves', 'foliage'],
  bark:    ['bark', 'stem', 'trunk'],
  roots:   ['root', 'roots'],
}

// Fetch up to 2 suitable images from Wikimedia for one category.
async function fetchCategoryImages(
  botanicalName: string,
  keywords: string[]
): Promise<WikimediaImage[]> {
  const results: WikimediaImage[] = []

  for (const keyword of keywords) {
    if (results.length >= 2) break

    const query = encodeURIComponent(`${botanicalName} ${keyword}`)
    const url =
      `https://commons.wikimedia.org/w/api.php` +
      `?action=query&list=search&srsearch=${query}&srnamespace=6` +
      `&srlimit=8&format=json&origin=*`

    const res = await fetch(url)
    if (!res.ok) continue

    const data = await res.json() as {
      query?: { search?: { title: string }[] }
    }
    const titles = data.query?.search?.map(r => r.title) ?? []

    for (const title of titles) {
      if (results.length >= 2) break
      const imageInfo = await fetchImageInfo(title)
      if (imageInfo) results.push(imageInfo)
    }
  }

  return results
}

// Wikimedia media types we accept — everything else (PDF, audio, video, etc.) is skipped.
const ACCEPTED_MEDIA_TYPES = new Set(['BITMAP', 'DRAWING'])

// Image extensions as a final safety net in case mediatype is missing.
const IMAGE_EXT = /\.(jpe?g|png|gif|svg|webp|tiff?)(\?|$)/i

// Get the direct image URL and attribution for one Wikimedia file title.
// Requests a 600 px wide thumbnail so we store web-friendly URLs, not
// multi-megabyte originals.
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

  // Skip non-image files (PDFs, audio, video, old book scans, etc.)
  const mediaType = info.mediatype ?? ''
  if (!ACCEPTED_MEDIA_TYPES.has(mediaType)) return null

  // Secondary check: URL must look like an image
  const displayUrl = info.thumburl ?? info.url
  if (!IMAGE_EXT.test(displayUrl)) return null

  // Build attribution string from metadata when available.
  const artist = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? 'Unknown'
  const license = info.extmetadata?.LicenseShortName?.value ?? 'CC license'
  const attribution = `© ${artist}, ${license}, via Wikimedia Commons`

  return { url: displayUrl, attribution, title }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botanicalName = request.nextUrl.searchParams.get('name')
  if (!botanicalName) {
    return NextResponse.json({ error: 'Botanical name required' }, { status: 400 })
  }

  // Run all 5 category searches in parallel — avoids a waterfall of 5 sequential fetches.
  const [flowers, fruits, leaves, bark, roots] = await Promise.all([
    fetchCategoryImages(botanicalName, CATEGORIES.flowers),
    fetchCategoryImages(botanicalName, CATEGORIES.fruits),
    fetchCategoryImages(botanicalName, CATEGORIES.leaves),
    fetchCategoryImages(botanicalName, CATEGORIES.bark),
    fetchCategoryImages(botanicalName, CATEGORIES.roots),
  ])

  return NextResponse.json({ flowers, fruits, leaves, bark, roots })
}
