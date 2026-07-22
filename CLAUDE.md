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
- [ ] **Any component with `onClick`, `onChange`, or other event handlers must be in a `'use client'` file** — even if the component is simple. Never define interactive sub-components in the same file as Server Actions (inline `'use server'`). Move them to a separate `XxxRows.tsx` / `XxxClient.tsx` with `'use client'` at the top.
- [ ] **Never add a second `import { ... } from '@/lib/queries'` or `import type { ... } from '@/types'` line** — always extend the existing import. Duplicate imports in a file containing Server Actions break Next.js's static Server Action registration, causing a React serialisation error on the event handlers of OTHER components in the page.

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

### 4. Tests — required for every new pure function and API route
Any function that:
- Transforms API data before UI use → must have tests covering the happy path, null/empty input, and the specific crash scenario that motivated the function
- Maps form fields to DB columns → must have tests covering all field names, null slots, and max-item limits

Any new API route (or change to an existing one) → must have tests in `src/__tests__/api-routes.test.ts` covering:
- **Auth failure** (non-superadmin → 401)
- **Missing input** (no image / no name → 400)
- **External API failure** (403 billing, 400 bad key, 429 quota, network timeout → 502)
- **Success** (correct response shape)

**What Vitest unit tests CANNOT catch** (requires E2E / integration tests):
- React Server Component boundary violations (`onClick` in a Server Component file)
- Duplicate import statements breaking Server Action static registration
- File input not re-triggering `onChange` on retake (requires DOM simulation)
These must be caught by the commit checklist above or by running `npm run build` and loading the page in the browser.

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

**Section 4 — API Health** (`api_logs` table)
- Live log of every external API call (Google Vision, Plant.id, IUCN, GBIF, iNaturalist)
- Summary stats: calls / success % / P50 / P90 latency via `get_api_log_stats()` Supabase RPC
- Per-API collapsible log table: time, status code, duration, error message
- Rows auto-purged after 30 days via pg_cron (`purge-api-logs-30d` job)
- Rendered by `ApiHealthSection.tsx` — a completely separate Server Component. **Never inline this data-fetching in `page.tsx`** — mixing it with Server Action definitions breaks Next.js's static analysis (see lessons 17 and 18 below)

**Section 3 — Topic Queries** (`news_topic_queries` table)
- Admin-configurable RSS search terms for community/landscaping topics
- Each row: `query_text` (RSS search string), `chip_label`, `chip_icon`, `enabled`, `priority`
- Toggle, set priority, delete, add new
- `TopicQueryRow` sub-component handles one row — lives in `SettingsRows.tsx` (`'use client'`)
- Blue-tinted add form (vs green for news sources) to distinguish the two sections visually

**Settings page file structure — CRITICAL:**
```
src/app/(admin)/settings/
  page.tsx              — Server Component + Server Actions; data fetching for sections 1–3 only
  SettingsRows.tsx      — 'use client'; SourceRow, TopicQueryRow, SettingRow (have onClick)
  ApiHealthSection.tsx  — isolated Server Component; fetches api_logs independently
```
Never add data-fetching code for new sections directly inside `page.tsx` alongside Server Actions.
Never define components with event handlers in `page.tsx`. Both break Server Action static registration.

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

### Generate with AI (provider-agnostic LLM)

`POST /api/generate-with-ai` — given a botanical name + common name (+ optional photo), drafts the remaining
descriptive fields so the admin edits rather than types from scratch. Available on both the **Add** page and
the **Edit** form, next to the Populate-from-Name section.

**Two independent, swappable providers — both plain OpenAI-compatible `chat/completions`, no vendor SDK:**

| Purpose | Env vars | Default provider/model |
|---|---|---|
| Text drafting | `LLM_API_KEY` (required), `LLM_API_BASE_URL`, `LLM_MODEL` | OpenRouter free tier — `https://openrouter.ai/api/v1`, `nvidia/nemotron-3-super-120b-a12b:free` |
| Photo → visual description | `LLM_VISION_API_KEY` (optional), `LLM_VISION_API_BASE_URL`, `LLM_VISION_MODEL` | NVIDIA NIM — `https://integrate.api.nvidia.com/v1`, `meta/llama-3.2-90b-vision-instruct` |

**Provider swap history — read before changing `LLM_MODEL` again:**
1. Started on Anthropic Claude (paid) — swapped out, no free tier.
2. Tried Moonshot's own `platform.kimi.ai` API for Kimi K2 — **do not use this.** It requires a funded
   account balance before serving *any* request, even to the nominally-free K2 model, and returns a 429
   `exceeded_current_quota_error` / "account suspended" once exhausted (hit this in production, 2026-07-22).
3. Tried OpenRouter's `moonshotai/kimi-k2:free` — also retired mid-project: OpenRouter now 404s with
   `"This model is unavailable for free. ... use this slug instead: moonshotai/kimi-k2"` (paid).
4. **Current default: OpenRouter's `nvidia/nemotron-3-super-120b-a12b:free`** — $0/M input and output,
   262K context, text-only (no vision — that's still the separate `LLM_VISION_API_KEY` step below).
   Verify it's still listed at openrouter.ai/models?max_price=0 before assuming it's still free; OpenRouter's
   free-tier lineup has already changed once during this project.

The text call sends OpenRouter's `HTTP-Referer`/`X-Title` attribution headers unconditionally (harmless
no-ops on other providers) — free OpenRouter models can be deprioritised without them.

Swap providers any time by changing the env vars — no code change needed, as long as the new provider exposes
an OpenAI-compatible `POST {base_url}/chat/completions` endpoint. This was deliberately kept generic (not
named after Claude/Kimi/NVIDIA specifically) precisely because free-tier availability keeps shifting — see
the swap history above.

- **Vision is fully decoupled from text drafting.** If `LLM_VISION_API_KEY` isn't set, the photo is silently
  skipped and generation proceeds text-only from botanical + common name — never a hard failure. If it *is*
  set, `describeImage()` calls the vision model first to get a plain-text visual description (leaf shape, bark,
  flower colour, growth habit), which then becomes one extra line in the text model's prompt. A vision-call
  failure is also non-fatal — falls back to text-only silently (see `describeImage()`'s catch-all `return null`).
- Requires botanical name to be a full two-word binomial (same gate as Populate from Name) — it's the
  grounding key that disambiguates species sharing a common name.
- Generates: `hindi_name, kannada_name, tamil_name, category, height_category, flowering_type,
  flowering_season, description, medicinal_properties, plant_family, genus, toxicity, edible_parts,
  native_region, sunlight_needs, watering_needs, interesting_fact, life_span_description` — the full list is
  `AI_GENERATE_FIELDS` in `src/types/index.ts`, single source of truth shared by the route, the sanitiser, and
  the apply logic.
- **Deliberately does NOT generate** `foliage_type, conservation_status, growth_rate, propagation_methods,
  habitat_type` — those are already covered by the free GBIF/POWO/iNaturalist/IUCN enrichment pipeline
  (see above), which is more reliable for that specific data than an LLM guess would be.
- **Few-shot examples for format only, never facts**: pulls up to 4 already-`VERIFIED` (non-tentative) plants
  via `getAllSpecies()` to show the model the expected tone/field format. The prompt explicitly tells it not to
  borrow facts from these examples — a new species' description must come from the model's own knowledge of
  that exact species.
- **Per-field confidence**: the model is asked to return `high | medium | low` per field alongside the value.
  Local names and medicinal claims are explicitly flagged in the prompt as the fields most prone to
  hallucination/overclaiming — the admin UI surfaces confidence as a coloured badge per row.
- **Image handling**: both `imageBase64` (freshly staged photo, data URL) and `imageUrl` (Edit form's existing
  saved `species.img_main_url`) are passed straight through as `image_url.url` with no server-side re-encoding
  — OpenAI-compatible vision endpoints accept both a data URI and a public HTTPS URL directly. (Contrast with
  Google Vision's `imageUri`-only preference in lesson 27 — that constraint doesn't apply here.)
- **Always fill-empty-only, always TENTATIVE**: mirrors the Populate-from-Name / Plant.id apply pattern —
  "Fill empty fields only (safe)" vs an explicit-confirm "Overwrite all". Generating a draft sets
  `tentative: true` on the form; it never touches the DB directly, the admin still reviews and clicks Save.
- Sanitisation lives in `src/lib/aiGenerate.ts` (`sanitiseAiGenerateResult`) — never trusts the model's raw
  JSON shape, picks only known `AI_GENERATE_FIELDS` keys and coerces everything else to `null`, same rule as
  `sanitiseSubImages()`. Tested in `src/__tests__/aiGenerate.test.ts`.
- **Verify `LLM_MODEL`/`LLM_VISION_MODEL` before relying on this in production** — these are best-guess
  defaults for an OpenRouter free model and an NVIDIA NIM vision model; provider model IDs and free-tier
  availability change (see the provider swap history above — this has already happened twice). If the text
  call 502s with a 404/model-not-found body, the model string is wrong or its free slug was retired — check
  openrouter.ai/models?max_price=0 and override via `LLM_MODEL` rather than editing the route. If it 502s
  with a 429 `exceeded_current_quota_error` / "account suspended", that means `LLM_API_KEY` is a
  `platform.kimi.ai`-style key rather than an OpenRouter key.

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

### search_tags system

`plant_species.search_tags` is a pipe-separated text column (e.g. `"green|leaf|flower|white|tropical"`).
- **Computed at upload time** by the Vision route (`/api/vision-fallback`) using `LABEL_DETECTION` + `IMAGE_PROPERTIES`. Never computed at query time — zero consumer-app cost.
- `computeSearchTags(labels, colors)` in `vision-fallback/route.ts` builds the string: skips generic biology labels, maps RGB → colour name, max 12 tags.
- `onTagsComputed(data.searchTags)` callback in `ImageUploader.tsx` passes the result up to the plant form so it can be saved.
- **Backfill endpoint**: `POST /api/backfill-tags` — superadmin only; finds plants with `img_main_url` but no `search_tags`; calls Vision using `imageUri` (public Supabase Storage URL, no base64 encoding); 200ms delay between plants. Trigger from `/plants/backfill` page.
- **Migration**: `supabase/search-tags-migration.sql` → `ALTER TABLE plant_species ADD COLUMN IF NOT EXISTS search_tags text;` — run in Supabase SQL Editor once.

### Voice search in admin

`PlantSearchInput.tsx` has a mic button that uses Web Speech API (`en-IN` locale). Pattern repeated from consumer `PlantGrid.tsx`. SSR guard: `hasSpeech` is set in a `useEffect` (never on the server). Mic turns red + pulses while listening. The button is only rendered when `hasSpeech === true`.

### Universal vs property-specific admin architecture

The admin is evolving into two tiers:

**Universal** (plant-level data, same across all properties):
- Plant list (`/plants`) — species, photos, categories, botanical names
- Species edit form — descriptions, search tags, sub-images
- Settings — news sources, Vision, Plant.id

**Property-specific** (scoped to a property, e.g. `elan`):
- Landmarks — which areas exist in this property (`landmarks` table, `property_id='elan'`)
- Landmark tags — which plants grow near which landmarks (`plant_landmark_tags`: `species_id + landmark_id`)
- Plant location info — per-property free-text notes (`plant_location_info`: `species_id + property_id + location_info`)
- Eventually: team members, property-specific photos, occurrence counts

When adding a second property later: the Landmarks column in `/plants` and the map pins automatically reflect that property's data because `getLandmarkTagsForProperty(propertyId)` scopes the query.

`PROPERTY_ID = 'elan'` is a constant at the top of `/plants/page.tsx`.

### Key query functions (src/lib/queries.ts)
- `getLandmarkTagsForProperty(propertyId)` → `Record<string, { id: string; name: string }[]>` — maps species_id to its tagged landmarks for a given property. Used in the plants list to show Landmarks column.
- `getPlantLandmarkTags()` — returns all rows from `plant_landmark_tags` (used in map page).
- `getPlantLocationInfo(propertyId)` — returns `plant_location_info` rows for a property (used as NLP location fallback on map).

### Supabase tables managed by admin app
| Table | RLS read | Admin writes via |
|---|---|---|
| `plant_species` | anon SELECT (active only) | API routes (`/api/plants`) |
| `plant_instances` | anon SELECT | API routes |
| `staff_data` | anon SELECT | API routes |
| `plant_species_links` | anon SELECT | API routes |
| `landmarks` | anon SELECT | Admin UI (landmark management) |
| `plant_landmark_tags` | anon SELECT | Edit form → Location section (landmark tagging UI) |
| `plant_location_info` | anon SELECT | Edit form → Location section (per-property notes) |
| `news_sources` | anon SELECT | Settings page Server Actions |
| `app_settings` | anon SELECT | Settings page Server Actions |
| `news_topic_queries` | anon SELECT | Settings page Server Actions |
| `api_logs` | service-role only | `logApiCall()` in `src/lib/apiLogger.ts` |

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
| `LLM_API_KEY` | Yes | "Generate with AI" text drafting — OpenRouter API key (openrouter.ai/keys), NOT a Moonshot platform.kimi.ai key |
| `LLM_API_BASE_URL` | No | Override text provider base URL — default `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | No | Override text model ID — default `nvidia/nemotron-3-super-120b-a12b:free` |
| `LLM_VISION_API_KEY` | No | "Generate with AI" photo description — omit to skip vision and go text-only |
| `LLM_VISION_API_BASE_URL` | No | Override vision provider base URL — default `https://integrate.api.nvidia.com/v1` |
| `LLM_VISION_MODEL` | No | Override vision model ID — default `meta/llama-3.2-90b-vision-instruct` |

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
    3. Add section to `src/app/(admin)/settings/page.tsx` with Server Actions + a `XxxRow` sub-component in `SettingsRows.tsx`
    4. Write the SQL migration file in `supabase/` and instruct user to run it in Supabase SQL Editor

17. **Components with `onClick` must be in `'use client'` files — even simple ones.** `SourceRow`, `TopicQueryRow`, `SettingRow` had `onClick={e => confirm(...)}` on delete buttons. In a Server Component file this throws `"Event handlers cannot be passed to Client Component props"` at React serialisation time (production runtime error, NOT caught by `npm run build` or unit tests). They were moved to `SettingsRows.tsx` (`'use client'`). Server Actions can still be passed as props — they are serialisable action references.

18. **Never add a duplicate import from the same module in a file with Server Actions.** A second `import { ... } from '@/lib/queries'` line breaks Next.js's static Server Action registration — the existing Server Actions in the file lose their `'use server'` status and React throws the same event-handler serialisation error. Always extend the existing import line.

19. **Isolate new data-fetching sections from Server Action files.** Adding a `Promise.all(getApiLogStats(), ...)` block directly inside `SettingsPage` (which contains Server Actions) corrupted the static analysis. Pattern: create a separate `XxxSection.tsx` Server Component for any new section that needs its own data, import it as `<XxxSection />` in the page. This keeps Server Action definitions clean and isolated.

20. **Vercel env var values can silently be wrong keys.** A Stripe `sk_live_...` key was saved in the `GOOGLE_VISION_API_KEY` field — Vision returned 400 on every call for months. Always verify the VALUE prefix, not just that the key name exists: Vision keys start with `AIzaSy`, Supabase JWT keys start with `eyJ`, service role keys start with `eyJ`.

21. **GCP billing must be linked even for free-tier API usage.** Google Cloud Vision has 1,000 free units/month but still requires a billing account to be attached to the project. Without billing, every API call returns 403 regardless of usage. Linking a card does not charge you if you stay within the free tier.

22. **API logging must use Supabase, not the filesystem.** Vercel is serverless — the filesystem is ephemeral (wiped between invocations). All persistent logging goes to the `api_logs` Supabase table via `logApiCall()` in `src/lib/apiLogger.ts`. Use `timedFetch()` to wrap any external API call — it logs timing, status, and error body automatically. pg_cron purges rows older than 30 days nightly.

23. **Google Vision `WEB_DETECTION` returns generic labels, not botanical names.** For a clearly-identifiable plant like Mussaenda philippica, Vision returned "tree / Flower / Tree / M-tree". It is designed for general web image matching, not species-level classification. Use Vision's `bestGuessLabel` only as a loose hint. For accurate plant ID: Google Lens (download image → upload to lens.google.com) or Plant.id explicit button. Do NOT show Vision entity chips as "botanical name suggestions".

24. **File input must be reset before retake.** Without `inputRef.current.value = ''` before calling `.click()`, selecting the same photo again (or retaking with the camera) does not fire `onChange`. Vision never re-runs. Always reset the input value in both "Take photo" and "Choose from gallery" button handlers before triggering the click.

25. **pg_cron must be enabled before use.** Supabase's `cron` schema does not exist by default. Enable it via: Supabase Dashboard → Database → Extensions → search "pg_cron" → toggle On. Then `SELECT cron.schedule(...)` works. Without enabling, SQL editor throws `ERROR: 3F000: schema "cron" does not exist`.

26. **Pre-compute search tags at upload time, never at query time.** Vision `LABEL_DETECTION` + `IMAGE_PROPERTIES` runs once on photo upload and the result is stored in `plant_species.search_tags` (pipe-separated). The consumer app does a plain `.includes(q)` on this string — zero API cost at search time. For existing plants without tags, use the `/api/backfill-tags` endpoint (admin-only, 200ms delay between calls to avoid Vision quota).

27. **Use `imageUri` (public URL) not base64 for backfilling.** When calling Vision on existing plant photos, pass `{ source: { imageUri: imgUrl } }` instead of `{ source: { image: { content: base64 } } }`. No client-side encoding overhead, no 10MB base64 payload — Vision fetches the image directly from Supabase Storage. Only works because the `plant-images` bucket is public.

28. **Web Speech API SSR guard.** `'SpeechRecognition' in window` crashes on the server. Always initialise `hasSpeech` in a `useEffect`, never in the initial `useState` call (or component body). Pattern: `const [hasSpeech, setHasSpeech] = useState(false)` + `useEffect(() => { setHasSpeech('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) }, [])`. Render the mic button only when `hasSpeech === true`.

29. **Google Vision `score` ≠ pixel coverage — use `pixelFraction`.** Vision's `IMAGE_PROPERTIES` returns `score` (saturation-weighted, can be high for a tiny vivid area) and `pixelFraction` (actual proportion of image covered). Using `score` alone caused warm background tints to add "yellow" to unrelated plants. Fix: `if ((c.pixelFraction ?? 0) < 0.10) continue` in `computeSearchTags()`. This filter is required in BOTH `vision-fallback/route.ts` and `backfill-tags/route.ts`.

30. **Backfill tags supports `overwrite: true`.** `POST /api/backfill-tags` with `{ overwrite: true }` re-processes ALL plants with photos (not just those missing tags). Use after fixing `computeSearchTags` logic so existing incorrect tags get corrected. Without `overwrite`, it only touches plants where `search_tags IS NULL OR search_tags = ''`.

31. **Admin plants list Landmarks column is property-scoped.** The column shows `plant_landmark_tags` joined through `landmarks WHERE property_id = 'elan'`. Up to 2 landmark pills shown; overflow is a "+N more" link to `edit#landmarks`. Plants with no landmarks show a "📍 Tag Landmarks" link to the same anchor. The `id="landmarks"` attribute is on the Location `<section>` in `EditSpeciesForm.tsx`.
