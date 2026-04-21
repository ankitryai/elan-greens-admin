// PATCH /api/staff/[id] — updates an existing staff member.
// If a new photoBase64 is supplied the old photo is replaced in storage.

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase.server'
import { updateStaff } from '@/lib/queries'
import { staffSchema } from '@/lib/validations'
import { NextResponse, type NextRequest } from 'next/server'
import type { StaffMember } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json() as Record<string, unknown>
  const { photoBase64, ...formPayload } = body

  const parsed = staffSchema.safeParse(formPayload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const fields = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v])
  ) as Partial<StaffMember>

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
      fields.photo_url = urlData.publicUrl
    }
  }

  const member = await updateStaff(id, fields)
  return NextResponse.json(member)
}
