# Changelog
## Elan Greens — Admin App

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
- API usage counters for Plant.id (100/month) and Google Vision (1,000/month)
- Staff CRUD with photo upload and tenure calculation from date_of_joining
- Field-level frontend validations on all forms
- CRUD feedback toasts for all actions
