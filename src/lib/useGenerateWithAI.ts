'use client'
// =============================================================================
// "Generate with AI" hook — calls POST /api/generate-with-ai and applies the
// result to the form. Always fill-empty-only: the admin may already have
// typed the common/botanical name (required to trigger this at all), and any
// AI-drafted plant is saved as TENTATIVE for review, never silently
// overwriting something the admin already entered.
// =============================================================================

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { PlantSpeciesFormData } from '@/lib/validations'
import { AI_GENERATE_FIELDS, type AiGenerateResult } from '@/types'
import { sanitiseAiGenerateResult, hasAnyGeneratedField } from '@/lib/aiGenerate'

type FormMethods = ReturnType<typeof useForm<PlantSpeciesFormData>>

export function useGenerateWithAI({
  watch,
  setValue,
  imageBase64,
  imageUrl,
}: {
  watch: FormMethods['watch']
  setValue: FormMethods['setValue']
  /** Newly staged photo (data URL), if any — vision grounding is optional. */
  imageBase64: string | null
  /** Existing saved photo URL to use when no new photo has been staged (Edit form only). */
  imageUrl?: string | null
}) {
  const [generating, setGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<AiGenerateResult | null>(null)

  async function handleGenerateWithAI() {
    const commonName = (watch('common_name') ?? '').trim()
    const botanicalName = (watch('botanical_name') ?? '').trim()

    if (!commonName || !botanicalName.includes(' ')) {
      setGenerateStatus('Fill in the Common Name and full Botanical Name first.')
      return
    }

    setGenerating(true)
    setGenerateStatus('Asking Claude to draft the remaining fields…')
    setLastResult(null)

    try {
      const res = await fetch('/api/generate-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commonName,
          botanicalName,
          imageBase64: imageBase64 ?? undefined,
          imageUrl: (!imageBase64 && imageUrl) ? imageUrl : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setGenerateStatus(err.error ?? 'Generation failed — try again.')
        return
      }
      const result = sanitiseAiGenerateResult(await res.json())
      if (!hasAnyGeneratedField(result)) {
        setGenerateStatus('Claude returned no usable fields — fill in manually.')
        return
      }
      setLastResult(result)
      setValue('tentative', true)
      setGenerateStatus('✅ Draft ready — review the suggested fields below, then apply.')
    } catch {
      setGenerateStatus('Generation failed — check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  /** Applies the last draft. onlyEmpty mirrors the enrichment/Plant.id apply pattern. */
  function applyGeneratedResult(onlyEmpty: boolean) {
    if (!lastResult) return
    for (const field of AI_GENERATE_FIELDS) {
      const value = lastResult[field]
      if (value === null) continue
      const current = (watch(field) ?? '') as string
      if (!onlyEmpty || !current.trim()) {
        setValue(field, value as never)
      }
    }
    setLastResult(null)
    setGenerateStatus(null)
  }

  return {
    generating,
    generateStatus,
    lastResult,
    handleGenerateWithAI,
    applyGeneratedResult,
    dismissGeneratedResult: () => { setLastResult(null); setGenerateStatus(null) },
  }
}
