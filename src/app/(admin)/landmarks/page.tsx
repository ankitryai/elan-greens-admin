import { getLandmarks } from '@/lib/queries'
import LandmarksClient from './LandmarksClient'

export const dynamic = 'force-dynamic'

const PROPERTY_ID   = 'elan'
const PROPERTY_NAME = 'Divyasree Elan Homes'

export default async function LandmarksPage() {
  const landmarks = await getLandmarks(PROPERTY_ID).catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Landmarks</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 border border-green-200 text-green-800 px-2.5 py-1 rounded-full">
            🏢 {PROPERTY_NAME}
            <span className="text-green-500 font-normal">({PROPERTY_ID})</span>
          </span>
          <span className="text-sm text-gray-400">{landmarks.length} landmarks</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Each property has its own landmark set. Add new properties when you expand to SSEK or BSF+PPR.
        </p>
      </div>
      <LandmarksClient initialLandmarks={landmarks} propertyId={PROPERTY_ID} propertyName={PROPERTY_NAME} />
    </div>
  )
}
