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
import { ErrorBanner } from '@/components/ErrorBanner'

function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 400
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX }
        else        { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to decode image')) }
    img.src = objectUrl
  })
}

const ROLES = ['Head Gardener', 'Assistant Gardener', 'Maintenance Staff'] as const

export default function AddStaffPage() {
  const router = useRouter()
  const [saving, setSaving]                 = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [photoBase64, setPhotoBase64]       = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [serverError, setServerError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
  })

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoProcessing(true)
    setPhotoBase64(null)
    try {
      const b64 = await compressToBase64(file)
      setPhotoBase64(b64)
      setPreviewUrl(b64)
      toast.success(`Photo ready (${Math.round(b64.length * 0.75 / 1024)} KB) — click Save to upload`)
    } catch (err) {
      toast.error(`Could not process photo: ${err instanceof Error ? err.message : 'Try a different image'}`)
    } finally {
      setPhotoProcessing(false)
    }
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
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.'
      setServerError(msg)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {serverError && (
        <ErrorBanner message={serverError} onClose={() => setServerError(null)} />
      )}

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
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={photoProcessing} onClick={() => fileRef.current?.click()}>
              {photoProcessing ? 'Processing…' : `📷 ${previewUrl ? 'Replace photo' : 'Add photo'}`}
            </Button>
            {photoBase64 && (
              <span className="text-xs text-green-700 font-medium">✓ Photo ready to upload</span>
            )}
          </div>
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
          <Button type="submit" disabled={saving || photoProcessing} style={{ backgroundColor: '#2E7D32', color: 'white' }}>
            {saving ? 'Saving…' : photoProcessing ? 'Processing photo…' : 'Add Member'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
