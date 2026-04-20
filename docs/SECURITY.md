# Security Posture
## Elan Greens v1.0.0 | April 2026

---

## 1. Threat Model

This is a hobby, read-mostly public app for ~200 society residents. The realistic threats are:

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|-----------|
| Unauthorised admin access | Low | High — could corrupt plant data | Google OAuth + email allowlist + server-side auth check |
| API key exposure (Plant.id, Supabase) | Low | Medium — quota abuse or DB writes | All keys in Vercel env vars, never in client bundle |
| Junk/malicious image upload | Low | Low — storage waste | File type validation + size limits + client-side resize |
| XSS via plant descriptions | Low | Low — no user-generated content in public app | React's default HTML escaping |
| SQL injection | Very low | High | Supabase client uses parameterised queries; no raw SQL in app code |
| DDoS | Very low | Low — Vercel absorbs traffic spikes | Vercel edge network handles this automatically |

---

## 2. Authentication (Admin App Only)

```
User visits admin app
        ↓
Next.js middleware checks Supabase session cookie
        ↓
  No session → redirect to /login
  Session exists → verify email === process.env.SUPERADMIN_EMAIL (server-side)
        ↓
  Email mismatch → sign out + show "Access denied" + redirect to /login
  Email match   → allow access
```

**Why email check in env var instead of DB:**
No users table means no DB query on every request. The env var is checked in-process — faster and no attack surface.

**Session expiry:** Supabase JWT expires in 1 hour, auto-refreshed silently if the user is active.

---

## 3. Database Security (Supabase RLS)

Two Supabase keys used — each with different permissions:

| Key | Used in | Can do |
|-----|---------|--------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Main app (client-side) | SELECT only, active + non-deleted rows |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin app **server-side only** | Full CRUD, bypasses RLS |

**Critical rule:** The service role key is **NEVER** in any client-side file. It lives only in:
- Vercel environment variables (admin app project only)
- Local `.env.local` (gitignored)

RLS policies ensure that even if someone calls the Supabase URL directly with the anon key, they cannot read soft-deleted or inactive plants.

---

## 4. API Key Protection

| Secret | Where it lives | Exposed to browser? |
|--------|---------------|---------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (admin) | ❌ Never |
| `PLANT_ID_API_KEY` | Vercel env (admin) | ❌ Never — called from Next.js API route |
| `GOOGLE_VISION_API_KEY` | Vercel env (admin) | ❌ Never — called from Next.js API route |
| `NEXT_PUBLIC_SUPABASE_URL` | Both apps (public) | ✅ Safe — just the project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Main app (public) | ✅ Safe — RLS restricts what it can do |

**Plant.id and Google Vision are called via Next.js API routes** (`/api/identify-plant`, `/api/vision-fallback`). The browser sends the image to our own API route, which then calls the external API server-side. The third-party API keys never leave the server.

---

## 5. Input Validation

Two layers — both required:

| Layer | Tool | Purpose |
|-------|------|---------|
| Client-side | Zod + React Hook Form | Fast UX feedback; catches obvious errors before any network call |
| Server-side | Zod in API routes | Security layer — cannot be bypassed. Validates before any DB write. |

Client-side validation is **UX only**. It can be bypassed by a determined user. The server always re-validates.

---

## 6. Image Upload Security

1. **File type check:** Only `image/jpeg` and `image/png` accepted (checked by MIME type, not just extension)
2. **Size warning:** Files > 2 MB trigger a warning. Client-side resize brings them to ≤ 800px / 75% quality before upload.
3. **No executable content:** Images are stored in Supabase Storage as blobs and served as static files. There is no way to upload or execute scripts through the image upload path.
4. **Bucket is public read:** Anyone can access a URL if they know it. This is intentional — plant photos are public data. Staff photos are in a separate bucket with the same policy. No PII is in these images.

---

## 7. HTTP Security Headers

Set in `next.config.ts` for both apps:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

Note: `geolocation=(self)` allows the admin app to use browser geolocation for plant location capture (fallback when EXIF GPS is unavailable).

HTTPS is enforced automatically by Vercel on all deployments. HTTP requests are redirected to HTTPS.

---

## 8. What Is NOT in Scope (v1)

| Feature | Why deferred |
|---------|-------------|
| Rate limiting on admin API routes | Only one user (you). Not needed for v1. |
| Audit log table | `created_at` / `updated_at` on all rows covers change history for v1. |
| CAPTCHA | No public form submissions. Not needed. |
| Content Security Policy (CSP) | Complex to configure with Next.js + Supabase + external image sources. Deferred to v2 to avoid blocking launch. |
| 2FA on admin login | Google account's own 2FA covers this if enabled on `ankitryai@gmail.com`. |
