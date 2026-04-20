// POST /api/staff — creates a new staff member, optionally uploading a photo.

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { createStaff } from '@/lib/queries'
import { staffSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as Record<string, unknown>
  const { photoBase64, ...formPayload } = body

  const parsed = staffSchema.safeParse(formPayload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  let photoUrl: string | null = null
  if (photoBase64 && typeof photoBase64 === 'string') {
    const db = createServiceRoleClient()
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `${Date.now()}_${parsed.data.name.replace(/\s+/g, '_')}.jpg`
    const { data: uploadData, error: uploadError } = await db.storage
      .from('staff-photos')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })
    if (!uploadError && uploadData) {
      const { data: urlData } = db.storage.from('staff-photos').getPublicUrl(uploadData.path)
      photoUrl = urlData.publicUrl
    }
  }

  const member = await createStaff(parsed.data, photoUrl)
  return NextResponse.json(member, { status: 201 })
}
