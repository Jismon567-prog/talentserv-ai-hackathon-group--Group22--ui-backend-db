# Deploy to Vercel (Free Tier)

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Stack:** Next.js 15 · Clerk · Supabase · OpenAI / Groq

This guide walks through deploying the app to [Vercel Hobby (free)](https://vercel.com/pricing) with Clerk authentication and optional Supabase history.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Production Environment Variables](#2-production-environment-variables)
3. [Deploy from GitHub (Recommended)](#3-deploy-from-github-recommended)
4. [Deploy with the Vercel CLI](#4-deploy-with-the-vercel-cli)
5. [Configure Clerk for Production](#5-configure-clerk-for-production)
6. [Configure Supabase for Production](#6-configure-supabase-for-production)
7. [Post-Deploy Verification](#7-post-deploy-verification)
8. [Free Tier Limits & Workarounds](#8-free-tier-limits--workarounds)
9. [Best Practices (Clerk + Supabase + Vercel)](#9-best-practices-clerk--supabase--vercel)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Item | Free tier | Notes |
|------|-----------|-------|
| [GitHub](https://github.com) account | ✅ | Repo must be pushed to GitHub |
| [Vercel](https://vercel.com) account | ✅ Hobby plan | Sign in with GitHub |
| [Clerk](https://clerk.com) application | ✅ | Auth provider |
| [OpenAI](https://platform.openai.com) API key | Pay-as-you-go | Default model is GPT-4o Mini |
| [Groq](https://console.groq.com) API key | ✅ Free tier | Optional; good for demos on Hobby timeout |
| [Supabase](https://supabase.com) project | ✅ Free tier | Optional; generation history |

**Before deploying**, confirm the app builds locally:

```bash
npm install
cp .env.local.example .env.local
# fill in keys, then:
npm run build
```

---

## 2. Production Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables**. Apply to **Production** (and Preview if you want PR previews to work).

### Required (minimum working deploy)

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview | Clerk publishable key (`pk_live_...` or `pk_test_...`) |
| `CLERK_SECRET_KEY` | Production, Preview | Clerk secret key (`sk_live_...` or `sk_test_...`) — **server only** |
| `OPENAI_API_KEY` | Production, Preview | OpenAI API key for GPT models — **server only** |

### Required for correct Clerk routing

| Variable | Example value |
|----------|---------------|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |

### Optional — Groq (free LLM models)

| Variable | Scope | Description |
|----------|-------|-------------|
| `GROQ_API_KEY` | Production, Preview | Enables Llama/Gemma models in the model picker |

### Optional — Supabase (generation history)

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | **service_role** secret — **server only** |

### Optional — automation skeleton base URL

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://openmrs-test.example.org` | OpenMRS base URL in generated Playwright/REST snippets |

---

### Important: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is **not used**

This project does **not** read `NEXT_PUBLIC_SUPABASE_ANON_KEY`. History is written from **API routes only** using the **service role** key:

- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → `service_role` secret)
- ❌ Do **not** put the anon/public key in `SUPABASE_SERVICE_ROLE_KEY` — inserts will fail with RLS errors

The anon key is only needed if you add client-side Supabase access later. For the current app, skip it.

---

### Copy-paste checklist for Vercel

```env
# Clerk (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# LLM (at least one provider)
OPENAI_API_KEY=
GROQ_API_KEY=

# Supabase (optional — history)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Security:** Never prefix secret keys with `NEXT_PUBLIC_`. Only Clerk publishable key and Supabase URL are public.

---

## 3. Deploy from GitHub (Recommended)

### Step 1 — Push code to GitHub

Ensure your repository is on GitHub (this project’s remote):

`https://github.com/Ts-akshayshipurkar/talentserv-ai-hackathon-group--Group22--ui-backend-db`

Or use the **Deploy to Vercel** button in [README.md](./README.md).

### Step 2 — Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import** your GitHub repository
3. **Root Directory:** `.` (repository root — do not select a subfolder)
4. **Framework Preset:** Next.js (auto-detected)
5. **Build Command:** `npm run build` (default)
6. **Output Directory:** leave default (Next.js)

### Step 3 — Add environment variables

Before clicking **Deploy**, expand **Environment Variables** and add every variable from [§2](#2-production-environment-variables).

Tip: paste from `.env.local.example` and replace placeholders with production values.

### Step 4 — Deploy

Click **Deploy**. First build takes ~2–3 minutes.

Your app will be live at:

`https://<project-name>.vercel.app`

### Step 5 — Configure Clerk (required before sign-in works)

See [§5 Configure Clerk for Production](#5-configure-clerk-for-production).

---

## 4. Deploy with the Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link          # link to new or existing project
vercel env pull .env.vercel.local   # optional: pull env for local testing
vercel --prod
```

Add secrets interactively or in the Vercel dashboard before `vercel --prod`.

---

## 5. Configure Clerk for Production

After the first deploy, copy your Vercel URL (e.g. `https://openmrs-ai-agent.vercel.app`).

### In [Clerk Dashboard](https://dashboard.clerk.com)

1. **Domains** — add your Vercel production URL
2. **Paths** — confirm sign-in `/sign-in`, sign-up `/sign-up`
3. **Social providers** — enable Google/email as needed for demos
4. **API Keys** — for production demos you may use `pk_live_` / `sk_live_` keys; `pk_test_` works for hackathon judges if the domain is allowlisted

### Update Vercel env if using production Clerk keys

Replace `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, then **Redeploy** (Deployments → ⋮ → Redeploy).

### Common Clerk + Vercel mistake

If sign-in redirects to localhost, your Clerk **Allowed redirect URLs** still point to `http://localhost:3000`. Add:

- `https://your-app.vercel.app`
- `https://your-app.vercel.app/dashboard`

---

## 6. Configure Supabase for Production

Skip this section if you do not need persisted history (the app works without Supabase).

### Step 1 — Create a Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Choose region close to your Vercel deployment (e.g. `us-east-1`)

### Step 2 — Run the schema

In **SQL Editor**, run:

1. `supabase/schema.sql`
2. If the table already exists: `supabase/migrations/002_add_missing_columns.sql`
3. `supabase/migrations/003_disable_rls.sql` (required for service-role inserts)

### Step 3 — Copy credentials to Vercel

From **Project Settings → API**:

| Supabase field | Vercel env var |
|----------------|----------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `service_role` secret (Reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

**Do not** use the `anon` public key for `SUPABASE_SERVICE_ROLE_KEY`.

### Step 4 — Redeploy

Trigger a redeploy so serverless functions pick up new env vars.

---

## 7. Post-Deploy Verification

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `https://your-app.vercel.app` | Landing page loads |
| 2 | Click Sign in | Clerk modal / sign-in page |
| 3 | Complete sign-in | Redirect to `/dashboard` |
| 4 | Select sample requirement | Textarea fills |
| 5 | Choose **Llama 3.1 8B Instant** (Groq) or **GPT-4o Mini** | Model selected |
| 6 | Click **Generate** | Stage progress runs; results in ~30–90s |
| 7 | Open **Coverage** tab | Score and gaps visible |
| 8 | Export → Copy JSON | Clipboard has valid JSON |
| 9 | (If Supabase) Check sidebar history | New run appears after generation |

---

## 8. Free Tier Limits & Workarounds

### Vercel Hobby function timeout (60 seconds)

The generate route can take **60–90+ seconds** (two LLM calls). Vercel **Hobby** caps serverless functions at **60 seconds**.

This repo includes `vercel.json` setting `maxDuration: 60` for the generate route. The route source also declares `maxDuration = 120` (for Pro).

| Plan | Max function duration | Recommendation |
|------|----------------------|----------------|
| **Hobby (free)** | 60s | Use **Groq** fast models; keep requirements concise |
| **Pro (paid)** | up to 300s | Use GPT-4o Mini default; full pipeline reliable |

**If generation times out on free tier:**

1. Switch model to **Llama 3.1 8B Instant** (Groq)
2. Use a shorter sample requirement
3. Ensure `GROQ_API_KEY` is set in Vercel
4. Upgrade to Vercel Pro for longer runs

### OpenAI costs

GPT-4o Mini is low cost but not free. Set [OpenAI usage limits](https://platform.openai.com/settings/organization/limits) before public demos.

### Supabase free tier

500 MB database, 50k monthly active users — more than enough for hackathon history.

---

## 9. Best Practices (Clerk + Supabase + Vercel)

### Security

1. **Never commit** `.env.local` — it is gitignored
2. **Never expose** `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to the browser
3. Use **separate Clerk apps** for development vs production when possible
4. Rotate keys if they appear in logs or screenshots
5. Supabase **service role** bypasses RLS — all access control is in your API (`user_id` filter in `lib/history.ts`)

### Clerk

1. Add **only** your real Vercel domains to Clerk allowed origins
2. Use **Production** Clerk keys (`pk_live_` / `sk_live_`) for judge-facing demos
3. Keep redirect URLs in sync with `NEXT_PUBLIC_CLERK_*_URL` env vars
4. Enable **Bot protection** in Clerk for public demos if abuse is a concern

### Supabase

1. Run `003_disable_rls.sql` **or** implement proper RLS policies before using anon key client-side
2. Use **service role only on the server** (current architecture)
3. Back up schema SQL in repo (`supabase/`) — already done
4. Pick a Supabase region near Vercel deployment region for lower latency

### Vercel

1. Enable **Preview Deployments** for PRs; use **test** Clerk/Supabase keys on Preview env
2. Pin **Production** env vars separately from Preview
3. After changing env vars, always **Redeploy** — they are not hot-reloaded
4. Monitor **Functions** tab for timeout errors on `/api/agent/generate`
5. Use `vercel logs <deployment-url>` or the dashboard log stream for LLM failures

### Performance on free tier

1. Default demo model: **Groq Llama 3.1 8B Instant** (fastest)
2. Pre-warm: hit the landing page once before a live demo (reduces cold start)
3. Avoid running multiple generations in parallel on the same Hobby instance during demos

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 401 on Generate | Clerk session missing | Sign in; check Clerk keys and domain |
| CONFIG_ERROR | Missing LLM key | Set `OPENAI_API_KEY` and/or `GROQ_API_KEY` |
| 504 / TIMEOUT | Hobby 60s limit | Use Groq fast model or upgrade Pro |
| Sign-in redirects to localhost | Clerk redirect URLs | Add Vercel URL in Clerk dashboard |
| History empty | Supabase not configured | Set Supabase env vars; run schema SQL |
| RLS policy error on save | Wrong Supabase key | Use **service_role**, not anon key |
| Build fails on Vercel | TypeScript error | Run `npm run build` locally first |
| Hydration warning in console | Browser extension (Grammarly) | Harmless; or disable extension on demo URL |

---

## `vercel.json` (included in repo)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "functions": {
    "app/api/agent/generate/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Why:** Aligns with Vercel Hobby’s 60-second cap. On **Pro**, you can raise this to `120` to match `app/api/agent/generate/route.ts`.

No other `vercel.json` entries are required — Next.js App Router, Clerk middleware, and API routes work out of the box.

---

## Related docs

- [README.md](./README.md) — quick start + deploy button
- [docs/7-deployment-guide.md](./docs/7-deployment-guide.md) — hackathon submission deployment section
- [.env.local.example](./.env.local.example) — local env template

---

## Quick deploy checklist

- [ ] GitHub repo pushed
- [ ] Vercel project imported (root directory `.`)
- [ ] All Clerk + LLM env vars set in Vercel
- [ ] Supabase schema applied (if using history)
- [ ] Clerk production domain allowlisted
- [ ] Test sign-in → generate → export on live URL
- [ ] Demo model chosen based on plan (Groq on Hobby, OpenAI on Pro)
