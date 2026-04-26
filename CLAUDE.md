# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Elan Greens — Admin App

Password-protected admin panel for managing the Divyasree Elan Homes plant directory. Deployed at `elan-greens-admin.vercel.app`. Its read-only public counterpart is the `elan-greens` repo at `elan-greens.vercel.app`.

---

## Commands

```bash
# Local dev (corporate network needs TLS bypass)
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev

# Production build (always run before deploying)
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run build

# Deploy to Vercel production (CLI — do NOT use "Redeploy" in Vercel dashboard;
# that re-runs the old build and doesn't pick up new commits)
NODE_TLS_REJECT_UNAUTHORIZED=0 vercel --prod

# Tests
npm test                  # run all Vitest tests once
npm run test:watch        # watch mode

# Run a single test file
npx vitest run src/__tests__/formatters.test.ts
```

---

## Architecture

### Framework quirks — Next.js 16.2.4 (not 14/15)
This version has breaking changes vs earlier Next.js:
- **Middleware renamed**: `middleware.ts` exports `proxy`, not `middleware`
- **`ssr: false`** in `dynamic()` is only allowed inside `'use client'` files
- **`useSearchParams()`** must be wrapped in `<Suspense>`
- **`params`** in page/route handlers is a `Promise<{id: string}>` — always `await params`
- **`searchParams`** is also a Promise — always `await searchParams`

### Auth flow
Google OAuth via Supabase. Route protection is in `src/proxy.ts` (the middleware). Only `SUPERADMIN_EMAIL` (env var) is allowed past login. Every API route re-checks `user.email === process.env.SUPERADMIN_EMAIL` independently.

### Supabase clients — two separate files
| File | Client type | Use for |
|---|---|---|
| `src/lib/supabase.ts` | `createBrowserClient` (anon key) | Client components only |
| `src/lib/supabase.server.ts` | `createServerClient` (cookie-based) + `createServiceRoleClient` | Server components, API routes |

**Never import `supabase.server.ts` from a `'use client'` file** — it imports `next/headers` which is server-only. This was a hard-fought bug.

### Image uploads
All image processing uses **canvas-based compression** (no external library). `browser-image-compression` was removed because its `useWebWorker: true` option silently fails in production (Vercel blocks workers). The pattern is:

```ts
function compressToBase64(file: File): Promise<string> {
  // Creates Image → draws on canvas → returns canvas.toDataURL('image/jpeg', 0.8)
}
```

Storage filenames must use `/[^a-zA-Z0-9]/g → '_'` sanitisation. Special characters (em-dashes, spaces) in plant names cause Supabase `Invalid key` errors.

All API routes that upload to Storage then write to DB. If the DB write fails, the orphaned Storage file is deleted (rollback pattern). If the upload itself fails, an explicit HTTP 500 with the exact error is returned — no silent swallowing.

### Form error handling
Server errors must use `ErrorBanner` component (`src/components/ErrorBanner.tsx`), not auto-dismissing toasts. `toast.success` / `toast.warning` are fine for non-critical feedback. Pattern in all edit/add forms:

```tsx
const [serverError, setServerError] = useState<string | null>(null)
// in catch: setServerError(msg); window.scrollTo({ top: 0, behavior: 'smooth' })
// in JSX:  {serverError && <ErrorBanner message={serverError} onClose={() => setServerError(null)} />}
```

### Validation
Zod v4 + React Hook Form v5. Critical constraints:
- Use `z.boolean()` not `z.boolean().default(true)` — RHF v5 rejects default values on boolean fields
- Use `z.number()` not `z.coerce.number()` — coerce creates `unknown` input type causing resolver mismatch
- Schemas live in `src/lib/validations.ts` and are shared between client (form UX) and server (API route security)
- Empty strings from optional fields must be converted to `null` before DB writes: `v === '' ? null : v`

### Date formatting
- `formatDate(iso)` → `dd-mm-yyyy` (e.g. `20-04-2026`)
- `formatDateTime(iso)` → `dd-mm-yyyy, hh:mm AM/PM` (e.g. `20-04-2026, 02:30 PM`)
Both in `src/lib/formatters.ts`.

### Plant listing sort
URL-driven (`?sort=field&dir=asc|desc`). Default: `updated_at DESC`. Sortable fields: `plant_id`, `common_name`, `category`, `updated_at`. The search form carries hidden inputs for sort state.

### Storage buckets (Supabase)
Two public buckets must exist:
- `plant-images` — main plant photos + sub-images
- `staff-photos` — staff profile photos

Both must be set to **Public** in Supabase dashboard. Service role client is used for uploads (bypasses RLS).

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret key — server only, never expose to client |
| `SUPERADMIN_EMAIL` | Yes | Only this email can log in |
| `PLANT_ID_API_KEY` | Yes | Plant.id identification API |
| `GOOGLE_VISION_API_KEY` | Yes | Fallback vision API |

`NODE_TLS_REJECT_UNAUTHORIZED=0` in `.env.local` for local dev only (corporate SSL issue).

---

## Key lessons learned (do not repeat these mistakes)

1. **Vercel "Redeploy" button re-runs the previous build** — it does NOT pick up new Git commits. Always deploy via `vercel --prod` CLI or let GitHub auto-deploy trigger.
2. **`getAllSpecies` in the admin app fetches ALL species** including tentative/inactive. The public app's `getAllSpecies` filters to `active=true` only — different behaviour.
3. **Pipe-separated fields**: `not_applicable_parts` and `medicinal_properties` are stored as `"flowers|fruits|bark"`. Use `splitPipe()` from formatters to parse.
4. **Sub-images**: The DB has 20 image columns (`img_flower_1_url`, `img_flower_1_attr` … `img_root_2_url`, `img_root_2_attr`). They are cast via `as unknown as Record<string, string | null>` when accessed dynamically.
