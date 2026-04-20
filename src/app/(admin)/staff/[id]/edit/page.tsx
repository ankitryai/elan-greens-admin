// Server Component — fetches staff member, passes to client form.

import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase.server'
import type { StaffMember } from '@/types'
import EditStaffForm from './EditStaffForm'

async function getStaffById(id: string): Promise<StaffMember | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from('staff_data')
    .select('*')
    .eq('id', id)
    .single()
  return data as StaffMember | null
}

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = await getStaffById(id).catch(() => null)
  if (!member) notFound()

  return <EditStaffForm member={member} />
}
