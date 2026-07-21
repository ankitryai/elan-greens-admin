'use client'
// =============================================================================
// Shared "Details" section — family/genus/toxicity/etc, description,
// medicinal properties, interesting fact, and (edit-only) internal notes.
// Rendered on both the Add page and the Edit form.
// =============================================================================

import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'
import { Field, CharCountInput, CharCountTextarea } from '@/components/PlantFormFields'

type FormMethods = ReturnType<typeof useForm<PlantSpeciesFormData>>

export function PlantDetailsSection({
  register,
  watch,
  setValue,
  errors,
  heading = 'Details',
  showNotes = false,
}: {
  register: FormMethods['register']
  watch: FormMethods['watch']
  setValue: FormMethods['setValue']
  errors: FormMethods['formState']['errors']
  heading?: string
  /** Internal Notes field only appears on the Edit form. */
  showNotes?: boolean
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-700 border-b pb-2">{heading}</h2>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Plant Family">
          <CharCountInput name="plant_family" register={register} watch={watch} max={100} placeholder="e.g. Acanthaceae" />
        </Field>
        <Field label="Genus">
          <CharCountInput name="genus" register={register} watch={watch} max={100} placeholder="e.g. Pseuderanthemum (auto-filled)" />
        </Field>
        <Field label="Toxicity" error={errors.toxicity?.message}>
          <CharCountInput name="toxicity" register={register} watch={watch} max={50} placeholder="e.g. Non-toxic" />
        </Field>
        <Field label="Edible Parts">
          <CharCountInput name="edible_parts" register={register} watch={watch} max={200} placeholder="e.g. Leaves, fruit" />
        </Field>
        <Field label="Native Region">
          <CharCountInput name="native_region" register={register} watch={watch} max={150} placeholder="e.g. South Asia" />
        </Field>
        <Field label="Sunlight" error={errors.sunlight_needs?.message}>
          <CharCountInput name="sunlight_needs" register={register} watch={watch} max={30} placeholder="e.g. Full Sun" />
        </Field>
        <Field label="Watering" error={errors.watering_needs?.message}>
          <CharCountInput name="watering_needs" register={register} watch={watch} max={20} placeholder="e.g. Low" />
        </Field>
      </div>

      <Field label="Lifespan" error={errors.life_span_description?.message}>
        <CharCountInput name="life_span_description" register={register} watch={watch} max={100} placeholder="e.g. 150–200 years" />
      </Field>

      <Field label="Description" error={errors.description?.message}>
        <CharCountTextarea name="description" register={register} setValue={setValue} max={500} watch={watch}
          placeholder="2–3 sentences about this plant." />
      </Field>

      <Field label="Medicinal / Ecological Properties" error={errors.medicinal_properties?.message}>
        <CharCountTextarea name="medicinal_properties" register={register} setValue={setValue} max={300} watch={watch}
          placeholder="Separate each property with | e.g. Treats fever | Reduces inflammation" />
      </Field>

      <Field label="Interesting Fact" error={errors.interesting_fact?.message}>
        <CharCountInput name="interesting_fact" register={register} watch={watch} max={300} placeholder="One-liner fun fact for residents" />
        <p className="text-[10px] text-gray-400 mt-0.5">Global plant fact (unrelated to where it grows at any property)</p>
      </Field>

      {showNotes && (
        <Field label="Internal Notes">
          <CharCountInput name="notes" register={register} watch={watch} max={300} />
        </Field>
      )}
    </section>
  )
}
