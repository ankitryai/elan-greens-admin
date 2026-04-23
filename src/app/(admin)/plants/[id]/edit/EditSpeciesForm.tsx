'use client'
// =============================================================================
// Edit Species Form — pre-populated with existing species data.
//
// WHY no ImageUploader here? The AI identification flow is only for NEW species.
// On edit, the admin can optionally replace the main photo via a simple file
// input without re-running Plant.id. Sub-images are left as stored.
// =============================================================================

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { plantSpeciesSchema, type PlantSpeciesFormData } from '@/lib/validations'
import type { PlantSpecies } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import compress from 'browser-image-compression'

const CATEGORIES = ['Tree','Palm','Shrub','Herb','Creeper','Climber','Hedge','Grass'] as const
const HEIGHTS    = ['Short','Medium','Tall'] as const
const FLOWERING  = ['Flowering','Non-Flowering'] as const
const IMG_PARTS  = ['flowers','fruits','leaves','bark','roots'] as const

export default function EditSpeciesForm({ species }: { species: PlantSpecies }) {
  const router = useRouter()
  const [saving, setSaving]             = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(species.img_main_url)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PlantSpeciesFormData>({
    resolver: zodResolver(plantSpeciesSchema),
    defaultValues: {
      common_name:           species.common_name,
      botanical_name:        species.botanical_name        ?? '',
      hindi_name:            species.hindi_name            ?? '',
      kannada_name:          species.kannada_name          ?? '',
      tamil_name:            species.tamil_name            ?? '',
      category:              species.category,
      height_category:       species.height_category       ?? '',
      flowering_type:        species.flowering_type        ?? '',
      flowering_season:      species.flowering_season      ?? '',
      description:           species.description           ?? '',
      medicinal_properties:  species.medicinal_properties  ?? '',
      plant_family:          species.plant_family          ?? '',
      toxicity:              species.toxicity              ?? '',
      edible_parts:          species.edible_parts          ?? '',
      native_region:         species.native_region         ?? '',
      sunlight_needs:        species.sunlight_needs        ?? '',
      watering_needs:        species.watering_needs        ?? '',
      interesting_fact:      species.interesting_fact      ?? '',
      life_span_description: species.life_span_description ?? '',
      not_applicable_parts:  species.not_applicable_parts  ?? '',
      tentative:             species.tentative,
      notes:                 species.notes                 ?? '',
    },
  })

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoProcessing(true)
    setNewImageBase64(null)
    try {
      const compressed = await compress(file, { maxWidthOrHeight: 800, useWebWorker: false, initialQuality: 0.75 })
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const b64 = reader.result as string
          setNewImageBase64(b64)
          setPreviewUrl(b64)
          resolve()
        }
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(compressed)
      })
      toast.success('Photo ready — click Save to upload it')
    } catch (err) {
      toast.error(`Could not process photo: ${err instanceof Error ? err.message : 'Try a different image'}`)
      setPreviewUrl(species.img_main_url)
    } finally {
      setPhotoProcessing(false)
    }
  }

  async function onSubmit(data: PlantSpeciesFormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/plants/${species.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, imageBase64: newImageBase64 }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      toast.success(`"${data.common_name}" updated`)
      router.push('/plants')
    } catch (err) {
      toast.error(`Could not save. ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  const currentNAP = (watch('not_applicable_parts') ?? '').split('|').filter(Boolean)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <a href="/plants" className="hover:underline">Plants</a> /
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Edit — {species.common_name}</h1>
        <p className="text-xs text-gray-400 mt-1">ID: {species.plant_id}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Photo replacement (optional) */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Main Photo</h2>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Current plant photo" className="h-40 w-48 object-cover rounded-lg border" />
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" capture="environment"
            className="hidden" onChange={handlePhotoChange} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={photoProcessing} onClick={() => fileRef.current?.click()}>
              {photoProcessing ? 'Processing…' : '📷 Replace photo (optional)'}
            </Button>
            {newImageBase64 && (
              <span className="text-xs text-green-700 font-medium">✓ New photo ready to upload</span>
            )}
          </div>
        </section>

        {/* Identity fields */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Plant Identity</h2>

          <Field label="Common Name *" error={errors.common_name?.message}>
            <Input {...register('common_name')} />
          </Field>

          <Field label="Botanical Name" error={errors.botanical_name?.message}>
            <Input {...register('botanical_name')} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Hindi"><Input {...register('hindi_name')} /></Field>
            <Field label="Kannada"><Input {...register('kannada_name')} /></Field>
            <Field label="Tamil"><Input {...register('tamil_name')} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category *" error={errors.category?.message}>
              <Select
                defaultValue={species.category}
                onValueChange={v => setValue('category', v as PlantSpeciesFormData['category'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Height">
              <Select
                defaultValue={species.height_category ?? ''}
                onValueChange={v => setValue('height_category', v as PlantSpeciesFormData['height_category'])}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {HEIGHTS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Flowering Type">
              <Select
                defaultValue={species.flowering_type ?? ''}
                onValueChange={v => setValue('flowering_type', v as PlantSpeciesFormData['flowering_type'])}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FLOWERING.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Flowering Season">
              <Input {...register('flowering_season')} />
            </Field>
          </div>
        </section>

        {/* Details */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plant Family"><Input {...register('plant_family')} /></Field>
            <Field label="Toxicity"><Input {...register('toxicity')} /></Field>
            <Field label="Edible Parts"><Input {...register('edible_parts')} /></Field>
            <Field label="Native Region"><Input {...register('native_region')} /></Field>
            <Field label="Sunlight"><Input {...register('sunlight_needs')} /></Field>
            <Field label="Watering"><Input {...register('watering_needs')} /></Field>
          </div>
          <Field label="Lifespan"><Input {...register('life_span_description')} /></Field>
          <Field label="Description" error={errors.description?.message}>
            <CharCountTextarea name="description" register={register} setValue={setValue} watch={watch} max={500} />
          </Field>
          <Field label="Medicinal / Ecological Properties" error={errors.medicinal_properties?.message}>
            <CharCountTextarea name="medicinal_properties" register={register} setValue={setValue} watch={watch} max={300} />
          </Field>
          <Field label="Interesting Fact"><Input {...register('interesting_fact')} /></Field>
          <Field label="Internal Notes"><Input {...register('notes')} /></Field>
        </section>

        {/* N/A image categories */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Image Categories (N/A)</h2>
          <div className="flex flex-wrap gap-3">
            {IMG_PARTS.map(part => (
              <label key={part} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={currentNAP.includes(part)}
                  onChange={e => {
                    const current = watch('not_applicable_parts') ?? ''
                    const parts = current.split('|').filter(Boolean)
                    const updated = e.target.checked
                      ? [...parts, part]
                      : parts.filter(p => p !== part)
                    setValue('not_applicable_parts', updated.join('|'))
                  }}
                />
                {part.charAt(0).toUpperCase() + part.slice(1)}
              </label>
            ))}
          </div>
        </section>

        {/* Tentative flag */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tentative" {...register('tentative')} />
          <label htmlFor="tentative" className="text-sm text-gray-700">
            Mark as <strong>TENTATIVE</strong>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || photoProcessing} style={{ backgroundColor: '#2E7D32', color: 'white' }}>
            {saving ? 'Saving…' : photoProcessing ? 'Processing photo…' : 'Save Changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function CharCountTextarea({
  name, register, setValue, watch, max,
}: {
  name: keyof PlantSpeciesFormData
  register: ReturnType<typeof useForm<PlantSpeciesFormData>>['register']
  setValue: ReturnType<typeof useForm<PlantSpeciesFormData>>['setValue']
  watch: ReturnType<typeof useForm<PlantSpeciesFormData>>['watch']
  max: number
}) {
  const value = (watch(name) as string) ?? ''
  return (
    <div>
      <Textarea {...register(name)} rows={3} />
      <p className={`text-xs mt-1 text-right ${value.length > max ? 'text-red-500' : 'text-gray-400'}`}>
        {value.length} / {max}
      </p>
    </div>
  )
}
