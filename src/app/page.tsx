import { redirect } from 'next/navigation'

// Root URL → always bounce to the dashboard.
// The middleware handles auth: unauthenticated users are redirected to /login
// before this page ever renders, so whoever reaches here is already logged in.
export default function RootPage() {
  redirect('/dashboard')
}
