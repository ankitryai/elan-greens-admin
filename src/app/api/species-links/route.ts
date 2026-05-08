import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceRoleClient } from '@/lib/supabase.server'
import { cookies } from 'next/headers'

const LINK_LABELS = ['Same genus', 'Variety / Cultivar', 'Same family', 'Related species'] as const

async function getAuthUser() {
  const cookieStore = await cookies()
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await db.auth.getUser()
  return user
}

// GET /api/species-links?species_id=<uuid>
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const speciesId = req.nextUrl.searchParams.get('species_id')
  if (!speciesId) return NextResponse.json({ error: 'species_id required' }, { status: 400 })

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species_links')
    .select('id, species_a_id, species_b_id, link_label')
    .or(`species_a_id.eq.${speciesId},species_b_id.eq.${speciesId}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) return NextResponse.json([])

  const otherIds = data.map(row =>
    row.species_a_id === speciesId ? row.species_b_id : row.species_a_id
  )
  const { data: others } = await db
    .from('plant_species')
    .select('id, common_name, botanical_name, category, img_main_url')
    .in('id', otherIds)

  const othersMap = new Map((others ?? []).map(s => [s.id, s]))
  const result = data.map(row => {
    const otherId = row.species_a_id === speciesId ? row.species_b_id : row.species_a_id
    const other   = othersMap.get(otherId)
    return {
      link_id:        row.id,
      link_label:     row.link_label,
      species_id:     otherId,
      common_name:    other?.common_name    ?? 'Unknown',
      botanical_name: other?.botanical_name ?? null,
      category:       other?.category       ?? '',
      img_main_url:   other?.img_main_url   ?? null,
    }
  })

  return NextResponse.json(result)
}

// POST /api/species-links  body: { species_a_id, species_b_id, link_label }
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { species_a_id, species_b_id, link_label } = body

  if (!species_a_id || !species_b_id)
    return NextResponse.json({ error: 'species_a_id and species_b_id required' }, { status: 400 })
  if (species_a_id === species_b_id)
    return NextResponse.json({ error: 'Cannot link a species to itself' }, { status: 400 })
  if (!(LINK_LABELS as readonly string[]).includes(link_label))
    return NextResponse.json({ error: 'Invalid link_label' }, { status: 400 })

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('plant_species_links')
    .insert({ species_a_id, species_b_id, link_label })
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'These species are already linked' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
