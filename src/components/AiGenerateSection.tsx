'use client'
// =============================================================================
// Shared "Generate with AI" section — draft the remaining plant fields from
// botanical name + common name (+ optional photo) via Claude, then review a
// diff table before applying. Rendered on both the Add page and Edit form.
// =============================================================================

import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'
import { AI_GENERATE_FIELDS, type AiGenerateResult } from '@/types'
import { Button } from '@/components/ui/button'

type FormMethods = ReturnType<typeof useForm<PlantSpeciesFormData>>

const FIELD_LABELS: Record<string, string> = {
  hindi_name: 'Hindi', kannada_name: 'Kannada', tamil_name: 'Tamil',
  category: 'Category', height_category: 'Height', flowering_type: 'Flowering Type',
  flowering_season: 'Flowering Season', description: 'Description',
  medicinal_properties: 'Medicinal / Ecological Properties', plant_family: 'Plant Family',
  genus: 'Genus', toxicity: 'Toxicity', edible_parts: 'Edible Parts',
  native_region: 'Native Region', sunlight_needs: 'Sunlight', watering_needs: 'Watering',
  interesting_fact: 'Interesting Fact', life_span_description: 'Lifespan',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
}

export function AiGenerateSection({
  watch,
  hasImage,
  generating,
  generateStatus,
  lastResult,
  onGenerate,
  onApply,
  onDismiss,
}: {
  watch: FormMethods['watch']
  hasImage: boolean
  generating: boolean
  generateStatus: string | null
  lastResult: AiGenerateResult | null
  onGenerate: () => void
  onApply: (onlyEmpty: boolean) => void
  onDismiss: () => void
}) {
  const commonName = (watch('common_name') ?? '').trim()
  const botanicalName = (watch('botanical_name') ?? '').trim()
  const canGenerate = !!commonName && botanicalName.includes(' ') && !generating

  const rows = lastResult
    ? AI_GENERATE_FIELDS
        .filter(f => lastResult[f] !== null)
        .map(f => ({
          field: f,
          label: FIELD_LABELS[f] ?? f,
          current: (watch(f) ?? '').toString(),
          suggested: lastResult[f] as string,
          confidence: lastResult._confidence[f],
        }))
    : []

  return (
    <section className="border border-purple-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-purple-50 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-purple-800">✨ Generate with AI</p>
          <p className="text-[11px] text-purple-500 mt-0.5">
            Drafts the remaining fields from the name{hasImage ? ' and photo' : ''} — always reviewed before saving, saved as TENTATIVE.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!canGenerate}
          onClick={onGenerate}
          className="shrink-0 text-xs text-purple-700 border-purple-300 hover:bg-purple-100 disabled:opacity-40"
          title={!commonName || !botanicalName.includes(' ') ? 'Fill in Common Name and full Botanical Name first' : undefined}
        >
          {generating ? '⏳ Generating…' : '✨ Generate'}
        </Button>
      </div>

      {generateStatus && !lastResult && (
        <p className={`text-xs px-4 py-2 ${generateStatus.startsWith('✅') ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
          {generateStatus}
        </p>
      )}

      {lastResult && rows.length > 0 && (
        <div className="p-4 space-y-3 bg-white">
          <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-32">Field</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Current</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Claude suggests</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.field} className={!r.current && r.suggested ? 'bg-green-50' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-600">{r.label}</td>
                    <td className="px-3 py-2 text-gray-400 italic">
                      {r.current || <span className="text-red-400">empty</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.suggested}</td>
                    <td className="px-3 py-2">
                      {r.confidence && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLE[r.confidence]}`}>
                          {r.confidence}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50">
              Rows highlighted green = currently empty, will be filled. Low-confidence fields (local names, medicinal claims) need the closest review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="text-xs" style={{ backgroundColor: '#2E7D32', color: 'white' }}
              onClick={() => onApply(true)}>
              ✓ Fill empty fields only (safe)
            </Button>
            <Button type="button" variant="outline" className="text-xs text-amber-700 border-amber-300"
              onClick={() => {
                if (window.confirm('This will overwrite ALL fields listed above, including ones already filled. Continue?')) {
                  onApply(false)
                }
              }}>
              ⚠ Overwrite all
            </Button>
            <Button type="button" variant="outline" className="text-xs" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
