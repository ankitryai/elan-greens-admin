'use client'
// =============================================================================
// Shared field-rendering helpers for the plant species form.
// Used by both the Add page (plants/new/page.tsx) and the Edit form
// (plants/[id]/edit/EditSpeciesForm.tsx) — extracted so the two forms don't
// drift out of sync with copy-pasted JSX.
// =============================================================================

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function CharCountInput({
  name, register, watch, max, placeholder,
}: {
  name: keyof PlantSpeciesFormData
  register: ReturnType<typeof useForm<PlantSpeciesFormData>>['register']
  watch: ReturnType<typeof useForm<PlantSpeciesFormData>>['watch']
  max: number
  placeholder?: string
}) {
  const value = String(watch(name) ?? '')
  const over  = value.length > max
  return (
    <div>
      <Input {...register(name)} placeholder={placeholder} maxLength={max} />
      <p className={`text-[11px] mt-0.5 text-right ${over ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {value.length} / {max}
      </p>
    </div>
  )
}

export function CharCountTextarea({
  name, register, setValue, watch, max, placeholder,
}: {
  name: keyof PlantSpeciesFormData
  register: ReturnType<typeof useForm<PlantSpeciesFormData>>['register']
  setValue: ReturnType<typeof useForm<PlantSpeciesFormData>>['setValue']
  watch: ReturnType<typeof useForm<PlantSpeciesFormData>>['watch']
  max: number
  placeholder?: string
}) {
  const value = (watch(name) as string) ?? ''
  return (
    <div>
      <Textarea {...register(name)} placeholder={placeholder} rows={3} maxLength={max} />
      <p className={`text-xs mt-1 text-right ${value.length > max ? 'text-red-500' : 'text-gray-400'}`}>
        {value.length} / {max}
      </p>
    </div>
  )
}
