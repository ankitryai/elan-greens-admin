# Non-Functional Requirements & Performance Targets
## Elan Greens v1.0.0 | April 2026

---

## 1. Performance Targets (Main App — Public Facing)

Measured on a mid-range Android phone on a 4G connection (the primary use case).

| Metric | Target | Measurement Tool | Priority |
|--------|--------|-----------------|---------|
| LCP (Largest Contentful Paint) | < 2.5 s | Lighthouse CLI | P0 |
| INP (Interaction to Next Paint) | < 100 ms | Lighthouse CLI | P0 |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse CLI | P0 |
| TTFB (Time to First Byte) | < 600 ms | Vercel Analytics | P1 |
| Full page load (listing, 22 plants) | < 3 s on 4G | WebPageTest | P1 |
| Mobile Lighthouse score | ≥ 85 | Lighthouse CLI | P1 |
| Plant detail page load | < 2 s on 4G | WebPageTest | P1 |
| Search autosuggest response | < 300 ms | Manual timing | P2 |

**Admin App performance targets are lower priority** — single internal user, desktop/WiFi likely.

---

## 2. Availability & Reliability

| Component | Expected uptime | Notes |
|-----------|----------------|-------|
| Vercel (Main App) | 99.9% | Vercel SLA for hobby tier |
| Vercel (Admin App) | 99.9% | Same |
| Supabase DB | 99.9% | Supabase free tier SLA |
| Supabase Storage | 99.9% | CDN-backed |
| Plant.id API | Best-effort | External; quota exhaustion handled via fallback |
| Google Vision API | Best-effort | External; quota exhaustion shows manual entry option |
| Wikimedia Commons API | Best-effort | External; missing images shown as graceful placeholder |

**Single point of failure risk:** Supabase free-tier projects pause after 1 week of inactivity. The main app would return empty data. **Mitigation:** Admin app activity or a weekly Supabase keep-alive ping (documented in DEPLOYMENT.md).

---

## 3. Free Tier Capacity Limits

These are the ceilings before any paid upgrade is needed.

### Vercel (Hobby)
| Limit | Value | Estimated actual usage |
|-------|-------|----------------------|
| Bandwidth / month | 100 GB | ~50 MB (200 residents × 250KB avg page) |
| Serverless function invocations | 100,000 / month | ~2,000 (search + page views) |
| Build minutes | 6,000 / month | ~10 per deploy |
| **Headroom** | **~2,000× over actual** | Will never be exceeded |

### Supabase (Free)
| Limit | Value | Estimated actual usage |
|-------|-------|----------------------|
| Database size | 500 MB | < 1 MB (22 species + instances + staff) |
| Storage | 1 GB | ~50 MB (22 main photos @ ~2 MB each compressed) |
| Bandwidth | 2 GB / month | ~100 MB (image loads) |
| API requests | Unlimited | N/A |
| **Project pause** | After 7 days inactivity | Resumes in ~10s on first request |

### Plant.id API (Free)
| Limit | Value | Estimated actual usage |
|-------|-------|----------------------|
| Identifications / month | 100 | ~5–10 per month (admin adds plants gradually) |
| **Headroom** | 90–95 calls remaining typical | |

### Google Cloud Vision (Free)
| Limit | Value | Estimated actual usage |
|-------|-------|----------------------|
| Units / month | 1,000 | ~5–10 (fallback only when Plant.id confidence < 70%) |
| **Headroom** | ~990 calls remaining typical | |

### Wikimedia Commons API
| Limit | No quota | Free, no API key |
| Estimated calls / plant | 5 (one per image category) | |

---

## 4. Scalability Limits

This app is designed for ~200 residents. The following table shows what happens if it gets unexpectedly popular (e.g. shared widely on RWA groups).

| Concurrent users | Expected behaviour |
|-----------------|-------------------|
| 1–50 | ✅ Perfectly fine. Vercel serves cached pages from edge. |
| 50–500 | ✅ Still fine. Vercel scales serverless functions automatically. Supabase handles concurrent reads easily. |
| 500–5,000 | ⚠️ Supabase free tier bandwidth (2 GB/month) may be approached if images load frequently. No app crash — just slower image loads as CDN limits are hit. |
| 5,000+ | ❌ Vercel bandwidth (100 GB/month) becomes a concern. Upgrade to Vercel Pro ($20/month) at this point. |

---

## 5. Image Loading Strategy

Images are the biggest NFR risk. The plan:

| Image type | Served from | Strategy |
|-----------|------------|---------|
| Main photo (uploaded) | Supabase Storage CDN | Next.js `<Image>` with `sizes` attribute for responsive loading |
| Sub-images (Wikimedia) | Wikimedia CDN | Direct `<img>` with lazy loading (`loading="lazy"`) |
| Staff photos | Supabase Storage CDN | Same as main photo |

Next.js `<Image>` component automatically:
- Serves WebP format to supported browsers (smaller file size)
- Lazy-loads images below the fold
- Prevents CLS with `width`/`height` props

---

## 6. Post-Deployment NFR Testing Checklist

Run after first production deployment. Results to be documented in this file.

```
[ ] Lighthouse mobile score ≥ 85 (run: npx lighthouse https://elan-greens.vercel.app --view)
[ ] LCP < 2.5s confirmed on plant listing page
[ ] LCP < 2.5s confirmed on plant detail page
[ ] CLS < 0.1 confirmed (no layout shift from image loads)
[ ] Search autosuggest responds within 300ms
[ ] Plant detail page loads all 10 gallery images without error
[ ] Map page loads Leaflet map within 2s
[ ] App works on Chrome Android (test on actual phone)
[ ] App works on Safari iOS (test on iPhone or BrowserStack free tier)
[ ] App works on Chrome Desktop (1280px)
[ ] Supabase project NOT paused (visit dashboard to confirm active)
```

### Results (fill after deployment)
| Test | Result | Date |
|------|--------|------|
| Lighthouse mobile score | TBD | — |
| LCP (listing page) | TBD | — |
| LCP (detail page) | TBD | — |
| CLS | TBD | — |
| Real device Android | TBD | — |
| Real device iOS | TBD | — |
