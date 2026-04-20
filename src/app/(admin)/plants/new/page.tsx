'use client'
// =============================================================================
// Add Species Page — Camera → Identify → Auto-fill → Save
//
// WHY 'use client'? ImageUploader needs camera/EXIF access (browser APIs).
// The form state must be managed in the browser as fields are auto-filled
// from Plant.id results. Save action calls a Server Action via fetch.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { plantSpeciesSchema, type PlantSpeciesFormData } from '@/lib/validations'
import ImageUploader, { type IdentificationResult, type SubImages } from '@/components/ImageUploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createServiceRoleClient } from '@/lib/supabase'

const CATEGORIES = ['Tree','Palm','Shrub','Herb','Creeper','Climber','Hedge','Grass'] as const
const HEIGHTS    = ['Short','Medium','Tall'] as const
const FLOWERING  = ['Flowering','Non-Flowering'] as const
const IMG_PARTS  = ['flowers','fruits','leaves','bark','roots'] as const

export default function AddSpeciesPage() {
  const router = useRouter()
  const [imageBase64, setImageBase64]   = useState<string | null>(null)
  const [subImages, setSubImages]       = useState<SubImages | null>(null)
  const [aiConfidence, setAiConfidence] = useState<number | null>(null)
  const [saving, setSaving]             = useState(false)
  const [duplicateSpecies, setDuplicateSpecies] = useState<{ id: string; name: string } | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PlantSpeciesFormData>({
    resolver: zodResolver(plantSpeciesSchema),
    defaultValues: { tentative: true },
  })

  // Called by ImageUploader after identification — pre-fills form fields.
  function handleIdentified(result: IdentificationResult) {
    setAiConfidence(result.confidence)
    if (result.commonName)    setValue('common_name', result.commonName)
    if (result.botanicalName) setValue('botanical_name', result.botanicalName)
    if (result.family)        setValue('plant_family', result.family)
    if (result.edibleParts)   setValue('edible_parts', result.edibleParts)
    if (result.description)   setValue('description', result.description)
    setValue('tentative', true)  // AI-filled data always starts tentative
  }

  async function onSubmit(data: PlantSpeciesFormData) {
    setSaving(true)
    try {
      // Check for duplicate species before saving.
      const checkRes = await fetch(`/api/check-duplicate?name=${encodeURIComponent(data.common_name)}`)
      const { existing } = await checkRes.json() as { existing: { id: string; common_name: string } | null }
      if (existing) {
        setDuplicateSpecies({ id: existing.id, name: existing.common_name })
        setSaving(false)
        return
      }

      // Build image fields object from sub-image results.
      const imageFields = buildImageFields(subImages)

      const res = await fetch('/api/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...imageFields, imageBase64 }),
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }

      toast.success(`"${data.common_name}" added to plant directory`)
      router.push('/plants')
    } catch (err) {
      toast.error(`Could not save. ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Species</h1>
        <p className="text-sm text-gray-500 mt-1">
          Take a photo to auto-identify, or fill in details manually.
        </p>
      </div>

      {/* Duplicate detected banner */}
      {duplicateSpecies && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>"{duplicateSpecies.name}"</strong> already exists in the directory.
          </p>
          <a
            href={`/plants/${duplicateSpecies.id}/locations/new`}
            className="text-sm text-green-700 underline mt-1 block"
          >
            Add a new location for this species instead →
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Section 1 — Photo */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">1. Plant Photo</h2>
          <ImageUploader
            onImageReady={(b64) => setImageBase64(b64)}
            onIdentified={handleIdentified}
            onSubImagesReady={setSubImages}
          />
          {aiConfidence !== null && (
            <p className="text-xs text-amber-600">
              ⚠️ AI suggested these details ({aiConfidence}% confidence). Review each field before saving.
            </p>
          )}
        </section>

        {/* Section 2 — Identity fields */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">2. Plant Identity</h2>

          <Field label="Common Name *" error={errors.common_name?.message}>
            <Input {...register('common_name')} placeholder="e.g. Neem Tree" />
          </Field>

          <Field label="Botanical Name" error={errors.botanical_name?.message}>
            <Input {...register('botanical_name')} placeholder="e.g. Azadirachta indica" />
            {watch('botanical_name') && !watch('botanical_name')?.includes(' ') && (
              <p className="text-xs text-amber-500 mt-1">Botanical names usually have two words. Double-check this.</p>
            )}
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Hindi" error={errors.hindi_name?.message}>
              <Input {...register('hindi_name')} placeholder="नीम" />
            </Field>
            <Field label="Kannada" error={errors.kannada_name?.message}>
              <Input {...register('kannada_name')} placeholder="ಬೇವು" />
            </Field>
            <Field label="Tamil" error={errors.tamil_name?.message}>
              <Input {...register('tamil_name')} placeholder="வேம்பு" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category *" error={errors.category?.message}>
              <Select onValueChange={v => setValue('category', v as PlantSpeciesFormData['category'])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Height" error={errors.height_category?.message}>
              <Select onValueChange={v => setValue('height_category', v as PlantSpeciesFormData['height_category'])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {HEIGHTS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Flowering Type">
              <Select onValueChange={v => setValue('flowering_type', v as PlantSpeciesFormData['flowering_type'])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FLOWERING.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Flowering Season">
              <Input {...register('flowering_season')} placeholder="e.g. Year-round" />
            </Field>
          </div>
        </section>

        {/* Section 3 — Details */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">3. Details (auto-filled from Plant.id)</h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Plant Family"><Input {...register('plant_family')} placeholder="e.g. Meliaceae" /></Field>
            <Field label="Toxicity"><Input {...register('toxicity')} placeholder="e.g. Non-toxic" /></Field>
            <Field label="Edible Parts"><Input {...register('edible_parts')} placeholder="e.g. Leaves, fruit" /></Field>
            <Field label="Native Region"><Input {...register('native_region')} placeholder="e.g. South Asia" /></Field>
            <Field label="Sunlight"><Input {...register('sunlight_needs')} placeholder="e.g. Full Sun" /></Field>
            <Field label="Watering"><Input {...register('watering_needs')} placeholder="e.g. Low" /></Field>
          </div>

          <Field label="Lifespan" error={errors.life_span_description?.message}>
            <Input {...register('life_span_description')} placeholder="e.g. 150–200 years" />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <CharCountTextarea name="description" register={register} setValue={setValue} max={500} watch={watch}
              placeholder="2–3 sentences about this plant." />
          </Field>

          <Field label="Medicinal / Ecological Properties" error={errors.medicinal_properties?.message}>
            <CharCountTextarea name="medicinal_properties" register={register} setValue={setValue} max={300} watch={watch}
              placeholder="Separate each property with | e.g. Treats fever | Reduces inflammation" />
          </Field>

          <Field label="Interesting Fact">
            <Input {...register('interesting_fact')} placeholder="One-liner fun fact for residents" />
          </Field>
        </section>

        {/* Section 4 — Not applicable parts */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">4. Image Categories (N/A)</h2>
          <p className="text-xs text-gray-500">
            Tick any image category that does not apply to this species
            (e.g. "Roots" for lawn grass). These slots will show "Not applicable" on the public app.
          </p>
          <div className="flex flex-wrap gap-3">
            {IMG_PARTS.map(part => (
              <label key={part} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  value={part}
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

        {/* Section 5 — Wikimedia sub-images preview */}
        {subImages && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-700 border-b pb-2">
              5. Auto-fetched Images (from Wikimedia Commons)
            </h2>
            <p className="text-xs text-gray-500">Review each image. They will be saved with the species.</p>
            <SubImagePreview subImages={subImages} />
          </section>
        )}

        {/* Section 6 — Tentative flag */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tentative" {...register('tentative')} />
          <label htmlFor="tentative" className="text-sm text-gray-700">
            Mark as <strong>TENTATIVE</strong> (AI-suggested data, not yet verified by society)
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: '#2E7D32', color: 'white' }}
          >
            {saving ? 'Saving…' : 'Save Species'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Small helpers to keep JSX readable ───────────────────────────────────────

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
  name, register, setValue, watch, max, placeholder,
}: {
  name: keyof PlantSpeciesFormData
  register: ReturnType<typeof useForm<PlantSpeciesFormData>>['register']
  setValue: ReturnType<typeof useForm<PlantSpeciesFormData>>['setValue']
  watch: ReturnType<typeof useForm<PlantSpeciesFormData>>['watch']
  max: number
  placeholder: string
}) {
  const value = (watch(name) as string) ?? ''
  return (
    <div>
      <Textarea {...register(name)} placeholder={placeholder} rows={3} />
      <p className={`text-xs mt-1 text-right ${value.length > max ? 'text-red-500' : 'text-gray-400'}`}>
        {value.length} / {max}
      </p>
    </div>
  )
}

function SubImagePreview({ subImages }: { subImages: SubImages }) {
  const categories = Object.entries(subImages) as [string, { url: string; attribution: string }[]][]
  return (
    <div className="space-y-3">
      {categories.map(([cat, images]) => (
        <div key={cat}>
          <p className="text-xs font-medium text-gray-600 capitalize mb-1">{cat}</p>
          {images.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No images found on Wikimedia for this category.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {images.map(img => (
                <div key={img.url} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`${cat} photo`} className="h-24 w-32 object-cover rounded border" />
                  <p className="text-xs text-gray-400 max-w-[128px] truncate" title={img.attribution}>
                    {img.attribution}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Flatten SubImages into the flat DB column structure
function buildImageFields(subImages: SubImages | null): Record<string, string | null> {
  if (!subImages) return {}
  const f: Record<string, string | null> = {}
  const map: [string, keyof SubImages][] = [
    ['flower', 'flowers'], ['fruit', 'fruits'],
    ['leaf', 'leaves'],    ['bark', 'bark'], ['root', 'roots'],
  ]
  for (const [prefix, key] of map) {
    const imgs = subImages[key]
    f[`img_${prefix}_1_url`]  = imgs[0]?.url ?? null
    f[`img_${prefix}_1_attr`] = imgs[0]?.attribution ?? null
    f[`img_${prefix}_2_url`]  = imgs[1]?.url ?? null
    f[`img_${prefix}_2_attr`] = imgs[1]?.attribution ?? null
  }
  return f
}
