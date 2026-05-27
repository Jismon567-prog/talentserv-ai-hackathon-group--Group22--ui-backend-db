# Source Code and Deployment Guide

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Version:** 1.0  
**Date:** May 2026

---

## 1. Repository Structure

```
.
├── app/
│   ├── api/agent/
│   │   ├── generate/route.ts      # Six-stage agent pipeline
│   │   └── history/               # List + load generations
│   ├── dashboard/
│   │   ├── page.tsx               # Main workspace
│   │   ├── layout.tsx             # Sidebar navigation
│   │   └── agent-tests/page.tsx   # Meta-testing catalog
│   ├── sign-in/, sign-up/         # Clerk auth pages
│   ├── layout.tsx                 # Root layout + ClerkProvider
│   └── page.tsx                   # Landing page
├── components/                    # UI panels and widgets
├── lib/                           # Agent logic, schemas, prompts
├── supabase/                      # SQL schema + migrations
├── docs/                          # Hackathon submission documents
├── middleware.ts                  # Clerk route protection
├── .env.local.example             # Environment template
├── package.json
└── README.md
```

---

## 2. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Clerk account | Free tier OK |
| OpenAI API key | Required for default model (GPT-4o Mini) |
| Groq API key | Optional (free-tier models) |
| Supabase project | Optional (generation history) |

---

## 3. Environment Variables

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

### Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `OPENAI_API_KEY` | OpenAI API key (for GPT models) |

### Optional

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key for free Llama/Gemma models |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** secret (not anon key) |

> **Security:** Never commit `.env.local`. Never expose service role or secret keys in client-side code.

---

## 4. Local Setup Instructions

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Configure Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy API keys into `.env.local`
3. Enable sign-in methods (email, Google, etc.)
4. Add `http://localhost:3000` to allowed origins

### Step 3 — Configure LLM provider

Add at least one of:

```env
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...
```

### Step 4 — (Optional) Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Run migrations in `supabase/migrations/` if upgrading an existing table
4. Copy project URL and **service_role** key to `.env.local`

### Step 5 — Start development server

```bash
npm run dev
```

Open **http://localhost:3000** (or the port shown if 3000 is in use).

### Step 6 — Demo flow

1. Sign up / Sign in
2. Navigate to **Dashboard**
3. Click a sample requirement (e.g., "Patient registration")
4. Select model (default: **GPT-4o Mini**)
5. Click **Generate**
6. Review test cases, synthetic data, automation, coverage
7. Export via toolbar (Markdown / JSON / CSV)

---

## 5. Build and Production Run

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build

# Start production server locally
npm run start
```

---

## 6. Deployment to Vercel (Recommended)

### Step 1 — Push to GitHub

Ensure the repository is pushed to a GitHub remote accessible to Vercel.

### Step 2 — Import project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repository
3. **Root Directory:** `.` (repository root — single Next.js app)
4. Framework preset: **Next.js**

### Step 3 — Configure environment variables

Add all variables from `.env.local.example` in Vercel → Settings → Environment Variables:

- Clerk keys and routing URLs (update redirect URLs to production domain)
- `OPENAI_API_KEY`
- `GROQ_API_KEY` (optional)
- Supabase vars (optional)

### Step 4 — Configure Clerk for production

1. Add your Vercel URL (e.g., `https://your-app.vercel.app`) to Clerk allowed domains
2. Update fallback redirect URLs if using a custom domain

### Step 5 — Deploy

Click **Deploy**. Vercel will run `npm run build` automatically.

### Step 6 — Verify

1. Open deployed URL
2. Sign in
3. Run a sample generation
4. Confirm history persists (if Supabase configured)

### Vercel Notes

| Topic | Detail |
|-------|--------|
| **Function timeout** | Route sets `maxDuration = 120`; requires Vercel Pro for full duration on serverless |
| **Cold starts** | First request after idle may add 2–5s |
| **Env vars** | Redeploy after changing secrets |

---

## 7. Supabase Setup Details

### Initial schema

Execute `supabase/schema.sql` in the Supabase SQL Editor.

### Migrations (if table already exists)

```sql
-- supabase/migrations/002_add_missing_columns.sql
-- supabase/migrations/003_disable_rls.sql
```

### Troubleshooting history save

| Error | Fix |
|-------|-----|
| RLS policy violation | Run `003_disable_rls.sql`; verify service_role key |
| Missing column | Run `002_add_missing_columns.sql` |
| History empty in UI | Check env vars; `/api/agent/history` returns `configured: false` if missing |

---

## 8. API Reference (Deployed)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent/generate` | Required | Run agent pipeline |
| GET | `/api/agent/history` | Required | List generation summaries |
| GET | `/api/agent/history/[id]` | Required | Load single generation |

### Example generate request

```bash
curl -X POST https://your-app.vercel.app/api/agent/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <clerk-session-cookie>" \
  -d '{
    "requirement": "As a Registration Clerk, I want to register a new outpatient with demographics and OpenMRS ID, rejecting duplicate identifiers and logging an audit entry.",
    "model": "gpt-4o-mini"
  }'
```

> Direct curl requires a valid Clerk session cookie. Use the dashboard for demos.

---

## 9. Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Grammarly extension hydration warning | Fixed | `suppressHydrationWarning` on `<body>` |
| Slow generation (60–90s) | Expected | Use GPT-4o Mini; shorter requirements |
| Groq rate limits | Handled | Auto-retry with backoff; switch model |
| Vercel Hobby 10s/60s timeout | Platform limit | Upgrade to Pro or use faster models |
| Placeholder nav pages | Open | Requirements, Settings pages not implemented |
| Port 3000 in use | Environmental | Next.js auto-selects 3001 |
| History without Supabase | By design | localStorage caches current session only |

---

## 10. Troubleshooting

### "You must be signed in to call the agent"

- Ensure Clerk keys are correct
- Sign in before generating
- Check middleware is not blocking API routes

### "Failed to initialize the LLM client"

- Verify `OPENAI_API_KEY` or `GROQ_API_KEY` is set
- Ensure selected model matches available provider

### "Request timed out"

- Try GPT-4o Mini (default)
- Use a shorter requirement
- Check Vercel function timeout limits
- Client waits up to 130 seconds

### TypeScript / build errors

```bash
npx tsc --noEmit
npm run lint
```

---

## 11. Submission Artifacts Checklist

- [x] Source code in Git repository
- [x] `.env.local.example` with all variables documented
- [x] Local run instructions (this document)
- [x] Deployment guide for Vercel
- [x] Seven submission documents in `docs/`
- [x] README linking all documents
- [x] Sample requirements in UI
- [x] 10 agent meta-test cases in `/dashboard/agent-tests`

---

## 12. Related Documents

- [Architecture](./3-architecture.md)
- [Implementation Plan](./2-implementation-plan.md)
- [Test Plan](./4-test-plan.md)
- [Critical Review](./5-critical-review.md)
