'use client'
// =============================================================================
// Shared "Plant Identity" section — common name, botanical name (+ Populate
// from Name), local names, category/height, flowering type/season.
// Rendered identically on the Add page and the Edit form; extracted so field
// order, labels, and the Populate-from-Name UI never drift between the two.
// =============================================================================

import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, CharCountInput } from '@/components/PlantFormFields'

const CATEGORIES = ['Tree', 'Palm', 'Shrub', 'Herb', 'Creeper', 'Climber', 'Hedge', 'Grass'] as const
const HEIGHTS = ['Short', 'Medium', 'Tall'] as const
const FLOWERING = ['Flowering', 'Non-Flowering'] as const

type FormMethods = ReturnType<typeof useForm<PlantSpeciesFormData>>

export function PlantIdentitySection({
  register,
  watch,
  setValue,
  errors,
  populatingFromName,
  populateStatus,
  onPopulateFromName,
  defaultCategory,
  defaultHeight,
  defaultFlowering,
  heading = 'Plant Identity',
}: {
  register: FormMethods['register']
  watch: FormMethods['watch']
  setValue: FormMethods['setValue']
  errors: FormMethods['formState']['errors']
  populatingFromName: boolean
  populateStatus: string | null
  onPopulateFromName: () => void
  /** Edit form pre-selects the saved value; Add page leaves the Select unset. */
  defaultCategory?: string
  defaultHeight?: string
  defaultFlowering?: string
  heading?: string
}) {
  const watchedBotanical = watch('botanical_name')

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-700 border-b pb-2">{heading}</h2>

      <Field label="Common Name *" error={errors.common_name?.message}>
        <Input {...register('common_name')} placeholder="e.g. Neem Tree" />
      </Field>

      <Field label="Botanical Name" error={errors.botanical_name?.message}>
        <div className="flex gap-2 items-center">
          <Input {...register('botanical_name')} placeholder="e.g. Azadirachta indica" className="flex-1" />
          <Button
            type="button"
            variant="outline"
            disabled={!watchedBotanical?.trim().includes(' ') || populatingFromName}
            onClick={onPopulateFromName}
            className="shrink-0 text-xs text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-40"
            title="Fetch enrichment data and sub-images from free APIs using this botanical name"
          >
            {populatingFromName ? '⏳ Fetching…' : '🌿 Populate from Name'}
          </Button>
        </div>
        {watchedBotanical && !watchedBotanical.includes(' ') && (
          <p className="text-xs text-amber-500 mt-1">Enter the full two-word botanical name to enable.</p>
        )}
        {populateStatus && (
          <p className={`text-xs mt-1.5 px-2.5 py-1.5 rounded-lg border ${
            populateStatus.startsWith('✅')
              ? 'text-green-700 bg-green-50 border-green-100'
              : 'text-amber-700 bg-amber-50 border-amber-100'
          }`}>
            {populateStatus}
          </p>
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
          <Select
            defaultValue={defaultCategory}
            onValueChange={v => setValue('category', v as PlantSpeciesFormData['category'])}
          >
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Height" error={errors.height_category?.message}>
          <Select
            defaultValue={defaultHeight}
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
            defaultValue={defaultFlowering}
            onValueChange={v => setValue('flowering_type', v as PlantSpeciesFormData['flowering_type'])}
          >
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {FLOWERING.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Flowering Season" error={errors.flowering_season?.message}>
          <CharCountInput name="flowering_season" register={register} watch={watch} max={50} placeholder="e.g. Year-round" />
        </Field>
      </div>
    </section>
  )
}
