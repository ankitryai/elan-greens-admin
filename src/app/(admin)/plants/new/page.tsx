'use client'
// =============================================================================
// Add Species Page — Camera → Identify → Auto-fill → Save
//
// WHY 'use client'? ImageUploader needs camera/EXIF access (browser APIs).
// The form state must be managed in the browser as fields are auto-filled
// from Plant.id results. Save action calls a Server Action via fetch.
// =============================================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { plantSpeciesSchema, type PlantSpeciesFormData } from '@/lib/validations'
import ImageUploader, { type IdentificationResult } from '@/components/ImageUploader'
import { hasAnySubImages, buildSubImageFields, IMAGE_PART_KEYS, type SubImages } from '@/lib/subImageHelpers'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, CharCountInput } from '@/components/PlantFormFields'
import { usePopulateFromName } from '@/lib/usePopulateFromName'
import { useGenerateWithAI } from '@/lib/useGenerateWithAI'
import { PlantIdentitySection } from '@/components/PlantIdentitySection'
import { PlantDetailsSection } from '@/components/PlantDetailsSection'
import { AiGenerateSection } from '@/components/AiGenerateSection'
import type { WikimediaImage } from '@/types'
import type { ImagePartKey } from '@/lib/subImageHelpers'
const IMG_PARTS  = ['flowers','fruits','leaves','bark','roots'] as const

export default function AddSpeciesPage() {
  const router = useRouter()
  const [imageBase64, setImageBase64]         = useState<string | null>(null)
  const [subImages, setSubImages]             = useState<SubImages | null>(null)
  const [aiConfidence, setAiConfidence]       = useState<number | null>(null)
  const [saving, setSaving]                   = useState(false)
  const [serverError, setServerError]         = useState<string | null>(null)
  const [duplicateSpecies, setDuplicateSpecies] = useState<{ id: string; name: string } | null>(null)
  const [searchTags, setSearchTags]           = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PlantSpeciesFormData>({
    resolver: zodResolver(plantSpeciesSchema),
    defaultValues: { tentative: true },
  })

  const { populatingFromName, populateStatus, handlePopulateFromName } = usePopulateFromName({
    mode: 'create',
    watch,
    setValue,
    commonName: watch('common_name') ?? '',
    onImagesFetched: imgs => { if (hasAnySubImages(imgs)) setSubImages(imgs) },
  })

  const {
    generating: aiGenerating,
    generateStatus: aiGenerateStatus,
    lastResult: aiLastResult,
    handleGenerateWithAI,
    applyGeneratedResult,
    dismissGeneratedResult,
  } = useGenerateWithAI({ watch, setValue, imageBase64 })

  // Auto-fill genus from the first word of botanical name when genus is empty
  const watchedBotanical = watch('botanical_name')
  const watchedGenus     = watch('genus')
  useEffect(() => {
    const botanical = (watchedBotanical ?? '').trim()
    if (!botanical) return
    if ((watchedGenus ?? '').trim()) return  // admin already typed something — don't override
    // Strip hybrid prefix ×/x before taking first word
    const derived = botanical.split(/\s+/)[0].replace(/^[×xX]/i, '').trim()
    if (derived.length > 1) setValue('genus', derived)
  }, [watchedBotanical]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sub-image reject / move handlers ─────────────────────────────────────
  function rejectImage(cat: ImagePartKey, url: string) {
    setSubImages(prev => prev
      ? { ...prev, [cat]: prev[cat].filter(img => img.url !== url) }
      : prev
    )
  }
  function rejectAllInCat(cat: ImagePartKey) {
    setSubImages(prev => prev ? { ...prev, [cat]: [] } : prev)
  }
  function moveImage(fromCat: ImagePartKey, toCat: ImagePartKey, img: WikimediaImage) {
    setSubImages(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [fromCat]: prev[fromCat].filter(i => i.url !== img.url),
        [toCat]:   [...prev[toCat], img],
      }
    })
  }

  // Called by ImageUploader after identification — pre-fills form fields.
  function handleIdentified(result: IdentificationResult) {
    setAiConfidence(result.confidence)
    if (result.commonName)    setValue('common_name', result.commonName)
    if (result.botanicalName) setValue('botanical_name', result.botanicalName)
    if (result.family)        setValue('plant_family', result.family)
    if (result.genus)         setValue('genus', result.genus)   // Plant.id taxonomy — most accurate
    if (result.edibleParts)   setValue('edible_parts', result.edibleParts)
    if (result.description)   setValue('description', result.description)
    setValue('tentative', true)  // AI-filled data always starts tentative
  }

  async function onSubmit(data: PlantSpeciesFormData) {
    setSaving(true)
    try {
      // Check for duplicate species before saving.
      let checkFailed = false
      try {
        const checkRes = await fetch(`/api/check-duplicate?name=${encodeURIComponent(data.common_name)}`)
        if (checkRes.ok) {
          const { existing } = await checkRes.json() as { existing: { id: string; common_name: string } | null }
          if (existing) {
            setDuplicateSpecies({ id: existing.id, name: existing.common_name })
            setSaving(false)
            return
          }
        } else {
          checkFailed = true
        }
      } catch {
        checkFailed = true
      }
      if (checkFailed) {
        toast.error('Could not check for duplicates. Please verify this species does not already exist before saving.')
        setSaving(false)
        return
      }

      // Build image fields object from sub-image results.
      const imageFields = buildSubImageFields(subImages)

      const res = await fetch('/api/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...imageFields, imageBase64, search_tags: searchTags }),
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }

      toast.success(`"${data.common_name}" added to plant directory`)
      router.push('/plants')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.'
      setServerError(msg)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {serverError && (
        <ErrorBanner message={serverError} onClose={() => setServerError(null)} />
      )}

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
            onTagsComputed={tags => setSearchTags(tags)}
          />
          {aiConfidence !== null && (
            <p className="text-xs text-amber-600">
              ⚠️ AI suggested these details ({aiConfidence}% confidence). Review each field before saving.
            </p>
          )}
        </section>

        <PlantIdentitySection
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          populatingFromName={populatingFromName}
          populateStatus={populateStatus}
          onPopulateFromName={handlePopulateFromName}
          heading="2. Plant Identity"
        />

        <AiGenerateSection
          watch={watch}
          hasImage={!!imageBase64}
          generating={aiGenerating}
          generateStatus={aiGenerateStatus}
          lastResult={aiLastResult}
          onGenerate={handleGenerateWithAI}
          onApply={applyGeneratedResult}
          onDismiss={dismissGeneratedResult}
        />

        <PlantDetailsSection
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          heading="3. Details (auto-filled from Plant.id)"
        />

        {/* Section 3b — Enrichment Data */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">
            3b. Enrichment Data
            <span className="ml-2 text-[11px] font-normal text-gray-400">
              (auto-filled by 🌿 Populate from Name above — or complete after saving via the edit page)
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Foliage Type">
              <Select onValueChange={v => setValue('foliage_type', v as PlantSpeciesFormData['foliage_type'])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Evergreen">Evergreen</SelectItem>
                  <SelectItem value="Deciduous">Deciduous</SelectItem>
                  <SelectItem value="Semi-evergreen">Semi-evergreen</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conservation Status">
              <CharCountInput name="conservation_status" register={register} watch={watch} max={100} placeholder="e.g. Least Concern" />
            </Field>
            <Field label="Growth Rate">
              <Select onValueChange={v => setValue('growth_rate', v as PlantSpeciesFormData['growth_rate'])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Slow">Slow</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="iNat Observations">
              <Input {...register('observations_count')} type="number" min={0} placeholder="e.g. 12500" />
            </Field>
          </div>
          <Field label="Propagation Methods">
            <CharCountInput name="propagation_methods" register={register} watch={watch} max={200} placeholder="e.g. Seeds|Stem cuttings|Division" />
          </Field>
          <Field label="Habitat Type">
            <CharCountInput name="habitat_type" register={register} watch={watch} max={200} placeholder="e.g. Tropical dry forest, scrublands" />
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
            <SubImagePreview
              subImages={subImages}
              onRejectImage={rejectImage}
              onRejectAll={rejectAllInCat}
              onMoveImage={moveImage}
            />
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

function SubImagePreview({
  subImages,
  onRejectImage,
  onRejectAll,
  onMoveImage,
}: {
  subImages: SubImages
  onRejectImage: (cat: ImagePartKey, url: string) => void
  onRejectAll:   (cat: ImagePartKey) => void
  onMoveImage:   (fromCat: ImagePartKey, toCat: ImagePartKey, img: WikimediaImage) => void
}) {
  return (
    <div className="space-y-3">
      {IMAGE_PART_KEYS.map(cat => {
        const images = subImages[cat]
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</p>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRejectAll(cat)}
                  className="text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-1.5 py-0.5 leading-none"
                >
                  ✕ Reject all
                </button>
              )}
            </div>
            {images.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No images found for this category.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {images.map(img => (
                  <div key={img.url} className="space-y-0.5">
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`${cat} photo`}
                        className="h-24 w-32 object-cover rounded-lg border border-blue-200"
                      />
                      {/* × reject button */}
                      <button
                        type="button"
                        onClick={() => onRejectImage(cat, img.url)}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center
                                   bg-red-500 text-white rounded-full text-[11px] leading-none
                                   opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        title="Remove this image"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 max-w-[128px] truncate" title={img.attribution}>
                      {img.attribution}
                    </p>
                    {/* Move to another category */}
                    <select
                      value={cat}
                      onChange={e => {
                        const toCat = e.target.value as ImagePartKey
                        if (toCat !== cat) onMoveImage(cat, toCat, img)
                      }}
                      className="text-[10px] w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-500"
                      title="Move to a different category"
                    >
                      {IMAGE_PART_KEYS.map(k => (
                        <option key={k} value={k}>
                          {k === cat ? `📂 ${k}` : `→ ${k}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs text-amber-600 border-t pt-2">
        ↑ Blue-bordered images will be saved. Hover to remove · use the dropdown to move to the correct category.
      </p>
    </div>
  )
}
