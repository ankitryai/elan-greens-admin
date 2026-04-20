// =============================================================================
// Elan Greens Admin — Supabase Storage Usage Route Handler
//
// Returns total bytes used across both storage buckets (plant-images and
// staff-photos). Displayed in the StorageMeter component during image upload.
//
// WHY a Route Handler? The Supabase Storage management API (list files, get sizes)
// requires the service-role key. This must stay server-side.
// =============================================================================

import { createServiceRoleClient } from '@/lib/supabase'
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()

  // List all files in both buckets and sum their sizes.
  // Supabase Storage list() returns file metadata including size in bytes.
  async function getBucketSize(bucket: string): Promise<number> {
    const { data, error } = await db.storage.from(bucket).list('', {
      limit: 1000,  // max files per call; sufficient for v1
    })
    if (error || !data) return 0
    return data.reduce((sum, file) => sum + (file.metadata?.size ?? 0), 0)
  }

  const [plantSize, staffSize] = await Promise.all([
    getBucketSize('plant-images'),
    getBucketSize('staff-photos'),
  ])

  return NextResponse.json({ usedBytes: plantSize + staffSize })
}
