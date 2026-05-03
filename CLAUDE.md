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

### Sub-image pipeline (fetch → review → save)

The admin edit form (`src/app/(admin)/plants/[id]/edit/EditSpeciesForm.tsx`) has a full sub-image workflow:

**Fetching** — `GET /api/fetch-images?name=<botanical>&common=<common>`
- Tries Wikimedia Commons first (botanical+keyword, botanical alone, common+keyword)
- Falls back to iNaturalist with annotation filters (term 12/13 = Flowers, 12/14 = Fruits, 36/38 = Leaves; bark/roots have no annotation)
- iNaturalist: tries exact species first, then genus-level fallback
- Returns `{ flowers, fruits, leaves, bark, roots, _debug }` — `_debug` contains `{ source, query, level? }` per category

**Debug provenance** — `FetchDebug` exported from `src/app/api/fetch-images/route.ts`
- `source: 'wikimedia' | 'inaturalist' | 'none'`
- `query`: the search string that produced results
- `level?: 'species' | 'genus'` (iNaturalist only)
- When `level === 'genus'` an **amber subspecies-mismatch warning** is shown — genus-level results are often a different species (e.g. Eranthemum nervosum vs Eranthemum purpurascens)

**Reviewing fetched images**
- Each fetched thumbnail has a hover `×` button — removes just that image from the pending save
- "✕ Reject all fetched" button per category — clears the entire fetch for that category

**Deleting saved DB images**
- Each saved (green-bordered) thumbnail has a hover 🗑 button
- Clicking marks the slot for deletion — image dims to 30% opacity, shows "Will be deleted" overlay + Undo link
- Category label changes to "🗑 will be deleted on save" when all slots are marked
- State: `deletedSaved: Set<string>` where keys are `"<category>_<slot>"` e.g. `"bark_1"`

**Save merge order** (lowest → highest priority, later wins):
1. `deletedFields` — explicit nulls for deleted saved slots
2. `buildManualImageFields` — pasted URLs (only where fetch found nothing)
3. `buildSubImageFields(fetchedSubImages)` — fresh fetch images (never nulls empty categories)

**iNaturalist annotation IDs** (controlled terms):
```
term_id=12, term_value_id=13  → Flowers
term_id=12, term_value_id=14  → Fruits or Seeds
term_id=36, term_value_id=38  → Green Leaves
bark / roots                  → no annotation (general search)
```

### Plant.id re-identification panel
- Collapsed by default in the edit form
- Primary action: sends the **existing saved photo URL** directly to Plant.id (`imageUrl` field) — no re-upload needed. Plant.id v2 fetches public URLs server-side.
- Secondary: upload a different photo (`imageBase64`)
- API call counter stored in `localStorage` per calendar month via `src/components/ApiCounter.ts` (`incrementApiCount` / `getApiCount`)
- Limit: 100 calls/month. Counter shown in panel header (green → amber at ≤10 → red at 0)
- After identification: one-click "🌐 Fetch sub-images for '<botanical name>'" button uses the identified name immediately (before saving the form)
- `applyIdentification(onlyEmpty: boolean)` — fills only empty fields (safe) or overwrites all (with confirm)

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
5. **`NEXT_PUBLIC_*` vars must be present during `vercel build --prod`** in CI — they are baked into the JS bundle at build time, not injected at runtime. If missing, all pages throw 500. Pass them explicitly in the GitHub Actions build step.
6. **`buildSubImageFields` must skip empty arrays** — never send `null` for a category just because the fetch returned 0 results. Only write fields for categories where new images were actually found, otherwise existing DB values get silently wiped.
7. **iNaturalist genus-level fallback produces wrong-species images** — when `level === 'genus'` in `FetchDebug`, the photos are from a sibling species, not the exact plant. Always show the amber subspecies-mismatch warning and let the admin reject before saving.
8. **Deleting DB image slots requires explicit `null` in the PATCH body** — omitting a key leaves the DB value unchanged. To clear a saved image, explicitly pass `{ img_bark_1_url: null, img_bark_1_attr: null }`.
9. **`proxy.ts` middleware must guard against missing env vars** — wrap all Supabase calls in try/catch and check for `NEXT_PUBLIC_SUPABASE_URL` upfront. Public routes (`/login`, `/auth/*`) must always be served even when Supabase is misconfigured.
