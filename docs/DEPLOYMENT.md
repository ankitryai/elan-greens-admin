# Deployment Guide
## Elan Greens v1.0.0 | April 2026

> Complete step-by-step guide. Follow in order. Estimated time: 45–60 minutes
> for first-time setup.

---

## Prerequisites

- GitHub account: `ankitryai`
- Google account: `ankitryai@gmail.com` (used for OAuth)
- Node.js ≥ 18 installed locally
- Vercel CLI: `npm install -g vercel`

---

## Phase 1 — Supabase Setup (Database + Auth + Storage)

### Step 1.1 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → Sign in with GitHub
2. Click **New Project**
3. Name: `elan-greens`
4. Database password: generate a strong one and **save it safely**
5. Region: **South Asia (Mumbai)** — closest to Bengaluru for low TTFB
6. Click **Create new project** — wait ~2 minutes

### Step 1.2 — Run the schema
1. In Supabase dashboard → **SQL Editor** → **New query**
2. Copy the entire contents of `supabase/schema.sql` from this repo
3. Paste and click **Run**
4. Confirm: no errors shown, all three tables appear in **Table Editor**

### Step 1.3 — Run the seed data
1. SQL Editor → New query
2. Copy `supabase/seed.sql`, paste, run
3. Confirm: 22 rows appear in `plant_species` table

### Step 1.4 — Create Storage buckets
1. Supabase dashboard → **Storage** → **New bucket**
2. Create bucket: `plant-images` | **Public: ON**
3. Create bucket: `staff-photos` | **Public: ON**

### Step 1.5 — Enable Google OAuth
1. Supabase dashboard → **Authentication** → **Providers**
2. Find **Google** → toggle ON
3. You need Google OAuth credentials:
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a project (or use existing) → **APIs & Services** → **Credentials**
   - **Create credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised redirect URIs: copy from Supabase (shown on the Google provider page)
   - Save → copy **Client ID** and **Client Secret**
4. Paste Client ID and Secret into Supabase Google provider config → Save

### Step 1.6 — Save your Supabase credentials
From Supabase **Settings** → **API**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← keep this secret, admin app only
```

---

## Phase 2 — Plant.id API Setup

1. Go to [plant.id](https://plant.id) → Sign up (free)
2. Dashboard → **API Keys** → Create key
3. Save as `PLANT_ID_API_KEY=your_key_here`
4. Note: 100 free identifications/month. Monitor in Plant.id dashboard.

---

## Phase 3 — Google Cloud Vision API Setup (Fallback)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Cloud Vision API** for your project
3. **Credentials** → **Create credentials** → **API Key**
4. (Recommended) Restrict the key to Cloud Vision API only
5. Save as `GOOGLE_VISION_API_KEY=your_key_here`
6. Note: Billing must be enabled on the GCP project even for free tier.
   Google will NOT charge until you exceed 1,000 units/month AND explicitly
   upgrade your billing account. Set a budget alert at $1/month to be safe.

---

## Phase 4 — Deploy Admin App (`elan-greens-admin`)

### Step 4.1 — Create `.env.local`
In `elan-greens-admin/` directory, create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PLANT_ID_API_KEY=your_plant_id_key
GOOGLE_VISION_API_KEY=your_vision_key
SUPERADMIN_EMAIL=ankitryai@gmail.com
```

### Step 4.2 — Test locally
```bash
cd elan-greens-admin
npm install
npm run dev
# Visit http://localhost:3001
# Test: login with Google → should reach dashboard
# Test: add a plant → should save to Supabase
```

### Step 4.3 — Deploy to Vercel
```bash
cd elan-greens-admin
vercel login          # first time only
vercel                # follow prompts:
                      # - Link to GitHub repo: ankitryai/elan-greens-admin
                      # - Framework: Next.js (auto-detected)
```

### Step 4.4 — Set environment variables on Vercel
```bash
# Run each of these:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add PLANT_ID_API_KEY
vercel env add GOOGLE_VISION_API_KEY
vercel env add SUPERADMIN_EMAIL
```
Or add them via Vercel dashboard → Project → Settings → Environment Variables.

### Step 4.5 — Production deploy
```bash
vercel --prod
```
Admin app is live at: `https://elan-greens-admin.vercel.app`

---

## Phase 5 — Deploy Main App (`elan-greens`)

### Step 5.1 — Create `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Note: Main app needs ONLY these two. No service role key. No third-party API keys.

### Step 5.2 — Test locally
```bash
cd elan-greens
npm install
npm run dev
# Visit http://localhost:3000
# Confirm plants load from Supabase
```

### Step 5.3 — Deploy to Vercel
```bash
vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```
Main app is live at: `https://elan-greens.vercel.app`

---

## Phase 6 — Post-Deployment Checks

```bash
# Run Lighthouse on main app
npx lighthouse https://elan-greens.vercel.app --view

# Confirm Supabase is not paused
# Visit: https://app.supabase.com → your project → should show green status

# Test admin login
# Visit: https://elan-greens-admin.vercel.app/login
# Sign in with ankitryai@gmail.com → should reach dashboard

# Test plant appears on main app
# Add one plant in admin → check it appears on elan-greens.vercel.app
```

---

## Keeping Supabase Active (Free Tier)

Supabase pauses free projects after 7 days with no database activity.

**Simplest solution:** Visit the admin app at least once a week. Any page load that reads from Supabase counts as activity.

**Automated solution (optional):** Set a Vercel cron job (free) to ping the app once daily:
- Vercel dashboard → admin project → Settings → Cron Jobs
- Schedule: `0 9 * * *` (9 AM daily)
- URL: `/api/health` (a simple API route that does `SELECT 1` on Supabase)

---

## Re-deployment (Future Updates)

After making code changes:
```bash
git add .
git commit -m "describe your change"
git push origin main
# Vercel auto-deploys on push to main branch
```

Vercel is connected to GitHub — every push to `main` triggers an automatic production deployment.
