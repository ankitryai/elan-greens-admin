// =============================================================================
// Elan Greens Admin — Route Protection Proxy (Next.js 16)
//
// Runs on EVERY request before the page renders.
// WHY proxy instead of checking auth inside each page?
// Proxy runs before the server function executes, so an unauthorised visitor
// never touches any page code or DB query.
//
// Two checks in sequence:
//   1. Is there a valid Supabase session?  → redirect to /login if not
//   2. Is the logged-in email the superadmin?  → sign out + redirect if not
// =============================================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow unauthenticated access to /login and /auth/* (OAuth callback)
  // Check this FIRST so a Supabase misconfiguration never blocks the login page.
  const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  // Start with a passthrough response so cookies can be read and refreshed.
  let response = NextResponse.next({ request })

  // Guard: if Supabase env vars are missing (e.g. CI build without secrets),
  // serve public routes normally and redirect everything else to login rather
  // than throwing a hard 500.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isPublicRoute) return response
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Refresh the session cookie on the request and response so the
            // browser always has an up-to-date JWT.
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // getUser() makes a network call to Supabase to verify the JWT.
    // We use getUser() (not getSession()) because getSession() trusts the
    // cookie without verifying it server-side — a security gap.
    const { data: { user } } = await supabase.auth.getUser()

    if (isPublicRoute) return response

    // No session → redirect to login
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      return NextResponse.redirect(loginUrl)
    }

    // Session exists but email doesn't match superadmin → reject and sign out.
    // WHY check email here AND in the login page? Defence in depth — if someone
    // shares a session cookie, the middleware catches it before any page loads.
    if (user.email !== process.env.SUPERADMIN_EMAIL) {
      await supabase.auth.signOut()
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }

    return response
  } catch {
    // Supabase unreachable or threw — serve public routes normally,
    // redirect everything else to login rather than crashing with 500.
    if (isPublicRoute) return response
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  // Run middleware on all routes except static assets and Next.js internals.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
