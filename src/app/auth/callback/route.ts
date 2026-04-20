// =============================================================================
// Elan Greens Admin — OAuth Callback Route Handler
//
// After Google redirects back here with a code, this handler exchanges the
// code for a Supabase session and sets the session cookie.
// WHY a Route Handler instead of a page? The browser must receive the Set-Cookie
// header in an HTTP response, not from React rendering. Only a Route Handler
// can set response headers directly.
// =============================================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    // No code means something went wrong on the Google/Supabase side.
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // One final email check at session creation time — belt and braces.
  if (data.user.email !== process.env.SUPERADMIN_EMAIL) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unauthorized`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
