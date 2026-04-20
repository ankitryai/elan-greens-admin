// =============================================================================
// Elan Greens Admin — Supabase Client Factory
//
// WHY three separate client functions instead of one singleton?
// Each context (browser, server, service-role) needs a different cookie
// strategy. A single client would either expose the service-role key to the
// browser or fail to handle server-side cookie refresh correctly.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseDirectClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── 1. Browser client ────────────────────────────────────────────────────────
// Used in Client Components ('use client') for reading data.
// Uses the anon key — safe to be in the browser bundle because RLS restricts
// what this key can read/write.
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── 2. Server client ─────────────────────────────────────────────────────────
// Used in Server Components, Route Handlers, and Server Actions for session
// reads. Must be async because `cookies()` is async in Next.js 16.
// Still uses anon key — session is derived from the cookie, not the key.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component where cookies are read-only.
            // This is expected and safe to ignore — the middleware handles
            // session refresh for mutable contexts.
          }
        },
      },
    }
  )
}

// ── 3. Service-role client ───────────────────────────────────────────────────
// Used ONLY in Route Handlers and Server Actions that need to write to the DB.
// The service-role key bypasses RLS, so this must NEVER be imported in any
// file that ends up in the client bundle (i.e. never in 'use client' files).
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createSupabaseDirectClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
