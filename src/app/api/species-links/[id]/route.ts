import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceRoleClient } from '@/lib/supabase.server'
import { cookies } from 'next/headers'

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

// DELETE /api/species-links/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const db = createServiceRoleClient()
  const { error } = await db.from('plant_species_links').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
