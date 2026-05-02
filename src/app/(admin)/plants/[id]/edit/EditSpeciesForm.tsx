'use client'
// =============================================================================
// Edit Species Form
//
// Two AI-assist features:
//
// 1. Sub-images from Wikimedia Commons
//    - "Fetch missing" only pulls categories not yet saved in the DB.
//    - "Re-fetch all" replaces everything (explicit override).
//    - buildSubImageFields skips categories with no new images so existing
//      DB values are never nulled out by an empty Wikimedia response.
//
// 2. Plant.id re-identification panel
//    - Upload any photo (or reuse the replacement photo above).
//    - Shows confidence + suggested values for each field.
//    - "Fill empty fields" applies only where the field is currently blank.
//    - "Overwrite all" replaces everything (explicit override).
// =============================================================================

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { plantSpeciesSchema, type PlantSpeciesFormData } from '@/lib/validations'
import type { PlantSpecies } from '@/types'
import type { SubImages } from '@/components/ImageUploader'
import type { PlantIdResult } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBanner } from '@/components/ErrorBanner'
import { incrementApiCount, getApiCount } from '@/components/ApiCounter'

const PLANT_ID_LIMIT = 100

// ── Canvas compression ───────────────────────────────────────────────────────
function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX }
        else        { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available in this browser')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to decode image — try a JPG or PNG')) }
    img.src = objectUrl
  })
}

// ── Sub-image helpers ────────────────────────────────────────────────────────

// Only include categories that have actual new images — never null-out existing
// DB values because Wikimedia found nothing for that category.
function buildSubImageFields(subImages: SubImages): Record<string, string | null> {
  const f: Record<string, string | null> = {}
  const map: [string, keyof SubImages][] = [
    ['flower', 'flowers'], ['fruit', 'fruits'],
    ['leaf', 'leaves'],    ['bark', 'bark'], ['root', 'roots'],
  ]
  for (const [prefix, key] of map) {
    const imgs = subImages[key]
    if (imgs.length === 0) continue  // no new images — leave existing DB values intact
    f[`img_${prefix}_1_url`]  = imgs[0]?.url  ?? null
    f[`img_${prefix}_1_attr`] = imgs[0]?.attribution ?? null
    f[`img_${prefix}_2_url`]  = imgs[1]?.url  ?? null
    f[`img_${prefix}_2_attr`] = imgs[1]?.attribution ?? null
  }
  return f
}

// Which categories already have at least one image saved?
function filledCategories(s: PlantSpecies): string[] {
  const filled: string[] = []
  if (s.img_flower_1_url) filled.push('flowers')
  if (s.img_fruit_1_url)  filled.push('fruits')
  if (s.img_leaf_1_url)   filled.push('leaves')
  if (s.img_bark_1_url)   filled.push('bark')
  if (s.img_root_1_url)   filled.push('roots')
  return filled
}


// ── Plant.id suggestion → form-ready fields ──────────────────────────────────
interface IdentifySuggestion {
  botanicalName: string
  commonName:    string
  confidence:    number   // 0–100 percentage
  description:   string
  plantFamily:   string
  edibleParts:   string
  watering:      string
}

function extractSuggestion(result: PlantIdResult): IdentifySuggestion | null {
  const top = result.suggestions?.[0]
  if (!top) return null
  const d = top.plant_details
  const wateringRaw = d.watering
  let watering = ''
  if (wateringRaw) {
    const avg = (wateringRaw.min + wateringRaw.max) / 2
    watering = avg < 1.5 ? 'Low' : avg < 2.5 ? 'Medium' : 'High'
  }
  return {
    botanicalName: top.plant_name ?? '',
    commonName:    d.common_names?.[0] ?? '',
    confidence:    Math.round((top.probability ?? 0) * 100),
    description:   d.wiki_description?.value ?? '',
    plantFamily:   d.taxonomy?.family ?? '',
    edibleParts:   d.edible_parts?.join(', ') ?? '',
    watering,
  }
}

const CATEGORIES = ['Tree','Palm','Shrub','Herb','Creeper','Climber','Hedge','Grass'] as const
const HEIGHTS    = ['Short','Medium','Tall'] as const
const FLOWERING  = ['Flowering','Non-Flowering'] as const
const IMG_PARTS  = ['flowers','fruits','leaves','bark','roots'] as const

export default function EditSpeciesForm({ species }: { species: PlantSpecies }) {
  const router = useRouter()
  const [saving, setSaving]                       = useState(false)
  const [photoProcessing, setPhotoProcessing]     = useState(false)
  const [newImageBase64, setNewImageBase64]       = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]               = useState<string | null>(species.img_main_url)
  const [serverError, setServerError]             = useState<string | null>(null)

  // Sub-images state
  const [fetchingSubImages, setFetchingSubImages] = useState(false)
  const [fetchedSubImages, setFetchedSubImages]   = useState<SubImages | null>(null)

  // Plant.id identification state
  const [identifying, setIdentifying]             = useState(false)
  const [identifySuggestion, setIdentifySuggestion] = useState<IdentifySuggestion | null>(null)
  const [identifyExpanded, setIdentifyExpanded]   = useState(false)
  const [plantIdUsed, setPlantIdUsed]             = useState(() =>
    typeof window !== 'undefined' ? getApiCount('plantid') : 0
  )
  const identifyFileRef = useRef<HTMLInputElement>(null)
  const mainFileRef     = useRef<HTMLInputElement>(null)

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

  // ── Main photo replacement ─────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoProcessing(true)
    setNewImageBase64(null)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Image too large (max 10 MB). Pick a smaller file.')
      const b64 = await compressToBase64(file)
      setNewImageBase64(b64)
      setPreviewUrl(b64)
      toast.success(`Photo ready (${Math.round(b64.length * 0.75 / 1024)} KB) — click Save to upload`)
    } catch (err) {
      toast.error(`Photo processing failed: ${err instanceof Error ? err.message : 'Try a different image'}`)
      setPreviewUrl(species.img_main_url)
    } finally {
      setPhotoProcessing(false)
    }
  }

  // ── Plant.id identification ────────────────────────────────────────────────
  async function handleIdentifyPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIdentifying(true)
    setIdentifySuggestion(null)
    try {
      const b64 = await compressToBase64(file)
      await runIdentification({ imageBase64: b64 })
    } catch (err) {
      setServerError(`Plant.id failed: ${err instanceof Error ? err.message : 'Try again'}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIdentifying(false)
    }
  }

  async function runIdentification(payload: { imageBase64?: string; imageUrl?: string }) {
    const res = await fetch('/api/identify-plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json() as { error: string }
      throw new Error(err.error ?? 'Identification failed')
    }
    // Increment counter AFTER a successful API call
    incrementApiCount('plantid')
    setPlantIdUsed(getApiCount('plantid'))

    const result = await res.json() as PlantIdResult
    const suggestion = extractSuggestion(result)
    if (!suggestion) throw new Error('No suggestions returned by Plant.id')
    setIdentifySuggestion(suggestion)
    toast.success(`Plant.id: ${suggestion.confidence}% confident — ${suggestion.botanicalName}`)
  }

  // Apply Plant.id suggestion to form fields.
  // onlyEmpty = true  → only fill fields that are currently blank (safe merge)
  // onlyEmpty = false → overwrite all fields (explicit override)
  function applyIdentification(onlyEmpty: boolean) {
    if (!identifySuggestion) return
    const s = identifySuggestion

    const set = (field: keyof PlantSpeciesFormData, value: string) => {
      if (!value) return
      const current = (watch(field) ?? '') as string
      if (!onlyEmpty || !current.trim()) {
        setValue(field, value as never)
      }
    }

    set('botanical_name',  s.botanicalName)
    set('description',     s.description.slice(0, 500))
    set('plant_family',    s.plantFamily)
    set('edible_parts',    s.edibleParts)
    set('watering_needs',  s.watering)

    toast.success(onlyEmpty ? 'Empty fields filled from Plant.id ✓' : 'All fields overwritten from Plant.id ✓')
  }

  // ── Sub-image fetch ────────────────────────────────────────────────────────
  // Always fetches all 5 categories — no pre-save skip optimisation.
  // buildSubImageFields already ensures empty Wikimedia results don't null-out
  // existing DB images on save.
  // overrideName: pass an identified botanical name from Plant.id before it's
  //   been saved to the form, so Wikimedia can use it immediately.
  async function handleFetchSubImages(overrideName?: string) {
    const botanicalName = overrideName ?? watch('botanical_name') ?? species.botanical_name ?? ''
    const commonName    = species.common_name

    if (!botanicalName && !commonName) {
      toast.warning('Fill in the botanical or common name first so Wikimedia knows what to search for.')
      return
    }

    const filledCatsNow = filledCategories(species)
    let msg = `Fetch sub-images for "${commonName}" from Wikimedia Commons?`
    if (filledCatsNow.length > 0) {
      msg += `\n\nNote: ${filledCatsNow.join(', ')} already have saved images. New results will replace them on Save.`
    }
    if (!window.confirm(msg)) return

    const params = new URLSearchParams()
    if (botanicalName) params.set('name', botanicalName)
    if (commonName)    params.set('common', commonName)

    setFetchingSubImages(true)
    try {
      const res = await fetch(`/api/fetch-images?${params}`)
      if (!res.ok) throw new Error('Wikimedia fetch failed')
      const data = await res.json() as SubImages
      setFetchedSubImages(data)
      const total = Object.values(data).flat().length
      if (total === 0) {
        toast.warning('No images found on Wikimedia for this plant. Wikimedia coverage varies — try again later or add images manually.')
      } else {
        toast.success(`${total} image${total !== 1 ? 's' : ''} fetched — review below, then Save Changes`)
      }
    } catch (err) {
      setServerError(`Sub-image fetch failed: ${err instanceof Error ? err.message : 'Try again'}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setFetchingSubImages(false)
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function onSubmit(data: PlantSpeciesFormData) {
    if (!species.img_main_url && !newImageBase64) {
      toast.warning('Saving without a photo — use "Replace photo" to add one before saving')
    }
    setSaving(true)
    try {
      const imageFields = fetchedSubImages ? buildSubImageFields(fetchedSubImages) : {}
      const res = await fetch(`/api/plants/${species.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, imageBase64: newImageBase64, ...imageFields }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      const saved = newImageBase64 ? `"${data.common_name}" updated with new photo` : `"${data.common_name}" updated`
      toast.success(saved)
      router.push('/plants')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.'
      setServerError(msg)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {serverError && (
        <ErrorBanner message={serverError} onClose={() => setServerError(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* ── Main Photo ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Main Photo</h2>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Current plant photo"
              className="h-40 w-48 object-cover rounded-lg border" />
          )}
          <input ref={mainFileRef} type="file" accept="image/jpeg,image/png"
            capture="environment" className="hidden" onChange={handlePhotoChange} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={photoProcessing}
              onClick={() => mainFileRef.current?.click()}>
              {photoProcessing ? 'Processing…' : '📷 Replace photo (optional)'}
            </Button>
            {newImageBase64 && (
              <span className="text-xs text-green-700 font-medium">✓ New photo ready to upload</span>
            )}
          </div>
        </section>

        {/* ── Plant.id Re-identification ───────────────────────────────────── */}
        {(() => {
          const remaining    = PLANT_ID_LIMIT - plantIdUsed
          const isLow        = remaining <= 10
          const isExhausted  = remaining <= 0
          // Count how many key fields are already filled — helps decide if a call is worth it
          const filledFields = [
            watch('botanical_name'), watch('description'),
            watch('plant_family'),   watch('watering_needs'),
          ].filter(v => (v ?? '').toString().trim()).length
          const mostlyFilled = filledFields >= 3

          return (
            <section className="border border-blue-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIdentifyExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
              >
                <span>🔍 Re-identify with Plant.id — auto-fill missing details</span>
                <div className="flex items-center gap-3">
                  {/* API usage counter — always visible in the header */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                    ${isExhausted ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-white text-blue-600'}`}>
                    {isExhausted ? '✗ quota exhausted' : `${remaining} / ${PLANT_ID_LIMIT} hits left`}
                  </span>
                  <span className="text-blue-400 text-lg leading-none">{identifyExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {identifyExpanded && (
                <div className="p-4 space-y-4 bg-white">

                  {/* Warn if quota is low */}
                  {isExhausted && (
                    <div className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
                      ✗ Monthly Plant.id quota exhausted ({PLANT_ID_LIMIT} calls used). Resets on the 1st of next month.
                    </div>
                  )}
                  {!isExhausted && isLow && (
                    <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
                      ⚠ Only {remaining} Plant.id call{remaining !== 1 ? 's' : ''} left this month — use carefully.
                    </div>
                  )}

                  {/* Warn if most fields already have data */}
                  {mostlyFilled && !identifySuggestion && (
                    <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600">
                      ℹ Most fields for this plant are already filled. A Plant.id call may not be needed — check the form above before proceeding.
                    </div>
                  )}

                  {/* Hidden file input for uploading a different photo */}
                  <input
                    ref={identifyFileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="hidden"
                    onChange={handleIdentifyPhoto}
                  />

                  {/* Primary action: use existing saved photo — no re-upload */}
                  <div className="space-y-2">
                    {(species.img_main_url || newImageBase64) && (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={newImageBase64 ?? species.img_main_url!}
                          alt="Photo for identification"
                          className="h-16 w-20 object-cover rounded-lg border border-gray-200 shrink-0"
                        />
                        <div className="space-y-1.5">
                          <p className="text-xs text-gray-500">
                            {newImageBase64 ? 'Using replacement photo loaded above' : 'Using saved main photo'}
                          </p>
                          <Button
                            type="button"
                            disabled={identifying || isExhausted}
                            className="text-xs"
                            style={{ backgroundColor: '#2E7D32', color: 'white' }}
                            onClick={async () => {
                              setIdentifying(true)
                              setIdentifySuggestion(null)
                              try {
                                // Pass URL directly — Plant.id fetches it server-side,
                                // no re-upload from browser needed.
                                const payload = newImageBase64
                                  ? { imageBase64: newImageBase64 }
                                  : { imageUrl: species.img_main_url! }
                                await runIdentification(payload)
                              } catch (err) {
                                setServerError(`Plant.id failed: ${err instanceof Error ? err.message : 'Try again'}`)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              } finally {
                                setIdentifying(false)
                              }
                            }}
                          >
                            {identifying ? '🔍 Identifying…' : '🔍 Identify this plant'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Fallback / alternative: upload a different photo */}
                    <button
                      type="button"
                      disabled={identifying || isExhausted}
                      onClick={() => identifyFileRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                    >
                      {species.img_main_url ? '↑ Use a different photo instead' : '📷 Upload a photo to identify'}
                    </button>
                  </div>

                  {/* Results panel */}
                  {identifySuggestion && (
                    <div className="space-y-3">
                      {/* Confidence badge */}
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
                        ${identifySuggestion.confidence >= 70
                          ? 'bg-green-100 text-green-800'
                          : identifySuggestion.confidence >= 40
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'}`}>
                        {identifySuggestion.confidence >= 70 ? '✓' : '⚠'}&nbsp;
                        {identifySuggestion.confidence}% confident — {identifySuggestion.botanicalName}
                      </div>

                      {/* Suggestion diff table */}
                      <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-gray-500 font-medium w-32">Field</th>
                              <th className="text-left px-3 py-2 text-gray-500 font-medium">Current value</th>
                              <th className="text-left px-3 py-2 text-gray-500 font-medium">Plant.id suggests</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {([
                              ['Botanical name', watch('botanical_name'), identifySuggestion.botanicalName],
                              ['Description',    watch('description'),    identifySuggestion.description.slice(0, 80) + (identifySuggestion.description.length > 80 ? '…' : '')],
                              ['Plant family',   watch('plant_family'),   identifySuggestion.plantFamily],
                              ['Edible parts',   watch('edible_parts'),   identifySuggestion.edibleParts],
                              ['Watering',       watch('watering_needs'), identifySuggestion.watering],
                            ] as [string, string, string][]).map(([label, current, suggested]) => (
                              <tr key={label} className={!current && suggested ? 'bg-green-50' : ''}>
                                <td className="px-3 py-2 font-medium text-gray-600">{label}</td>
                                <td className="px-3 py-2 text-gray-400 italic">
                                  {current || <span className="text-red-400">empty</span>}
                                </td>
                                <td className="px-3 py-2 text-gray-700">{suggested || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="px-3 py-2 text-[10px] text-gray-400 bg-gray-50">
                          Rows highlighted green = currently empty, will be filled.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="text-xs"
                          style={{ backgroundColor: '#2E7D32', color: 'white' }}
                          onClick={() => applyIdentification(true)}
                        >
                          ✓ Fill empty fields only (safe)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-xs text-amber-700 border-amber-300"
                          onClick={() => {
                            if (window.confirm('This will overwrite ALL fields listed above, including ones you have already filled in. Continue?')) {
                              applyIdentification(false)
                            }
                          }}
                        >
                          ⚠ Overwrite all fields
                        </Button>
                      </div>

                      {/* One-click Wikimedia fetch using the just-identified botanical name */}
                      {identifySuggestion.botanicalName && (
                        <div className="border-t pt-3">
                          <p className="text-xs text-gray-500 mb-2">
                            Now fetch flower, fruit, leaf, bark and root photos from Wikimedia using the identified name:
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={fetchingSubImages}
                            className="text-xs text-blue-700 border-blue-300"
                            onClick={() => handleFetchSubImages(identifySuggestion!.botanicalName)}
                          >
                            {fetchingSubImages ? 'Fetching…' : `🌐 Fetch sub-images for "${identifySuggestion.botanicalName}"`}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })()}

        {/* ── Plant Identity ───────────────────────────────────────────────── */}
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

        {/* ── Details ─────────────────────────────────────────────────────── */}
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

        {/* ── N/A image categories ─────────────────────────────────────────── */}
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
                    const parts   = current.split('|').filter(Boolean)
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

        {/* ── Sub-images ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-base font-semibold text-gray-700">Sub-Images (Wikimedia Commons)</h2>
            <Button type="button" variant="outline" disabled={fetchingSubImages}
              onClick={() => handleFetchSubImages()} className="text-xs">
              {fetchingSubImages ? 'Fetching…' : fetchedSubImages ? '🔄 Re-fetch' : '🌐 Fetch sub-images'}
            </Button>
          </div>

          {/* Status pills: show which categories have saved DB images */}
          {filledCategories(species).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(['flowers','fruits','leaves','bark','roots'] as const).map(cat => {
                const isSaved    = filledCategories(species).includes(cat)
                const hasFetched = fetchedSubImages && (fetchedSubImages[cat as keyof SubImages]?.length ?? 0) > 0
                return (
                  <span key={cat} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                    ${hasFetched ? 'bg-blue-100 text-blue-700' : isSaved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {hasFetched ? '↑' : isSaved ? '✓' : '○'} {cat}
                  </span>
                )
              })}
            </div>
          )}

          {!fetchedSubImages && filledCategories(species).length === 0 && (
            <p className="text-xs text-gray-400">
              No sub-images saved yet. Click "Fetch sub-images" to pull flower, fruit, leaf,
              bark and root photos from Wikimedia Commons (free, attribution included).
            </p>
          )}

          {/* Newly fetched images preview */}
          {fetchedSubImages && (
            <div className="space-y-4">
              {(Object.entries(fetchedSubImages) as [string, { url: string; attribution: string }[]][]).map(([cat, imgs]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</p>
                  {imgs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      {filledCategories(species).includes(cat) ? '✓ Existing image kept (not replaced)' : 'No images found'}
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {imgs.map(img => (
                        <div key={img.url} className="space-y-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={cat}
                            className="h-24 w-32 object-cover rounded-lg border border-gray-100" />
                          <p className="text-[10px] text-gray-400 max-w-[128px] truncate"
                            title={img.attribution}>{img.attribution}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-amber-600">↑ These will be saved when you click Save Changes below.</p>
            </div>
          )}
        </section>

        {/* ── Tentative flag ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tentative" {...register('tentative')} />
          <label htmlFor="tentative" className="text-sm text-gray-700">
            Mark as <strong>TENTATIVE</strong>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || photoProcessing}
            style={{ backgroundColor: '#2E7D32', color: 'white' }}>
            {saving ? 'Saving…' : photoProcessing ? 'Processing photo…' : 'Save Changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

// ── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Char-count textarea ──────────────────────────────────────────────────────
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
