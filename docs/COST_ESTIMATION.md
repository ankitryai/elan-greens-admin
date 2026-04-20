# Cost Estimation
## Elan Greens v1.0.0 | April 2026

> All services used in v1 are on **free tiers**. This document records what each
> service costs when you outgrow the free tier, so there are no surprises later.

---

## Current Total Monthly Cost: ₹0

---

## Service-by-Service Breakdown

### 1. Vercel (Hosting — Both Apps)

| Tier | Price | Limits | When you'd hit it |
|------|-------|--------|------------------|
| **Hobby (current)** | **Free** | 100 GB bandwidth, 100K function calls/month | Never for 200 residents |
| Pro | $20/month (~₹1,660) | 1 TB bandwidth, unlimited functions | If app goes viral (5,000+ MAU) |

**Trade-off:** Hobby tier has no SLA and no team collaboration. Fine for a solo hobby project.

---

### 2. Supabase (Database + Auth + Storage)

| Tier | Price | Key Limits | When you'd hit it |
|------|-------|-----------|------------------|
| **Free (current)** | **Free** | 500 MB DB, 1 GB storage, 2 GB bandwidth, 50K MAU auth | Never for this app |
| Pro | $25/month (~₹2,075) | 8 GB DB, 100 GB storage, 50 GB bandwidth | If you store 1,000+ high-res photos |

**Free tier catch:** Project pauses after 7 days of zero requests. Resumes automatically in ~10 seconds on the next request. For a live app with even one visit per week, this will never happen.

**Trade-off (Admin vs Public):** The public main app uses the anon key (read-only). The admin uses the service_role key server-side. Both share the same Supabase project — only one project slot used of the 2 free ones.

---

### 3. Plant.id API (Plant Identification)

| Tier | Price | Limits | When you'd hit it |
|------|-------|--------|------------------|
| **Free (current)** | **Free** | 100 identifications/month | If adding > 100 new plants/month — unlikely |
| Lite | €9.99/month (~₹900) | 1,000/month | If adding 100–1,000 plants/month |
| Basic | €29.99/month | 10,000/month | Commercial use only |

**Trade-off:** 100/month is more than enough while walking the society gradually. The admin app shows remaining quota prominently to prevent waste. If quota runs out mid-month, Google Vision is the automatic fallback.

---

### 4. Google Cloud Vision API (Fallback Identification)

| Tier | Price | Limits | When you'd hit it |
|------|-------|--------|------------------|
| **Free (current)** | **Free** | 1,000 units/month (Web Detection) | If Plant.id consistently fails and Vision is used for every plant |
| Paid | $3.50 per 1,000 units | Unlimited | Commercial use |

**Note:** Requires a Google Cloud account with billing enabled (credit card required even for free tier). However, Google does NOT charge unless you manually upgrade and exceed the free tier. The ₹0 free tier is protected by a quota cap.

**Trade-off:** Google Vision is less accurate than Plant.id for specific plant identification — it returns general web entities rather than species-specific data. Used as fallback only.

---

### 5. Wikimedia Commons API (Sub-images)

| Tier | Price | Limits |
|------|-------|--------|
| **Always free** | **₹0** | No API key, no quota, no rate limit (reasonable use) |

No cost risk here.

---

### 6. Domain Name

| Option | Price | Notes |
|--------|-------|-------|
| **`vercel.app` subdomain (current)** | **Free** | `elan-greens.vercel.app` and `elan-greens-admin.vercel.app` |
| Custom domain (e.g. `elangreens.in`) | ~₹900/year | Requires purchase from GoDaddy/Namecheap + DNS config in Vercel |

**Trade-off:** Custom domain is more professional and portable (not tied to Vercel). Upgrade when the app is shared beyond society residents.

---

### 7. Open Source Libraries (Zero Cost)

All npm packages used are MIT licensed and free:

| Library | Purpose |
|---------|---------|
| Next.js | Framework |
| Tailwind CSS | Styling |
| shadcn/ui | Admin UI components |
| Leaflet.js | Interactive maps |
| exifr | EXIF GPS extraction |
| browser-image-compression | Client-side image resize |
| Zod | Schema validation |
| React Hook Form | Form state management |
| date-fns | Date formatting (age, tenure) |

---

## Summary: Free Tier Lifetime Estimate

At current usage levels (200 residents, 22–100 plants over time, 1 admin):

| Service | Free tier exhaustion | Action needed |
|---------|---------------------|---------------|
| Vercel | Never | None |
| Supabase DB | Never (< 1 MB data) | None |
| Supabase Storage | ~When 1,000 photos uploaded | Upgrade to Pro ($25/month) |
| Supabase Bandwidth | ~5,000 MAU | Upgrade to Pro |
| Plant.id | If adding > 100 plants/month | Upgrade to Lite (€9.99/month) |
| Google Vision | Unlikely | None |

---

## Minimum Viable Paid Plan (if ever needed)

If the app grows significantly, the minimum monthly cost would be:

| Service | Paid tier | Monthly |
|---------|-----------|---------|
| Vercel Pro | $20 | ~₹1,660 |
| Supabase Pro | $25 | ~₹2,075 |
| Plant.id Lite | €9.99 | ~₹900 |
| **Total** | | **~₹4,635/month** |

Custom domain: additional ~₹75/month (₹900/year).
