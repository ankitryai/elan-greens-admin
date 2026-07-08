import { getLandmarks } from '@/lib/queries'
import LandmarksClient from './LandmarksClient'

export const dynamic = 'force-dynamic'

export default async function LandmarksPage() {
  const landmarks = await getLandmarks('elan').catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Landmarks</h1>
        <p className="text-sm text-gray-500 mt-1">
          {landmarks.length} landmarks · used to tag plant locations on the map
        </p>
      </div>
      <LandmarksClient initialLandmarks={landmarks} />
    </div>
  )
}
