# Changelog
## Elan Greens — Admin App

All notable changes to the admin app are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] — 2026-05-20

### Added
- **Enrichment pipeline** — "🌿 Populate from Name" button on Add and Edit species pages
  - Fires GBIF + POWO + iNaturalist + IUCN Red List in parallel (single click)
  - Auto-fills: `foliage_type`, `conservation_status`, `observations_count`, `growth_rate`, `propagation_methods`, `habitat_type`
  - Non-destructive: only fills empty fields, never overwrites existing values
  - Per-source status: ok / miss / error for each of the 4 APIs
- **Enhanced sub-image review pipeline**
  - Per-image × reject button — remove individual fetched images before saving
  - "Reject all fetched" per category
  - Hover 🗑 on saved DB images → "Will be deleted on save" overlay with Undo
  - iNaturalist fallback when Wikimedia returns no results (annotation filters: Flowers/Fruits/Leaves)
  - Genus-level iNaturalist fallback with amber ⚠ mismatch warning
  - Debug provenance panel: source (Wikimedia / iNaturalist / none) + query string per category
- **Linked species management** on Edit Species page
  - Search-and-add another species as related
  - Relationship label dropdown: Same family / Common companion / Same use / Seasonal pair / Native pair / Often confused / Other
  - Table of existing links with Remove button
  - Bidirectional: one admin action creates/removes the link in both directions
- **Settings page** (`/settings`) — linked from admin sidebar
  - Section 1: News Sources — CRUD on `news_sources` domain whitelist (toggle, priority, delete, add)
  - Section 2: News Settings — inline edit for 6 algorithm knobs (`news_max_articles`, `news_max_plant_tags`, `news_max_plants`, `news_max_per_plant`, `news_max_age_days`, `news_cache_hours`)
  - Section 3: Topic Queries — CRUD on `news_topic_queries` (query text, chip label, chip icon, enabled, priority)
- **New plant species fields** (form + DB):
  - `foliage_type` — Evergreen / Deciduous / Semi-evergreen
  - `conservation_status` — IUCN status values
  - `observations_count` — iNaturalist global sightings (integer)
  - `growth_rate` — Slow / Moderate / Fast
  - `propagation_methods` — pipe-separated
  - `habitat_type` — free text ecological description
- **Error boundary** (`src/app/(admin)/error.tsx`) — red recovery UI for runtime crashes with Error ID + retry/back buttons

### Changed
- Image compression upgraded from 75% to 80% JPEG quality
- Image compression: `browser-image-compression` library removed, replaced with canvas-based compression (Vercel blocks web workers)
- Accepted upload formats expanded: JPEG + PNG → JPEG + PNG + **WebP**
- Plant.id credit counter corrected to **100 lifetime credits** (not per-month) — button label updated accordingly
- Sub-image fetch now passes both `botanical_name` AND `common_name` to API for better fallback matching
- `GET /api/fetch-images` route extended to support iNaturalist as a secondary source

### Fixed
- Blank page crash on `/plants/new` and `/plants/[id]/edit` — caused by `import type` from API route files pulling server-only modules into client bundle. All shared types moved to `src/types/index.ts`.
- "x.map is not a function" crash on sub-image review — raw API JSON (including `_debug` object) was passed directly to React state. Fixed with `sanitiseSubImages()` sanitiser.
- Integer validation: `observations_count` empty string now converted to `null` before DB write (was crashing Postgres with `invalid input syntax for type integer`)

---

## [1.0.0] — 2026-04-20

### Added
- Google OAuth login restricted to single superadmin email via env var
- Dashboard with live stats: species count, plant count, staff count, storage meter
- Plant species list with search, filter, sort, and soft-delete/restore
- Add species: camera upload → Plant.id identification → Wikimedia sub-image auto-fetch
- Google Vision Web Detection fallback when Plant.id confidence < 70%
- Duplicate species detection — prompts to add location instead of duplicating data
- Manage locations per species: add / edit / soft-delete physical plant instances
- EXIF GPS extraction from uploaded photos (3-step fallback: EXIF → browser → manual)
- Client-side image resize (max 800px, 75% quality) with storage meter
- API usage counters for Plant.id and Google Vision
- Staff CRUD with photo upload and tenure calculation from date_of_joining
- Field-level frontend validations on all forms
- CRUD feedback toasts for all actions
