// Server-only Supabase clients — NEVER import this in 'use client' files.
//
// WHY a separate file from supabase.ts?
// `next/headers` (used by the server client) is only available in Server
// Components and Route Handlers. Putting it in the same file as the browser
// client caused Next.js to pull it into the client bundle, crashing the build.

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseDirectClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── Server client ─────────────────────────────────────────────────────────────
// For Server Components, Route Handlers, and Server Actions — reads the session
// cookie to identify the logged-in user.
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
            // Safe to ignore — the proxy handles session refresh.
          }
        },
      },
    }
  )
}

// ── Service-role client ───────────────────────────────────────────────────────
// Bypasses RLS — only for server-side writes (Route Handlers, Server Actions).
// NEVER import this in any 'use client' file.
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createSupabaseDirectClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
