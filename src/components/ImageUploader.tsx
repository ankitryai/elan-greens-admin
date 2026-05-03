'use client'
// =============================================================================
// ImageUploader — Camera → Resize → Plant.id → Wikimedia → Preview
//
// This is the most complex component in the admin app. Its job:
//   1. Accept a photo from camera or gallery
//   2. Resize it client-side before upload (saves storage)
//   3. Call /api/identify-plant (Plant.id) → fill species fields if confident
//   4. If confidence < 70% or quota hit → call /api/vision-fallback
//   5. Call /api/fetch-images (Wikimedia Commons) with the botanical name
//   6. Show the admin a preview of all results for review before saving
//
// WHY client component? Camera input, EXIF reading, image compression, and
// live preview are all browser APIs that cannot run on the server.
// =============================================================================

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import StorageMeter from '@/components/StorageMeter'
import ApiCounter, { incrementApiCount, getApiCount } from '@/components/ApiCounter'
import type { WikimediaImage, PlantIdSuggestion } from '@/types'

// What the parent form needs from the identification result
export interface IdentificationResult {
  suggestion: PlantIdSuggestion | null
  confidence: number | null
  // Pre-fills for the species form
  commonName?: string
  botanicalName?: string
  family?: string
  genus?: string
  edibleParts?: string
  description?: string
}

export interface SubImages {
  flowers: WikimediaImage[]
  fruits:  WikimediaImage[]
  leaves:  WikimediaImage[]
  bark:    WikimediaImage[]
  roots:   WikimediaImage[]
}

interface ImageUploaderProps {
  onImageReady: (base64: string, storageRevision: number) => void
  onIdentified: (result: IdentificationResult) => void
  onSubImagesReady: (images: SubImages) => void
}

export default function ImageUploader({
  onImageReady,
  onIdentified,
  onSubImagesReady,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]             = useState<string | null>(null)
  const [originalSize, setOriginalSize]   = useState<number>(0)
  const [compressedSize, setCompressedSize] = useState<number>(0)
  const [storageRevision, setStorageRevision] = useState(0)
  const [status, setStatus]               = useState<string>('')
  const [isProcessing, setIsProcessing]   = useState(false)
  const [visionResult, setVisionResult]   = useState<{ label: string | null; entities: string[] } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setStatus('❌ Only JPEG and PNG images are supported.')
      return
    }

    setIsProcessing(true)
    setStatus('Resizing image…')
    setOriginalSize(file.size)

    // ── Step 1: Client-side resize ──────────────────────────────────────────
    // Max 800px wide, 75% quality — reduces storage use without visible quality loss.
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 800,
      initialQuality: 0.75,
      useWebWorker: false,
    })
    setCompressedSize(compressed.size)

    if (file.size > 2 * 1024 * 1024) {
      setStatus(`⚠️ Large image detected. Resized from ${formatKB(file.size)} to ${formatKB(compressed.size)}.`)
    } else {
      setStatus(`✅ Resized: ${formatKB(file.size)} → ${formatKB(compressed.size)}`)
    }

    // Convert to base64 for API calls and preview
    const base64 = await toBase64(compressed)
    setPreview(base64)
    setStorageRevision(r => r + 1)
    onImageReady(base64, storageRevision + 1)

    // ── Step 2: Plant.id identification ────────────────────────────────────
    const plantIdUsed = getApiCount('plantid')
    if (plantIdUsed >= 100) {
      setStatus('Plant.id quota reached for this month. Trying Google Vision…')
      await runVisionFallback(base64)
      return
    }

    setStatus('Identifying plant with Plant.id…')
    try {
      const res = await fetch('/api/identify-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64.split(',')[1] }),
      })
      incrementApiCount('plantid')

      if (!res.ok) throw new Error(`Plant.id responded with ${res.status}`)

      const data = await res.json() as { suggestions: PlantIdSuggestion[] }
      const top = data.suggestions?.[0]

      if (!top) {
        setStatus('Plant.id could not identify this image. Trying Google Vision…')
        await runVisionFallback(base64)
        return
      }

      const confidence = Math.round(top.probability * 100)

      if (top.probability < 0.70) {
        setStatus(
          `Plant.id suggests "${top.plant_name}" (${confidence}% confidence — low). Trying Google Vision…`
        )
        // Still pass the Plant.id result to the parent as a hint, then get Vision result too.
        onIdentified(buildResult(top, confidence))
        await runVisionFallback(base64)
      } else {
        setStatus(`✅ Plant.id identified: "${top.plant_name}" (${confidence}% confidence). Review fields below.`)
        onIdentified(buildResult(top, confidence))
        // Trigger Wikimedia image fetch automatically with the botanical name.
        if (top.plant_name) await fetchSubImages(top.plant_name)
      }

    } catch (err) {
      setStatus('Plant.id failed. Trying Google Vision…')
      await runVisionFallback(base64)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Google Vision fallback ────────────────────────────────────────────────
  async function runVisionFallback(base64: string) {
    const visionUsed = getApiCount('vision')
    if (visionUsed >= 1000) {
      setStatus('⚠️ Both Plant.id and Google Vision quotas exhausted. Please enter plant details manually.')
      setIsProcessing(false)
      return
    }

    setStatus('Checking Google Vision…')
    try {
      const res = await fetch('/api/vision-fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64.split(',')[1] }),
      })
      incrementApiCount('vision')

      if (!res.ok) throw new Error()
      const data = await res.json() as { bestGuessLabel: string | null; webEntities: { description: string }[] }

      const label = data.bestGuessLabel
      const entities = data.webEntities.map(e => e.description).filter(Boolean)
      setVisionResult({ label, entities })
      setStatus(
        `Google Vision suggests: "${label ?? entities[0] ?? 'unknown'}". Review and confirm below.`
      )

      // If Vision gave us something useful, try Wikimedia with it.
      const candidate = label ?? entities[0]
      if (candidate) await fetchSubImages(candidate)

    } catch {
      setStatus('Google Vision also failed. Please enter plant details manually.')
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Wikimedia sub-image fetch ─────────────────────────────────────────────
  async function fetchSubImages(botanicalName: string) {
    setStatus(prev => prev + ' Fetching plant images from Wikimedia…')
    try {
      const res = await fetch(`/api/fetch-images?name=${encodeURIComponent(botanicalName)}`)
      if (!res.ok) return
      const data = await res.json() as SubImages
      onSubImagesReady(data)
      setStatus(prev => prev.replace('Fetching plant images from Wikimedia…', '✅ Images fetched from Wikimedia.'))
    } catch {
      // Non-critical — images just won't be pre-filled; admin can add manually
    }
  }

  return (
    <div className="space-y-4">
      {/* Camera / gallery input — capture="environment" opens rear camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click() } }}
          disabled={isProcessing}
        >
          📁 Choose from gallery
        </Button>
        <Button
          type="button"
          onClick={() => { if (inputRef.current) { inputRef.current.setAttribute('capture', 'environment'); inputRef.current.click() } }}
          disabled={isProcessing}
          style={{ backgroundColor: '#2E7D32', color: 'white' }}
        >
          📷 Take photo
        </Button>
      </div>

      {/* Status message */}
      {status && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {status}
        </p>
      )}

      {/* Photo preview */}
      {preview && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Plant photo preview" className="h-48 w-auto rounded-lg object-contain border" />
          {compressedSize > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Saved {formatKB(originalSize - compressedSize)} · final size {formatKB(compressedSize)}
            </p>
          )}
        </div>
      )}

      {/* Google Vision fallback suggestion chips */}
      {visionResult && (visionResult.label || visionResult.entities.length > 0) && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Google Vision suggestions (click to use as botanical name):</p>
          <div className="flex flex-wrap gap-2">
            {[visionResult.label, ...visionResult.entities].filter(Boolean).map(name => (
              <button
                key={name}
                type="button"
                className="px-3 py-1 text-xs bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100"
                onClick={() => name && fetchSubImages(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <a
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(visionResult.label ?? visionResult.entities[0] ?? '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline"
          >
            Search on Google Images →
          </a>
        </div>
      )}

      {/* API usage counters */}
      <ApiCounter />

      {/* Storage meter */}
      <StorageMeter revision={storageRevision} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatKB(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`
}

function buildResult(top: PlantIdSuggestion, confidence: number): IdentificationResult {
  return {
    suggestion: top,
    confidence,
    commonName:    top.plant_details?.common_names?.[0] ?? undefined,
    botanicalName: top.plant_name ?? undefined,
    family:        top.plant_details?.taxonomy?.family ?? undefined,
    genus:         top.plant_details?.taxonomy?.genus ?? undefined,
    edibleParts:   top.plant_details?.edible_parts?.join(', ') ?? undefined,
    description:   top.plant_details?.wiki_description?.value?.slice(0, 500) ?? undefined,
  }
}
