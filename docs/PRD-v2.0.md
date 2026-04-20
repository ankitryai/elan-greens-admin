# Product Requirements Document
## Elan Greens Admin App
### Version 2.0 | April 2026

---

## 1. Overview

Internal admin panel for managing all content on `elan-greens.vercel.app`.
Used exclusively by the society admin (`ankitryai@gmail.com`) to add, edit,
and soft-delete plant species, plant instances (physical locations), and
gardening staff entries.

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

### Dashboard (`/dashboard`)
- Summary cards: Unique species · Total plants · Staff count · Storage used / 1 GB
- Last updated timestamp per table
- Quick actions: Add Plant · Add Staff Member

### Plant Species List (`/plants`)
- Table: plant_id · common_name · category · instance count · tentative · active · updated_at
- Search by name · Filter by category / active / tentative
- Row actions: Edit · Manage Locations · Soft Delete (with Restore option)

### Add Species (`/plants/new`)
**Section 1 — Camera upload + identification:**
1. Mobile camera (`<input capture="environment">`) + gallery fallback
2. Client-side resize: max 800px wide, JPEG 75% quality. Shows: *"Saved to Xkb (was Ykb)"*
3. Storage meter: *"X.X MB of 1 GB used (X%)"* — warning when < 100 MB left
4. **Plant.id API call** (via `/api/identify-plant` server route):
   - Shows: suggestion + confidence % + *"Plant.id calls this month: X / 100"*
   - ≥ 70% confidence: pre-fill all species fields, badge *"AI Suggested – verify before saving"*
   - < 70% or quota exhausted: trigger Google Vision Web Detection fallback
5. **Google Vision fallback** (via `/api/vision-fallback` server route):
   - Shows: *"Checking Google Vision... (Used: X / 1,000 this month)"*
   - Returns web entity matches + *"Search on Google Images →"* deep link
6. All AI-filled fields tagged `tentative = true` automatically
7. **Wikimedia Commons auto-fetch** (via `/api/fetch-images` server route):
   - Uses botanical name to search 5 categories in parallel
   - Returns up to 2 images per category (flowers, fruits, leaves, bark, roots)
   - Admin previews grid, can swap or remove individual images
   - Missing categories left empty — handled gracefully on main app

**Section 2 — Species fields (all with inline validation):**
- common_name (required), botanical_name, hindi_name, kannada_name, tamil_name
- category (dropdown, required), height_category, flowering_type, flowering_season
- plant_family, toxicity, edible_parts, native_region
- sunlight_needs, watering_needs, interesting_fact
- life_span_description
- description (max 500 chars, live counter)
- medicinal_properties (max 300 chars, pipe-hint shown)
- not_applicable_parts (checkboxes: Flowers / Fruits / Leaves / Bark / Roots)
- tentative (checkbox, pre-checked for AI-filled data)

**Section 3 — First instance (location of this physical plant):**
- internal_identification_no (optional)
- custom_location_desc (max 100 chars)
- lat / lng (auto from EXIF → browser geolocation → manual)
- date_of_plantation

**Save / Cancel** → toast on result

**Duplicate detection:** If Plant.id returns a name already in DB:
*"[Name] already exists. Add a new location instead?"* → links to `/plants/[id]/locations/new`

### Edit Species (`/plants/[id]/edit`)
- Same form as Add, pre-populated
- `plant_id` is read-only
- Changing botanical name re-offers Wikimedia image fetch

### Manage Locations (`/plants/[id]/locations`)
- Table: tree number · location desc · lat/lng · plantation date · age · active
- **Add Location** button → minimal form (instance fields only, species shown read-only)
- Edit / soft delete per instance

### Staff List + Add/Edit (`/staff`, `/staff/new`, `/staff/[id]/edit`)
- Same CRUD pattern
- date_of_joining → shown as *"X yrs Y months with us"*
- Photo upload with same storage meter + resize logic

---

## 4. Field-Level Validations (Frontend)

| Field | Rule |
|-------|------|
| common_name | Required · min 2 · max 100 · allowed: letters, spaces, `()–&,` |
| botanical_name | Optional · max 150 · warn if single word (should be two) |
| hindi_name / kannada_name / tamil_name | Optional · max 100 each |
| category | Required · must be one of 8 allowed values |
| height_category | Optional · must be Short/Medium/Tall if provided |
| description | Optional · max 500 · live char counter |
| medicinal_properties | Optional · max 300 |
| tribute_note | Optional · max 300 |
| name (staff) | Required · min 2 · max 100 |
| role (staff) | Required · one of 3 values |
| years_with_society | N/A — replaced by date_of_joining (date picker) |
| Image upload | JPEG/PNG only · warn > 2 MB · auto-resize before upload |

---

## 5. CRUD Feedback Messages

| Action | Success toast | Error toast |
|--------|--------------|-------------|
| Add species | ✅ "[Name]" added to plant directory | ❌ Could not save. [detail] |
| Edit species | ✅ "[Name]" updated | ❌ Could not update. [detail] |
| Soft delete species | 🗑 "[Name]" removed. Restore anytime. | ❌ Could not delete |
| Restore species | ✅ "[Name]" is visible again | ❌ Could not restore |
| Add location | ✅ New location added for [Name] | ❌ Could not add location |
| Add staff | ✅ "[Name]" added to Green Team | ❌ Could not add |
| Edit staff | ✅ "[Name]" updated | ❌ Could not update |
| Image upload | ✅ Photo uploaded (Xkb saved) | ❌ Upload failed. Check connection. |
| Login success | ✅ Welcome back | — |
| Login denied | — | ❌ Access denied. Unauthorised email. |

---

## 6. API Routes (server-side, keys never exposed to browser)

| Route | Purpose | External service |
|-------|---------|-----------------|
| `POST /api/identify-plant` | Sends image to Plant.id, returns suggestion + confidence | Plant.id API |
| `POST /api/vision-fallback` | Sends image to Google Vision Web Detection | Google Cloud Vision |
| `GET /api/fetch-images?name=[botanical]` | Fetches up to 10 sub-images from Wikimedia Commons | Wikimedia Commons API |
| `GET /api/storage-usage` | Returns current Supabase Storage bucket size | Supabase Storage API |
| `GET /api/health` | Returns 200 + `SELECT 1` from DB (keeps Supabase active) | Supabase DB |

---

## 7. Out of Scope (Admin v1)

- Bulk import / CSV upload
- Multiple admin users
- Audit log UI
- Email notifications on changes
- Preview of public plant card before saving
