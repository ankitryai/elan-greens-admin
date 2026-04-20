'use client'
// =============================================================================
// Elan Greens Admin — Login Page
//
// WHY 'use client'? The Google Sign-In button calls supabase.auth.signInWithOAuth
// which is a browser-side operation (it opens a redirect). Server Components
// cannot trigger browser navigations.
// =============================================================================

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Maps query param error codes to human-readable messages.
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:  'Access is restricted to the authorised admin only.',
  auth_failed:   'Google sign-in failed. Please try again.',
  no_code:       'Sign-in was interrupted. Please try again.',
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    // redirectTo must point to our callback handler which exchanges the code
    // for a session and performs the final email check.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      // If OAuth initiation fails (network issue etc.) reset loading state.
      setLoading(false)
    }
    // On success the browser navigates away — no further state update needed.
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-6">

        {/* Brand header */}
        <div className="text-center space-y-1">
          <span
            style={{ fontFamily: 'Dancing Script, cursive', color: '#2E7D32', fontSize: 32, fontWeight: 700 }}
          >
            élan
          </span>
          <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">
            Admin Panel
          </p>
        </div>

        {/* Error message */}
        {errorCode && ERROR_MESSAGES[errorCode] && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {ERROR_MESSAGES[errorCode]}
          </div>
        )}

        {/* Sign-in button */}
        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full"
          style={{ backgroundColor: '#2E7D32' }}
        >
          {loading ? 'Redirecting to Google…' : 'Sign in with Google'}
        </Button>

        <p className="text-xs text-gray-400 text-center">
          Access restricted to authorised society admin only.
        </p>
      </div>
    </main>
  )
}
