# OpenMRS AI Healthcare Test Automation Agent

**Talentserv AI Hackathon — Group 22 · Challenge 6**

AI-powered assistant that converts healthcare requirements into structured OpenMRS test scenarios, synthetic test data, automation skeletons, and privacy/security coverage reports.

Reference: [OpenMRS Core](https://github.com/openmrs/openmrs-core)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTs-akshayshipurkar%2Ftalentserv-ai-hackathon-group--Group22--ui-backend-db&project-name=openmrs-ai-test-agent&env=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,OPENAI_API_KEY,NEXT_PUBLIC_CLERK_SIGN_IN_URL,NEXT_PUBLIC_CLERK_SIGN_UP_URL,NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL&envDescription=Required%20keys%20for%20Clerk%20auth%20and%20OpenAI.%20See%20DEPLOYMENT.md%20for%20full%20list%20(including%20optional%20Groq%20%2B%20Supabase).&envLink=https%3A%2F%2Fgithub.com%2FTs-akshayshipurkar%2Ftalentserv-ai-hackathon-group--Group22--ui-backend-db%2Fblob%2Fmain%2FDEPLOYMENT.md)

---

## Features

| Feature | Status |
| ------- | ------ |
| Third-party auth (Clerk) with protected `/dashboard` | ✅ |
| Healthcare requirement input + 10 sample workflows | ✅ |
| Six-stage agentic pipeline with visible trace | ✅ |
| OpenMRS concepts (Patient, User, Role, Visit, Encounter, Obs) | ✅ |
| Test cases (Functional, Negative, Validation, Security, Privacy, Audit) | ✅ |
| Synthetic test data (no real PHI) | ✅ |
| Playwright + REST API automation skeletons | ✅ |
| Coverage report + safety checklist + QA validation | ✅ |
| Export Markdown / CSV / JSON | ✅ |
| Supabase generation history | ✅ (optional) |
| OpenAI + Groq model selection | ✅ |
| 10 agent meta-test cases | ✅ |

---

## Quick Start

### Prerequisites

- Node.js 20+
- [Clerk](https://clerk.com) account (free tier)
- [OpenAI](https://platform.openai.com) API key (default model: GPT-4o Mini)
- [Groq](https://console.groq.com) API key (optional, free-tier models)
- [Supabase](https://supabase.com) project (optional, for history)

### Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Clerk + LLM keys
npm run dev
```

Open **http://localhost:3000** → Sign in → **Dashboard** → pick a sample → **Generate**.

Full setup: **[DEPLOYMENT.md](DEPLOYMENT.md)** · Hackathon doc: [docs/7-deployment-guide.md](docs/7-deployment-guide.md)

---

## Project Structure

```
.
├── app/
│   ├── api/agent/          # Generate + history API routes
│   ├── dashboard/          # Main workspace + Agent QA page
│   ├── sign-in/, sign-up/  # Clerk auth
│   └── layout.tsx
├── components/             # UI panels (progress, validation, export)
├── lib/                    # Agent pipeline, schemas, prompts, validator
├── supabase/               # SQL schema + migrations
├── docs/                   # Hackathon submission documents
└── middleware.ts           # Clerk route protection
```

---

## Agent Pipeline

The UI shows **six stages**. The server runs **two LLM calls** plus **three local stages**:

```
Requirement Input
      ↓
Stages 1+2 — Requirement Analyzer + Risk Planner (combined LLM call)
      ↓
Stage 3 — Test Case Generator (LLM)
      ↓
Stage 4 — Synthetic Data Generator (local)
      ↓
Stage 5 — Automation Skeleton Writer (local)
      ↓
Stage 6 — Coverage & Safety Reviewer (local)
      ↓
Export (MD / CSV / JSON)
```

---

## API Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/agent/generate` | Run full agent pipeline |
| GET | `/api/agent/history` | List user's generation history |
| GET | `/api/agent/history/[id]` | Load a past generation |

---

## Hackathon Submission Documents

| # | Document | Description |
|---|----------|-------------|
| 1 | [Groomed Requirements](docs/1-groomed-requirements.md) | Scope, user stories, acceptance criteria |
| 2 | [Implementation Plan](docs/2-implementation-plan.md) | Step-by-step approach, modules, timeline |
| 3 | [Architecture](docs/3-architecture.md) | System design, data flow, integrations |
| 4 | [Test Plan](docs/4-test-plan.md) | Strategy + 10 agent meta-test cases |
| 5 | [Critical Review](docs/5-critical-review.md) | Quality, security, limitations, debt |
| 6 | [Agentic Evidence](docs/6-agentic-evidence.md) | Cursor AI development workflow |
| 7 | [Deployment Guide](docs/7-deployment-guide.md) | Setup, env vars, Vercel deployment |

---

## Environment Variables

See [`.env.local.example`](.env.local.example) and **[DEPLOYMENT.md §2](DEPLOYMENT.md#2-production-environment-variables)** for production.

### Required for production

| Variable | Public? | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend |
| `CLERK_SECRET_KEY` | **No** | Clerk server auth |
| `OPENAI_API_KEY` | **No** | Default GPT models |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Yes | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Yes | `/dashboard` |

### Optional

| Variable | Public? | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | **No** | Free Llama/Gemma models (recommended on Vercel Hobby) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server-side history writes |

> **Note:** This app does **not** use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use `SUPABASE_SERVICE_ROLE_KEY` (service role secret), not the anon key.

---

## Agent QA Meta-Tests

Ten documented test cases validating the agent itself (auth, schema, privacy, retry, export) are available in the dashboard at **Agent QA** (`/dashboard/agent-tests`) and in [docs/4-test-plan.md](docs/4-test-plan.md).

---

## Deploy to Vercel

**Recommended:** [Vercel Hobby (free)](https://vercel.com/pricing) — one deployment for UI + API routes.

### One-click deploy

Click the **Deploy with Vercel** button at the top of this README, then:

1. Connect your GitHub account and import the repo (or fork first).
2. Paste env vars when prompted (Clerk + OpenAI minimum).
3. Click **Deploy** — wait for the build (~2–3 min).
4. In [Clerk Dashboard](https://dashboard.clerk.com), add your `https://*.vercel.app` URL to allowed domains.
5. Open the live URL → Sign in → Dashboard → Generate.

### Manual deploy

Full step-by-step guide: **[DEPLOYMENT.md](DEPLOYMENT.md)**

**Free tier tip:** Vercel Hobby limits functions to **60 seconds**. Use a **Groq** model (set `GROQ_API_KEY`) for faster generations, or upgrade to Pro for 120s runs.

---

## Known Limitations

| Limitation | Next Step |
| ---------- | --------- |
| Automation skeletons are templates | Execute against OpenMRS Reference Application |
| LLM output varies by model | Use GPT-4o for highest quality |
| Supabase optional | Configure for persistent history |
| Long runs (60–90s) | Use GPT-4o Mini; ensure Vercel Pro for 120s timeout |

Details: [docs/5-critical-review.md](docs/5-critical-review.md)

---

## Team

**Group 22** — Talentserv AI Hackathon

---

## License

MIT (hackathon submission)
