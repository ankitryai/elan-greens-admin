// =============================================================================
// Elan Greens Admin — Admin Shell Layout
//
// This layout wraps all protected admin pages (dashboard, plants, staff).
// WHY a separate layout instead of putting the sidebar in the root layout?
// The login page must NOT show a sidebar. Route groups let us apply the
// sidebar only to the authenticated section without extra conditional logic.
// =============================================================================

import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

// Nav items — adding a new section only requires adding one entry here.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',    icon: '▦' },
  { href: '/plants',    label: 'Plants',        icon: '🌿' },
  { href: '/staff',     label: 'Green Team',    icon: '👐' },
] as const

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Double-check session in layout as a second line of defence after middleware.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">

        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-100">
          <span style={{ fontFamily: 'Dancing Script, cursive', color: '#2E7D32', fontSize: 26, fontWeight: 700 }}>
            élan
          </span>
          <span className="ml-2 text-xs text-gray-400 font-medium tracking-wide uppercase">admin</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sign-out form at the bottom of sidebar */}
        <div className="px-3 py-4 border-t border-gray-100">
          <SignOutButton />
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar (visible only on small screens) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <span style={{ fontFamily: 'Dancing Script, cursive', color: '#2E7D32', fontSize: 24, fontWeight: 700 }}>
            élan admin
          </span>
          <MobileMenu />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── SignOutButton ─────────────────────────────────────────────────────────────
// WHY a Server Action for sign-out? Supabase sign-out clears a cookie.
// Cookies can only be modified server-side in Next.js 16. A Client Component
// calling signOut() on the browser client would clear the local state but the
// cookie would persist — the middleware would still see the session.
function SignOutButton() {
  async function signOut() {
    'use server'
    const { createServerSupabaseClient } = await import('@/lib/supabase')
    const { redirect } = await import('next/navigation')
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-700 transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}

// ── MobileMenu ────────────────────────────────────────────────────────────────
// Simple mobile nav — just the links, no hamburger state needed for v1.
function MobileMenu() {
  return (
    <nav className="flex gap-4">
      {NAV_ITEMS.map(item => (
        <Link key={item.href} href={item.href} className="text-lg" title={item.label}>
          {item.icon}
        </Link>
      ))}
    </nav>
  )
}
