// Staff list page — same pattern as Plants list

import Link from 'next/link'
import { getAllStaff, softDeleteStaff } from '@/lib/queries'
import { formatDate, formatTenure } from '@/lib/formatters'
import { revalidatePath } from 'next/cache'

export default async function StaffPage() {
  const staff = await getAllStaff()

  async function removeStaff(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await softDeleteStaff(id)
    revalidatePath('/staff')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Green Team</h1>
        <Link
          href="/staff/new"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#2E7D32' }}
        >
          + Add Member
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tenure</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map(member => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{member.staff_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                <td className="px-4 py-3 text-gray-600">{member.role}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatTenure(member.date_of_joining) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link href={`/staff/${member.id}/edit`} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </Link>
                    <form action={removeStaff}>
                      <input type="hidden" name="id" value={member.id} />
                      <button type="submit" className="text-red-500 hover:underline text-xs">
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <p className="text-center py-12 text-gray-400">No staff added yet.</p>
        )}
      </div>
    </div>
  )
}
