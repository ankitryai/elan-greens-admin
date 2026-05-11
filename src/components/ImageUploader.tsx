'use client'
// =============================================================================
// ImageUploader — Camera → Resize → Vision (auto) → Plant.id (explicit CTA)
//
// This is the most complex component in the admin app. Its job:
//   1. Accept a photo from camera or gallery
//   2. Resize it client-side before upload (saves storage)
//   3. Auto-call Google Vision (1 000/month, renews) — always fires on upload
//   4. Show an explicit "Identify with Plant.id" button — NEVER fires silently.
//      Plant.id has 100 lifetime credits total; must be a deliberate choice.
//   5. Call /api/fetch-images (Wikimedia Commons) with the identified name
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
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [visionResult, setVisionResult]   = useState<{ label: string | null; entities: string[] } | null>(null)
  // Holds the compressed base64 of the current photo so the explicit
  // Plant.id button can use it without re-reading the file.
  const [currentBase64, setCurrentBase64] = useState<string | null>(null)
  const [plantIdUsed, setPlantIdUsed]     = useState(() =>
    typeof window !== 'undefined' ? getApiCount('plantid') : 0
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('❌ Only JPEG, PNG, and WebP images are supported.')
      return
    }

    setIsProcessing(true)
    setVisionResult(null)
    setStatus('Resizing image…')
    setOriginalSize(file.size)

    // ── Step 1: Client-side resize ──────────────────────────────────────────
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 800,
      initialQuality: 0.75,
      useWebWorker: false,
    })
    setCompressedSize(compressed.size)

    const base64 = await toBase64(compressed)
    setPreview(base64)
    setCurrentBase64(base64)          // store for explicit Plant.id button
    setStorageRevision(r => r + 1)
    onImageReady(base64, storageRevision + 1)

    if (file.size > 2 * 1024 * 1024) {
      setStatus(`⚠️ Large image — resized from ${formatKB(file.size)} to ${formatKB(compressed.size)}.`)
    } else {
      setStatus(`✅ Saved ${formatKB(file.size)} → ${formatKB(compressed.size)}`)
    }

    // ── Step 2: Google Vision — always runs automatically ──────────────────
    // Vision has 1 000 free calls/month (renews). Plant.id is an explicit CTA.
    await runVisionFallback(base64)
  }

  // ── Explicit Plant.id identification (CTA button — never auto-fires) ──────
  async function handleIdentifyWithPlantId() {
    if (!currentBase64) return
    const used = getApiCount('plantid')
    if (used >= 100) {
      setStatus('⚠️ Plant.id lifetime limit reached (100/100). Purchase more credits at kindwise.com.')
      return
    }

    setIsIdentifying(true)
    setStatus('Identifying with Plant.id…')
    try {
      const res = await fetch('/api/identify-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: currentBase64.split(',')[1] }),
      })
      incrementApiCount('plantid')
      setPlantIdUsed(getApiCount('plantid'))

      if (!res.ok) throw new Error(`Plant.id responded with ${res.status}`)

      const data = await res.json() as { suggestions: PlantIdSuggestion[] }
      const top = data.suggestions?.[0]

      if (!top) {
        setStatus('Plant.id could not identify this image. Try Google Vision suggestions above, or enter details manually.')
        return
      }

      const confidence = Math.round(top.probability * 100)
      setStatus(`✅ Plant.id: "${top.plant_name}" (${confidence}% confidence). Fields updated — review before saving.`)
      onIdentified(buildResult(top, confidence))
      if (top.plant_name) await fetchSubImages(top.plant_name)

    } catch {
      setStatus('Plant.id request failed. Use the Vision suggestions above, or enter details manually.')
    } finally {
      setIsIdentifying(false)
    }
  }

  // ── Google Vision — primary auto-identification ───────────────────────────
  // Runs immediately on photo upload. 1 000 calls/month, renews monthly.
  async function runVisionFallback(base64: string) {
    const visionUsed = getApiCount('vision')
    if (visionUsed >= 1000) {
      setStatus('⚠️ Google Vision monthly limit reached (1 000/1 000). Use the Plant.id button below, or enter details manually.')
      setIsProcessing(false)
      return
    }

    setStatus(prev => `${prev} · Checking Google Vision…`)
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
      setStatus(prev =>
        prev.replace('· Checking Google Vision…', '') +
        ` · Google Vision suggests: "${label ?? entities[0] ?? 'unknown'}".`
      )

      // Fetch Wikimedia sub-images with Vision's best guess.
      const candidate = label ?? entities[0]
      if (candidate) await fetchSubImages(candidate)

    } catch {
      setStatus(prev => prev.replace('· Checking Google Vision…', '') + ' · Google Vision also failed. Enter details manually or use Plant.id below.')
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
        accept="image/jpeg,image/png,image/webp"
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

      {/* ── Explicit Plant.id CTA — never fires automatically ─────────────── */}
      {currentBase64 && (
        <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
          plantIdUsed >= 100
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <button
            type="button"
            onClick={handleIdentifyWithPlantId}
            disabled={isIdentifying || isProcessing || plantIdUsed >= 100}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              plantIdUsed >= 100
                ? 'bg-red-100 text-red-400 cursor-not-allowed'
                : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-60'
            }`}
          >
            {isIdentifying ? '🔍 Identifying…' : '🔬 Identify with Plant.id'}
          </button>
          <span className={`text-xs ${plantIdUsed >= 100 ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
            {plantIdUsed >= 100
              ? '⚠️ Lifetime limit reached (100/100) — credits must be purchased to reuse'
              : `${plantIdUsed}/100 lifetime credits used · more accurate than Vision`}
          </span>
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
