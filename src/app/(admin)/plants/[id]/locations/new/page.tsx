'use client'
// =============================================================================
// Add Location Page — Adds a new plant_instance for an existing species.
//
// WHY client component? We use the browser's geolocation API as one of the
// three GPS fallback steps (EXIF → browser → manual).
// EXIF parsing uses the `exifr` library to read GPS from photo metadata.
// =============================================================================

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { plantInstanceSchema, type PlantInstanceFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { use } from 'react'

export default function AddLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: speciesId } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PlantInstanceFormData>({
    resolver: zodResolver(plantInstanceSchema),
  })

  // ── Step 1: Try reading GPS from photo EXIF ────────────────────────────────
  async function handlePhotoForGPS(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setGpsStatus('Reading GPS from photo…')
    try {
      // Dynamic import keeps exifr out of the initial bundle (it's only needed here)
      const exifr = await import('exifr')
      const gps = await exifr.gps(file)

      if (gps?.latitude && gps?.longitude) {
        setValue('lat', gps.latitude)
        setValue('lng', gps.longitude)
        setGpsStatus(`📍 Location captured from photo: ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`)
        return
      }
    } catch { /* EXIF read failed — fall through */ }

    // ── Step 2: Fall back to browser geolocation ───────────────────────────
    setGpsStatus('No GPS in photo. Trying your current location…')
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported. Enter lat/lng manually.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('lat', pos.coords.latitude)
        setValue('lng', pos.coords.longitude)
        setGpsStatus(`📍 Location from your device: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
      },
      () => {
        // ── Step 3: Manual entry ──────────────────────────────────────────
        setGpsStatus('Could not get location. Enter lat/lng manually below.')
      }
    )
  }

  async function onSubmit(data: PlantInstanceFormData) {
    setSaving(true)
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, species_id: speciesId }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      toast.success('New location added successfully')
      router.push(`/plants/${speciesId}/locations`)
    } catch (err) {
      toast.error(`Could not add location. ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Location</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record where this plant grows in the society.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Photo for GPS extraction */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Take / upload a photo to capture GPS location
          </Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            onChange={handlePhotoForGPS}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            📷 Use photo for location
          </Button>
          {gpsStatus && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
              {gpsStatus}
            </p>
          )}
        </div>

        {/* Location description */}
        <div className="space-y-1">
          <Label>Location Description</Label>
          <Input
            {...register('custom_location_desc')}
            placeholder="e.g. Behind Block E, Near STP, At Amphitheatre"
            maxLength={100}
          />
          <p className="text-xs text-gray-400">Max 100 characters</p>
          {errors.custom_location_desc && (
            <p className="text-xs text-red-500">{errors.custom_location_desc.message}</p>
          )}
        </div>

        {/* GPS coordinates (auto-filled or manual) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Latitude</Label>
            <Input {...register('lat')} placeholder="12.9182" type="number" step="any" />
            {errors.lat && <p className="text-xs text-red-500">{String(errors.lat.message)}</p>}
          </div>
          <div className="space-y-1">
            <Label>Longitude</Label>
            <Input {...register('lng')} placeholder="77.6735" type="number" step="any" />
            {errors.lng && <p className="text-xs text-red-500">{String(errors.lng.message)}</p>}
          </div>
        </div>

        {/* Society tree number */}
        <div className="space-y-1">
          <Label>Internal Tree Number (optional)</Label>
          <Input
            {...register('internal_identification_no')}
            placeholder="e.g. 47"
            type="number"
          />
          {errors.internal_identification_no && (
            <p className="text-xs text-red-500">{String(errors.internal_identification_no.message)}</p>
          )}
        </div>

        {/* Date of plantation */}
        <div className="space-y-1">
          <Label>Date of Plantation (optional)</Label>
          <Input {...register('date_of_plantation')} type="date" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: '#2E7D32', color: 'white' }}
          >
            {saving ? 'Saving…' : 'Add Location'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
