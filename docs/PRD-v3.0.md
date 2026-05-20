# Product Requirements Document
## Elan Greens Admin App
### Version 3.0 | May 2026

> **This document supersedes PRD-v2.0.md.**
> PRD-v2.0.md is retained as a historical artifact.
> Section 7 (Version History) documents the delta from v2.0 → v3.0.

---

## 1. Overview

Internal admin panel for managing all content on `elan-greens.vercel.app`.
Used exclusively by the society admin (`ankitryai@gmail.com`) to add, edit,
and soft-delete plant species, plant instances (physical locations), gardening
staff entries, and to configure the News feed.

Not customer-facing. Functional UI, minimal decoration.

---

## 2. Identity & Access

| Attribute | Value |
|-----------|-------|
| URL | `elan-greens-admin.vercel.app` |
| Auth | Google OAuth via Supabase Auth |
| Superadmin email | `ankitryai@gmail.com` (env var `SUPERADMIN_EMAIL`) |
| Role | Single role: full CRUD on all tables |
| No users table | Email checked against env var only |

---

## 3. Pages

### Login (`/login`)
- Google Sign-In button
- On auth success: server checks email === `SUPERADMIN_EMAIL`
- Mismatch: sign out + show *"Access restricted to authorised admin only."*
- Match: redirect to `/dashboard`

---

### Dashboard (`/dashboard`)
- Summary cards: Unique species · Total plants · Staff count · Storage used / 1 GB
- Last updated timestamp per table
- Quick actions: Add Plant · Add Staff Member

---

### Plant Species List (`/plants`)
- Table: plant_id · common_name · category · instance count · tentative · active · updated_at
- Search by name · Filter by category / active / tentative
- Sort by: plant_id / common_name / category / updated_at (URL-driven, `?sort=field&dir=asc|desc`)
- Row actions: Edit · Manage Locations · Soft Delete (with Restore option)

---

### Add Species (`/plants/new`)

**Section 1 — Camera upload + identification:**
1. Mobile camera (`<input capture="environment">`) + gallery fallback. Accepted formats: JPEG, PNG, WebP.
2. Client-side canvas compression: max 800px wide, JPEG 80% quality. Shows: *"Saved to Xkb (was Ykb)"*
3. Storage meter: *"X.X MB of 1 GB used (X%)"* — warning when < 100 MB left
4. **Google Vision** (auto-fires on every upload): web entity matches shown as suggestion chips
5. **Plant.id** (explicit admin click only — 100 lifetime credits):
   - "🔬 Identify with Plant.id" button
   - Shows: suggestion + confidence % + *"Plant.id credits used: X / 100"*
   - ≥ 70% confidence: pre-fill all species fields, badge *"AI Suggested – verify before saving"*
6. All AI-filled fields tagged `tentative = true` automatically

**Section 2 — Populate from Name (🌿 Enrichment):**
- Button appears next to Botanical Name field; enabled when name has ≥ 2 words
- Fires GBIF + POWO + iNaturalist + IUCN in parallel (single click, one status line)
- Auto-fills: `foliage_type`, `conservation_status`, `observations_count`, `growth_rate`, `propagation_methods`, `habitat_type`
- Non-destructive: only fills empty fields, never overwrites existing data

**Section 3 — Sub-image fetch (Wikimedia + iNaturalist):**
- Fires automatically after species identification or when botanical name is set
- Tries Wikimedia Commons first (botanical+keyword, botanical alone, common+keyword)
- Falls back to iNaturalist with annotation filters (Flowers/Fruits/Leaves)
- iNaturalist: exact species first, then genus-level fallback
- Genus-level results show amber warning: *"⚠ Genus-level — verify species match before saving"*
- Admin reviews fetched image grid:
  - Hover × on individual image → remove from pending save
  - "✕ Reject all fetched" per category
- Existing saved images (green border) show 🗑 on hover → mark for deletion on save
- Debug provenance panel: source (Wikimedia / iNaturalist / none) + query used per category

**Section 4 — Species fields (all with inline validation):**
- common_name (required), botanical_name, hindi_name, kannada_name, tamil_name
- category (dropdown, required), height_category, flowering_type, flowering_season
- plant_family, toxicity, edible_parts, native_region
- sunlight_needs, watering_needs, interesting_fact, life_span_description
- foliage_type (Evergreen / Deciduous / Semi-evergreen)
- conservation_status (IUCN values: Least Concern / Near Threatened / Vulnerable / Endangered / Critically Endangered / Data Deficient / Not Evaluated)
- observations_count (integer, sourced from iNaturalist global count)
- growth_rate (Slow / Moderate / Fast)
- propagation_methods (pipe-separated e.g. "Seeds|Stem cuttings")
- habitat_type (free text e.g. "Tropical dry forest, scrublands")
- description (max 500 chars, live counter)
- medicinal_properties (max 300 chars, pipe-hint shown)
- not_applicable_parts (checkboxes: Flowers / Fruits / Leaves / Bark / Roots)
- tentative (checkbox, pre-checked for AI-filled data)

**Section 5 — First instance (location of this physical plant):**
- internal_identification_no (optional)
- custom_location_desc (max 100 chars)
- lat / lng (auto from EXIF → browser geolocation → manual)
- date_of_plantation

**Save / Cancel** → toast on result

**Duplicate detection:** If Plant.id / Google Vision returns a name already in DB:
*"[Name] already exists. Add a new location instead?"* → links to `/plants/[id]/locations/new`

---

### Edit Species (`/plants/[id]/edit`)
- Same form as Add, pre-populated
- `plant_id` is read-only
- Changing botanical name re-offers enrichment + image fetch
- **Linked Species section** (bottom of form):
  - Search box to find and link another species
  - Link label dropdown: Same family / Common companion / Same use / Seasonal pair / Native pair / Often confused / Other
  - Table of existing links with Remove button
  - Bidirectional: adding a link from Species A automatically creates the reverse

---

### Manage Locations (`/plants/[id]/locations`)
- Table: tree number · location desc · lat/lng · plantation date · age · active
- **Add Location** button → minimal form (instance fields only, species shown read-only)
- Edit / soft delete per instance

---

### Staff List + Add/Edit (`/staff`, `/staff/new`, `/staff/[id]/edit`)
- Same CRUD pattern as plants
- date_of_joining → shown as *"X yrs Y months with us"*
- Photo upload with same storage meter + resize logic
- Accepted formats: JPEG, PNG, WebP

---

### Settings (`/settings`)

Three sections for configuring the News feed:

**Section 1 — News Sources**
- Whitelist of trusted domains from which news articles are pulled
- Per row: domain (monospace) · enabled toggle (green) · priority 0–10 spinner · delete button
- Add form: domain input + display label + priority
- Changes take effect on next RSS cache refresh (up to `news_cache_hours`)

Seeded defaults: thebetterindia.com · downtoearth.org.in · india.mongabay.com · science.thewire.in · sanctuaryasia.com · deccanherald.com · thehindu.com · newindianexpress.com · indianexpress.com · bangaloremirror.indiatimes.com

**Section 2 — News Settings**
Editable numeric knobs (each row has Save button):

| Key | Default | Description |
|-----|---------|-------------|
| `news_max_articles` | 10 | Max articles in public feed |
| `news_max_plant_tags` | 3 | Max plant chips per article |
| `news_max_plants` | 20 | Top N plants queried for news |
| `news_max_per_plant` | 2 | Max articles per primary plant (coverage spread) |
| `news_max_age_days` | 365 | Hard cutoff — older articles excluded |
| `news_cache_hours` | 24 | RSS fetch cache TTL in hours |

**Section 3 — Topic Queries**
Admin-configurable RSS search terms for community/landscaping topics:
- Per row: enabled toggle (blue) · emoji icon · query text (monospace) + chip label · priority spinner · delete button
- Add form: query text + chip label + chip icon emoji + priority

Seeded defaults:
| Query | Chip label | Icon |
|---|---|---|
| `Bengaluru landscaping` | Green Bengaluru | 🌳 |
| `"apartment garden" Bangalore` | Community | 🏘️ |
| `"urban greening" Bengaluru` | Green Bengaluru | 🌳 |
| `"terrace garden" Bengaluru` | Community | 🏘️ |
| `"native plants" Bangalore` | Native Plants | 🌱 |
| `Lalbagh Bengaluru` | Green Bengaluru | 🌳 |
| `"Cubbon Park" Bengaluru` | Green Bengaluru | 🌳 |
| `"green building" Karnataka` | Green Bengaluru | 🌳 |

---

## 4. Field-Level Validations (Frontend)

| Field | Rule |
|-------|------|
| common_name | Required · min 2 · max 100 · allowed: letters, spaces, `()–&,` |
| botanical_name | Optional · max 150 · warn if single word (should be full binomial) |
| hindi_name / kannada_name / tamil_name | Optional · max 100 each |
| category | Required · one of 8 allowed values |
| height_category | Optional · Short / Medium / Tall |
| description | Optional · max 500 · live char counter |
| medicinal_properties | Optional · max 300 |
| conservation_status | Optional · one of 7 IUCN values |
| growth_rate | Optional · Slow / Moderate / Fast |
| observations_count | Optional · positive integer only |
| propagation_methods | Optional · pipe-separated values |
| tribute_note | Optional · max 300 |
| name (staff) | Required · min 2 · max 100 |
| role (staff) | Required · one of 3 values |
| Image upload | JPEG / PNG / WebP · warn > 2 MB · auto-resize (canvas) before upload |

---

## 5. CRUD Feedback Messages

| Action | Success toast | Error banner |
|--------|--------------|-------------|
| Add species | ✅ "[Name]" added to plant directory | ❌ Could not save. [detail] |
| Edit species | ✅ "[Name]" updated | ❌ Could not update. [detail] |
| Soft delete species | 🗑 "[Name]" removed. Restore anytime. | ❌ Could not delete |
| Restore species | ✅ "[Name]" is visible again | ❌ Could not restore |
| Add location | ✅ New location added for [Name] | ❌ Could not add location |
| Add linked species | ✅ Link created | ❌ Could not link |
| Remove linked species | ✅ Link removed | ❌ Could not remove link |
| Add staff | ✅ "[Name]" added to Green Team | ❌ Could not add |
| Edit staff | ✅ "[Name]" updated | ❌ Could not update |
| Image upload | ✅ Photo uploaded (Xkb saved) | ❌ Upload failed. Check connection. |
| Enrichment | ✅ X fields filled from GBIF / POWO / iNat / IUCN | ⚠ Partial: [which sources failed] |
| Settings save | ✅ (page revalidates silently) | — |
| Login success | ✅ Welcome back | — |
| Login denied | — | ❌ Access denied. Unauthorised email. |

> **Note on error display:** Server errors use `ErrorBanner` component (persistent, dismissible, scrolls to top). Non-critical feedback uses `toast.success` / `toast.warning` (auto-dismiss).

---

## 6. API Routes (server-side, keys never exposed to browser)

| Route | Purpose | External service |
|-------|---------|-----------------|
| `POST /api/identify-plant` | Sends image to Plant.id, returns suggestion + confidence | Plant.id API (100 lifetime credits) |
| `POST /api/vision-fallback` | Sends image to Google Vision Web Detection | Google Cloud Vision (1 000/month) |
| `GET /api/fetch-images?name=[botanical]&common=[common]` | Fetches sub-images from Wikimedia Commons; falls back to iNaturalist | Wikimedia API + iNaturalist API |
| `GET /api/fetch-enrichment?name=[botanical]` | GBIF + POWO + iNaturalist + IUCN in parallel, returns enrichment fields | GBIF, POWO, iNaturalist, IUCN |
| `GET /api/storage-usage` | Returns current Supabase Storage bucket size | Supabase Storage API |
| `GET /api/health` | Returns 200 + `SELECT 1` from DB | Supabase DB |

---

## 7. Version History

| Version | Date | Summary of Changes |
|---------|------|--------------------|
| 1.0 | April 2026 | Initial PRD — single flat plant table, Google Sheets backend |
| 2.0 | April 2026 | Split to species + instances model. Plant.id + Google Vision + Wikimedia. Staff pages. |
| **3.0** | **May 2026** | **See delta below** |

### v3.0 Delta — Product Asks and Delivered Features

#### 3.1 Linked Species (Related Plants)
**Ask:** Allow admin to associate related plant species — same family, common companions, look-alikes — so residents see contextual plant relationships.

**Delivered:**
- New `plant_species_links` table with bidirectional unique index (`LEAST/GREATEST` on both FK columns)
- Admin edit page: search-and-link UI with label dropdown, table of existing links, remove button
- Public plant detail page: "Related Plants" section with species cards
- Fixed label set (not free text) to keep display consistent

#### 3.2 Enrichment Pipeline ("Populate from Name")
**Ask:** Auto-fill botanical enrichment fields (conservation status, growth rate, propagation, etc.) from authoritative sources to reduce manual data entry.

**Delivered:**
- `GET /api/fetch-enrichment` route — fires GBIF + POWO + iNaturalist + IUCN in parallel
- Admin UI: "🌿 Populate from Name" button on both Add and Edit pages
- Fills 6 new fields: `foliage_type`, `conservation_status`, `observations_count`, `growth_rate`, `propagation_methods`, `habitat_type`
- Non-destructive: never overwrites existing values
- Status feedback per source: ok / miss / error per API

#### 3.3 Enhanced Sub-Image Pipeline (Review + Delete)
**Ask:** Admin needs to review fetched images before saving, reject individual bad images, and delete outdated saved images.

**Delivered:**
- Per-image × reject on fetched images (removes from pending save without discarding whole category)
- "Reject all fetched" per category
- iNaturalist fallback with taxonomy annotation filters for Flowers / Fruits / Leaves
- Genus-level fallback with amber ⚠ mismatch warning
- Hover 🗑 on saved images → "Will be deleted on save" with Undo
- Save merge order: deletions first → manual pasted URLs → freshly fetched images (later wins)
- Debug provenance: shows which source + which query produced each category's results

#### 3.4 News Feed Configuration (Settings Page)
**Ask:** Admin needs to control which news sources appear in the public feed, tune the algorithm, and configure community topic queries — all without code changes or Supabase SQL editor.

**Delivered:**
- New `/settings` page with 3 sections (linked from admin sidebar)
- **Section 1 — News Sources:** CRUD on `news_sources` table (domain whitelist + priority)
- **Section 2 — News Settings:** Inline edit for all 6 numeric algorithm knobs in `app_settings`
- **Section 3 — Topic Queries:** CRUD on `news_topic_queries` (search term + chip label + icon + priority + enabled toggle)
- All mutations via Server Actions (no API routes) — page revalidates after each action

#### 3.5 New Plant Fields (public-facing)
**Ask:** Surface richer botanical data that residents find interesting — is the plant endangered? How fast does it grow? Where does it come from ecologically?

**Delivered:**
New `plant_species` columns shown on detail page:
- `foliage_type` — Evergreen / Deciduous / Semi-evergreen
- `conservation_status` — IUCN status, colour-coded badge
- `observations_count` — iNaturalist global sightings count
- `growth_rate` — Slow / Moderate / Fast
- `propagation_methods` — how the plant reproduces/is propagated
- `habitat_type` — natural ecological context

---

## 8. Out of Scope (Admin v3)

- Bulk import / CSV upload of species
- Multiple admin users or role-based access
- Audit log UI (DB timestamps are sufficient)
- Email notifications on changes
- Preview of public plant card before saving
- Automatic news source discovery (adding domains via web crawl)
- Scheduled / cron-based news refresh (RSS caching at fetch layer is sufficient)
