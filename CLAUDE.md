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

# Deploy — Vercel CLI is blocked on corporate network; push to GitHub instead
git push origin main   # triggers Vercel auto-deploy via GitHub integration
# Do NOT use the Vercel dashboard "Redeploy" button — it re-runs the old build

# Tests — ALWAYS run before committing; all tests must pass
npm test                  # run all Vitest tests once
npm run test:watch        # watch mode

# Run a single test file
npx vitest run src/__tests__/subImageHelpers.test.ts
```

---

## AI-Driven SDLC — Commit Checklist

Before every commit, Claude must verify all of the following. A commit that skips any step is incomplete.

### 1. Server / Client boundary (most common crash source)
- [ ] Every `'use client'` file imports types **only from `@/types`**, never from `@/app/api/*/route.ts` or `@/lib/supabase.server.ts`
- [ ] Run: `grep -r "from '@/app/api/" src/app/\(admin\) src/components --include="*.tsx" --include="*.ts"` — must return empty
- [ ] Run: `grep -r "from '@/lib/supabase.server'" src/components --include="*.tsx"` — must return empty

### 2. API response sanitisation
- [ ] Any function that passes external API JSON to React state goes through a sanitiser that:
  - Picks only the known keys (never `Object.entries` or `Object.values` on raw API responses)
  - Coerces every value to the expected type (array → always array, etc.)
- [ ] The sanitiser lives in `src/lib/` as a pure function
- [ ] A test exists for the crash scenario: pass in the real response shape *including* extra fields (`_debug`, pagination wrappers, nulls) and assert the output is safe

### 3. DB writes
- [ ] Every optional field is sanitised: `v === '' ? null : v` before reaching the DB
- [ ] Integer columns (`observations_count`) never receive an empty string — Postgres throws `invalid input syntax for type integer: ''`
- [ ] `friendlyDbError()` is present in every POST/PATCH route to return human-readable error messages

### 4. Tests — required for every new pure function
Any function that:
- Transforms API data before UI use → must have tests covering the happy path, null/empty input, and the specific crash scenario that motivated the function
- Maps form fields to DB columns → must have tests covering all field names, null slots, and max-item limits

New test files go in `src/__tests__/`. File naming: `<module>.test.ts`.

### 5. Pre-push sanity
```bash
npm test            # all tests green
# Build check is skipped locally — Google Fonts blocks on corporate network.
# Vercel will catch TypeScript errors at deploy time.
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

**Never import `supabase.server.ts` from a `'use client'` file** — it imports `next/headers` which is server-only.

### Where types live — strict rule

| What | Where |
|---|---|
| All shared interfaces (`PlantSpecies`, `EnrichmentResult`, `FetchDebug`, `NewsSource`, `NewsTopicQuery`, etc.) | `src/types/index.ts` |
| API route files | May `import type { X } from '@/types'` and `export type { X }` for callers that import from the route — never define types inline in route files |
| `'use client'` components | Import types from `@/types` only — **never** from `@/app/api/*/route.ts` |

**Why this rule exists:** API route files import `supabase.server` → `next/headers` (server-only). Importing even a `type` from a route file can pull the server module graph into the client bundle, crashing the page with a blank "This page couldn't load" screen and no useful error.

### Error boundaries
`src/app/(admin)/error.tsx` catches any runtime JS crash in an admin page and renders a red recovery UI with the error message, an Error ID, and "Try again / Back to Plants" buttons. This replaced the blank browser error screen.

Pattern: Next.js `error.tsx` files must be `'use client'` and receive `{ error, reset }` props.

### Settings page — `src/app/(admin)/settings/page.tsx`
Three sections, all using Server Actions (no API routes needed):

**Section 1 — News Sources** (`news_sources` table)
- Domain whitelist for the public news feed
- Toggle enabled/disabled, set priority 0–10, delete, add new
- `SourceRow` sub-component handles one row

**Section 2 — News Settings** (`app_settings` table)
- Numeric knobs: max articles, plant tags, plants queried, per-plant cap, max age days, cache hours
- `SettingRow` sub-component handles one row

**Section 3 — Topic Queries** (`news_topic_queries` table)
- Admin-configurable RSS search terms for community/landscaping topics
- Each row: `query_text` (RSS search string), `chip_label`, `chip_icon`, `enabled`, `priority`
- Toggle, set priority, delete, add new
- `TopicQueryRow` sub-component handles one row
- Blue-tinted add form (vs green for news sources) to distinguish the two sections visually

**Server Actions pattern** — all mutations inline in the page file, no separate API routes:
```tsx
async function myAction(formData: FormData) {
  'use server'
  const value = formData.get('field') as string
  await someQueryFn(value)
  revalidatePath('/settings')
}
```

**Query functions** for settings are in `src/lib/queries.ts`:
- `getNewsSources` / `addNewsSource` / `updateNewsSource` / `deleteNewsSource`
- `getAppSettings` / `updateAppSetting`
- `getNewsTopicQueries` / `addNewsTopicQuery` / `updateNewsTopicQuery` / `deleteNewsTopicQuery`

### Sub-image pipeline (fetch → review → save)

The admin edit form (`src/app/(admin)/plants/[id]/edit/EditSpeciesForm.tsx`) has a full sub-image workflow:

**Fetching** — `GET /api/fetch-images?name=<botanical>&common=<common>`
- Tries Wikimedia Commons first (botanical+keyword, botanical alone, common+keyword)
- Falls back to iNaturalist with annotation filters (term 12/13 = Flowers, 12/14 = Fruits, 36/38 = Leaves; bark/roots have no annotation)
- iNaturalist: tries exact species first, then genus-level fallback
- Returns `{ flowers, fruits, leaves, bark, roots, _debug }` — `_debug` contains `{ source, query, level? }` per category

**CRITICAL — always sanitise before use:**
The response contains `_debug` (a plain object, not an array). Never pass raw API JSON to React state or components. Always call `sanitiseSubImages()` from `src/lib/subImageHelpers.ts` first:
```ts
const imgs = sanitiseSubImages(await res.json() as Record<string, unknown>)
```
Passing raw JSON caused "r.map is not a function" crashes in production (the `_debug` object was iterated as if it were an image array).

**Debug provenance** — `FetchDebug` defined in `src/types/index.ts`, re-exported from the route
- `source: 'wikimedia' | 'inaturalist' | 'none'`
- `query`: the search string that produced results
- `level?: 'species' | 'genus'` (iNaturalist only)
- When `level === 'genus'` an **amber subspecies-mismatch warning** is shown — genus-level results are often a different species

**Sub-image helper utilities** — `src/lib/subImageHelpers.ts`
All pure functions. 16 unit tests in `src/__tests__/subImageHelpers.test.ts`.
- `sanitiseSubImages(raw)` — strips unknown fields, guarantees every key is an array
- `hasAnySubImages(imgs)` — true if at least one category has images
- `buildSubImageFields(imgs)` — flattens to 20 DB column fields
- `IMAGE_PART_KEYS` — `['flowers','fruits','leaves','bark','roots']` — use this to iterate, never `Object.entries(subImages)`

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

### Enrichment pipeline (Populate from Name)

`GET /api/fetch-enrichment?name=<botanical>` fires GBIF + POWO + iNaturalist + IUCN in parallel.
- Available on both the **Add** page (🌿 Populate from Name button next to Botanical Name) and the **Edit** page
- Button stays disabled until the botanical name contains at least two words (full binomial)
- Result type: `EnrichmentResult` — defined in `src/types/index.ts`
- Fields filled: `foliage_type`, `conservation_status`, `observations_count`, `growth_rate`, `propagation_methods`, `habitat_type`
- Always call both `/api/fetch-enrichment` and `/api/fetch-images` in `Promise.all` — two parallel fetches, one status message

### Plant.id / Google Vision identification

**Credit limits (hard constraints — never change these):**
- **Plant.id: 100 lifetime credits total** — NOT per month, they do NOT reset. Never auto-fire. Only fires when admin deliberately clicks "🔬 Identify with Plant.id".
- **Google Vision: 1 000 free calls/month** — renews monthly. Auto-fires on every photo upload.

**Flow:**
1. Admin uploads photo → Google Vision auto-fires → suggestions shown as chips
2. Admin optionally clicks "🔬 Identify with Plant.id" — explicit CTA only
3. Either result can trigger Wikimedia sub-image fetch

Counter stored in `localStorage` via `src/components/ApiCounter.ts` (`incrementApiCount` / `getApiCount`).

### Image uploads
All image processing uses **canvas-based compression** (no external library). `browser-image-compression` was removed because its `useWebWorker: true` option silently fails in production (Vercel blocks workers). The pattern is:

```ts
function compressToBase64(file: File): Promise<string> {
  // Creates Image → draws on canvas → returns canvas.toDataURL('image/jpeg', 0.8)
}
```

Accepted formats: **JPEG, PNG, WebP** — all three must be in both the `accept` attribute and the file-type guard array.

Storage filenames must use `/[^a-zA-Z0-9]/g → '_'` sanitisation. Special characters (em-dashes, spaces) in plant names cause Supabase `Invalid key` errors.

All API routes that upload to Storage then write to DB. If the DB write fails, the orphaned Storage file is deleted (rollback pattern).

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
- Integer columns (`observations_count`) must never receive `''` — Postgres throws `invalid input syntax for type integer`

### DB error messages
Every POST/PATCH API route must contain `friendlyDbError()` that maps cryptic Postgres messages to exact field names. Current mappings in `src/app/api/plants/route.ts` and `src/app/api/plants/[id]/route.ts`:

```ts
function friendlyDbError(msg: string): string {
  if (msg.includes('invalid input syntax for type integer'))
    return 'Field "iNat Observations (observations_count)" must be a whole number or left blank.'
  // ... other patterns
}
```

### Linked species (bidirectional)
`plant_species_links` table: one row covers both directions via `LEAST()/GREATEST()` unique index.
- Queries use `OR` on both FK columns: `species_a_id = id OR species_b_id = id`
- Application code identifies the "other" species by comparing `species_a_id` to the current species ID
- RLS: `FOR SELECT USING (true)` required for public app anon reads
- Fixed label set — do not allow free text to keep display consistent

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

### Supabase tables managed by admin app
| Table | RLS read | Admin writes via |
|---|---|---|
| `plant_species` | anon SELECT (active only) | API routes (`/api/plants`) |
| `plant_instances` | anon SELECT | API routes |
| `staff_data` | anon SELECT | API routes |
| `plant_species_links` | anon SELECT | API routes |
| `news_sources` | anon SELECT | Settings page Server Actions |
| `app_settings` | anon SELECT | Settings page Server Actions |
| `news_topic_queries` | anon SELECT | Settings page Server Actions |

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

1. **Vercel "Redeploy" button re-runs the previous build** — it does NOT pick up new Git commits. Always deploy via `git push origin main` and let Vercel auto-deploy from the GitHub integration. The `vercel --prod` CLI is also blocked on the corporate network.

2. **`getAllSpecies` in the admin app fetches ALL species** including tentative/inactive. The public app's `getAllSpecies` filters to `active=true` only — different behaviour.

3. **Pipe-separated fields**: `not_applicable_parts` and `medicinal_properties` are stored as `"flowers|fruits|bark"`. Use `splitPipe()` from formatters to parse.

4. **Sub-images**: The DB has 20 image columns (`img_flower_1_url`, `img_flower_1_attr` … `img_root_2_url`, `img_root_2_attr`). They are cast via `as unknown as Record<string, string | null>` when accessed dynamically.

5. **`NEXT_PUBLIC_*` vars must be present during `vercel build --prod`** in CI — they are baked into the JS bundle at build time, not injected at runtime.

6. **`buildSubImageFields` must skip empty arrays** — never send `null` for a category just because the fetch returned 0 results. Only write fields for categories where new images were actually found, otherwise existing DB values get silently wiped.

7. **iNaturalist genus-level fallback produces wrong-species images** — when `level === 'genus'` in `FetchDebug`, the photos are from a sibling species. Always show the amber warning.

8. **Deleting DB image slots requires explicit `null` in the PATCH body** — omitting a key leaves the DB value unchanged.

9. **`proxy.ts` middleware must guard against missing env vars** — wrap all Supabase calls in try/catch and check for `NEXT_PUBLIC_SUPABASE_URL` upfront. Public routes (`/login`, `/auth/*`) must always be served even when Supabase is misconfigured.

10. **Never import types from API route files in `'use client'` components** — even `import type` can pull the server module graph into the client bundle when the route file imports `supabase.server` or `next/headers`. All shared types belong in `src/types/index.ts`. This crashed `/plants/new` and `/plants/[id]/edit` in production (blank page, no error shown).

11. **Never pass raw `/api/fetch-images` JSON to React state** — the response includes `_debug` (a plain object). Iterating it as an image array causes "x.map is not a function". Always call `sanitiseSubImages()` first. A test for this exact crash scenario exists in `subImageHelpers.test.ts`.

12. **Never use `Object.entries()` or `Object.values()` on API response objects** — use a fixed key list (`IMAGE_PART_KEYS`) so unknown fields are silently ignored rather than causing runtime crashes.

13. **Local `npm run build` fails on corporate network** (Google Fonts fetch timeout). This is expected — do not attempt to fix it. Vercel builds succeed because it has unrestricted network access. Run `npm test` locally instead to verify correctness before pushing.

14. **Plant.id has 100 LIFETIME credits, not monthly** — they never reset. Never auto-fire the Plant.id API. Always require an explicit admin click. Google Vision (1 000/month, renews) is the auto-firing fallback.

15. **Server Actions are the right pattern for simple admin mutations** — the Settings page uses Server Actions inline (no API routes) for all CRUD on `news_sources`, `app_settings`, `news_topic_queries`. This avoids the overhead of API routes + fetch calls for admin-only forms where auth is already guaranteed by the middleware. Always call `revalidatePath('/settings')` at the end of each action to refresh the page.

16. **Adding a new admin-configurable table** — the pattern is:
    1. Add TypeScript interface to `src/types/index.ts`
    2. Add CRUD functions to `src/lib/queries.ts` (import the new type there)
    3. Add section to `src/app/(admin)/settings/page.tsx` with Server Actions + a `XxxRow` sub-component
    4. Write the SQL migration file in the `elan-greens` repo root and instruct user to run it in Supabase SQL Editor
