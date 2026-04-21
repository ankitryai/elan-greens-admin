'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:  'Access is restricted to the authorised admin only.',
  auth_failed:   'Google sign-in failed. Please try again.',
  no_code:       'Sign-in was interrupted. Please try again.',
}

// Separated into its own component because useSearchParams() requires Suspense.
function LoginForm() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setLoading(false)
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-6">
      <div className="text-center space-y-1">
        <span style={{ fontFamily: 'Dancing Script, cursive', color: '#2E7D32', fontSize: 32, fontWeight: 700 }}>
          élan
        </span>
        <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">
          Admin Panel
        </p>
      </div>

      {errorCode && ERROR_MESSAGES[errorCode] && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {ERROR_MESSAGES[errorCode]}
        </div>
      )}

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
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 text-center text-gray-400 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
