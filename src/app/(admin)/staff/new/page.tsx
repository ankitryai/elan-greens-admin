'use client'
// Add Staff Member page.
// WHY client component? Photo upload needs FileReader (browser API).

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { staffSchema, type StaffFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import compress from 'browser-image-compression'

const ROLES = ['Head Gardener', 'Assistant Gardener', 'Maintenance Staff'] as const

export default function AddStaffPage() {
  const router = useRouter()
  const [saving, setSaving]           = useState(false)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
  })

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compress(file, { maxWidthOrHeight: 400, useWebWorker: true, initialQuality: 0.8 })
    const reader = new FileReader()
    reader.onloadend = () => {
      const b64 = reader.result as string
      setPhotoBase64(b64)
      setPreviewUrl(b64)
    }
    reader.readAsDataURL(compressed)
  }

  async function onSubmit(data: StaffFormData) {
    setSaving(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, photoBase64 }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      toast.success(`${data.name} added to the Green Team`)
      router.push('/staff')
    } catch (err) {
      toast.error(`Could not save. ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  const tribute = watch('tribute_note') ?? ''

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <a href="/staff" className="hover:underline">Green Team</a> /
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Add Team Member</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Photo */}
        <div className="space-y-2">
          <Label>Photo (optional)</Label>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className="h-24 w-24 rounded-full object-cover border" />
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" capture="environment"
            className="hidden" onChange={handlePhoto} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            📷 {previewUrl ? 'Replace photo' : 'Add photo'}
          </Button>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input {...register('name')} placeholder="e.g. Raju Kumar" />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Role */}
        <div className="space-y-1">
          <Label>Role *</Label>
          <Select onValueChange={v => setValue('role', v as StaffFormData['role'])}>
            <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
        </div>

        {/* Date of joining */}
        <div className="space-y-1">
          <Label>Date of Joining (optional)</Label>
          <Input {...register('date_of_joining')} type="date" />
        </div>

        {/* Speciality */}
        <div className="space-y-1">
          <Label>Speciality (optional)</Label>
          <Input {...register('speciality')} placeholder="e.g. Topiary, Rose cultivation" />
          {errors.speciality && <p className="text-xs text-red-500">{errors.speciality.message}</p>}
        </div>

        {/* Tribute note */}
        <div className="space-y-1">
          <Label>Tribute Note (optional)</Label>
          <Textarea {...register('tribute_note')} rows={3}
            placeholder="A short appreciation message shown on the public app." />
          <p className={`text-xs text-right ${tribute.length > 300 ? 'text-red-500' : 'text-gray-400'}`}>
            {tribute.length} / 300
          </p>
          {errors.tribute_note && <p className="text-xs text-red-500">{errors.tribute_note.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} style={{ backgroundColor: '#2E7D32', color: 'white' }}>
            {saving ? 'Saving…' : 'Add Member'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
