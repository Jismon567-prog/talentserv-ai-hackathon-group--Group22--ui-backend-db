# OpenMRS Healthcare Test Automation Agent

**Talentserv AI Hackathon — Group 22 · Challenge 6**

AI-powered assistant that converts healthcare requirements into structured OpenMRS test scenarios, synthetic test data, automation skeletons, and privacy/security coverage reports.

Reference: [OpenMRS Core](https://github.com/openmrs/openmrs-core)

---

## Features (MVP)

| Feature | Status |
| ------- | ------ |
| Third-party auth (Clerk) with protected `/dashboard` | ✅ |
| Healthcare requirement input + sample workflows | ✅ |
| 5-stage agentic pipeline with visible trace | ✅ |
| OpenMRS concepts (Patient, User, Role, Visit, Encounter) | ✅ |
| Test cases (functional, validation, negative, security, privacy, audit) | ✅ |
| Synthetic test data (no real PHI) | ✅ |
| REST-assured + Playwright automation skeletons | ✅ |
| Coverage & safety checklist | ✅ |
| Export Markdown / CSV / JSON | ✅ |
| 10 automated validation tests for the assistant | ✅ |

---

## Project Structure

```
.
├── ui/                 # Next.js 15 + Clerk auth (frontend)
├── backend/            # Express API + agent pipeline
├── db/                 # JSON persistence for generations
├── automation/         # Playwright UI + REST-assured API skeletons
├── docs/               # Agentic workflow evidence + samples
└── README.md
```

---

## Prerequisites

- Node.js 20+
- npm 10+
- [Clerk](https://clerk.com) account (free tier) for authentication

---

## Quick Start (Local)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Clerk (required for auth)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy keys into `ui/.env.local`:

```bash
cp ui/.env.example ui/.env.local
```

Edit `ui/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 3. Start backend + frontend

```bash
npm run dev
```

- **UI:** http://localhost:3000
- **API:** http://localhost:4000

### 4. Demo flow

1. Open http://localhost:3000
2. Sign up / Sign in with Clerk (Google, email, etc.)
3. Go to **Dashboard**
4. Click a sample requirement or paste your own
5. Click **Generate Test Plan**
6. Review agent trace, test cases, synthetic data, automation skeletons, coverage
7. Export as Markdown, CSV, or JSON

---

## Auth Configuration Notes

- **Provider:** [Clerk](https://clerk.com) — third-party auth (no custom password storage)
- **Protected routes:** `/dashboard` (enforced via `ui/middleware.ts`)
- **Public routes:** `/`, `/sign-in`, `/sign-up`
- **User identity:** Displayed on dashboard; sent to backend as `userId` + optional `userEmail`

Clerk setup checklist:
- Enable desired social providers in Clerk dashboard
- Set sign-in/sign-up URLs to `/sign-in` and `/sign-up`
- Add `http://localhost:3000` to allowed origins for local dev

---

## API Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Health check |
| GET | `/api/samples` | Sample healthcare requirements |
| POST | `/api/generate` | Run full agent pipeline |
| GET | `/api/history/:userId` | User generation history |
| GET | `/api/export/:id/markdown` | Export test plan (Markdown) |
| GET | `/api/export/:id/csv` | Export test cases (CSV) |
| GET | `/api/export/:id/json` | Export full result (JSON) |

### Sample generate request

```bash
curl -X POST http://localhost:4000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "As a clinician, I can view patient records. Unauthorized users must be blocked.",
    "userId": "demo-user"
  }'
```

---

## Sample Input Requirements

Built-in samples (also available via `/api/samples`):

1. **Patient Registration** — demographics, duplicate identifiers, invalid birthdates
2. **Patient View Access** — authorized vs unauthorized access
3. **Visit and Encounter Creation** — status transitions
4. **Role-based Workflow Permissions** — receptionist, clinician, admin
5. **Privacy and Audit Trail** — PHI visibility and audit logging

---

## Running Tests

### Assistant validation tests (10 test cases)

```bash
npm run test -w backend
```

Tests cover: workflow detection, agent stages, OpenMRS test case quality, synthetic data safety, automation skeletons, coverage report, export formats, and API endpoints.

### UI automation skeleton (Playwright)

```bash
cd automation/playwright
npx playwright install chromium
npx playwright test
```

### Full automation script

```bash
chmod +x automation/run-tests.sh
./automation/run-tests.sh
```

---

## Agentic Workflow

```
Requirement Input
      ↓
Healthcare Requirement Analyzer
      ↓
Risk & Privacy Test Planner
      ↓
Functional Test Generator
      ↓
Automation Skeleton Writer
      ↓
Coverage & Safety Reviewer
      ↓
Export (MD / CSV / JSON)
```

See [docs/AGENTIC_WORKFLOW.md](docs/AGENTIC_WORKFLOW.md) for evidence and iteration notes.

---

## Deployment

**Recommended:** Deploy to [Vercel](https://vercel.com) (UI + API in one app).

See the full step-by-step guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

### Quick deploy checklist

1. Push repo to GitHub
2. Import in Vercel with **Root Directory** = `ui`
3. Add Clerk env vars in Vercel (same as `ui/.env.local`)
4. Add your Vercel URL to Clerk allowed domains
5. Deploy → use `https://your-app.vercel.app` as demo URL

---

## Deployment (details)

### UI (Vercel recommended)

1. Deploy `ui/` workspace
2. Set Clerk env vars in Vercel dashboard
3. Set `NEXT_PUBLIC_API_URL` to deployed backend URL

### Backend (Railway / Render / Fly.io)

1. Deploy `backend/` workspace
2. Set `PORT` and `CORS_ORIGIN` (frontend URL)
3. Ensure `db/data/` is writable or swap to cloud storage

---

## Known Limitations & Next Steps

| Limitation | Next Step |
| ---------- | --------- |
| Rule-based agent (no live LLM by default) | Integrate OpenAI/Anthropic for richer analysis |
| JSON file DB | Migrate to PostgreSQL/SQLite |
| Automation skeletons are templates | Execute against mock OpenMRS API |
| Clerk required for dashboard | Add demo mode for judges without accounts |
| No CI/CD pipeline | Add GitHub Actions running `npm test` + Playwright |

---

## Submission Checklist

- [x] Git repository with ui / backend / db
- [x] README with setup and run instructions
- [x] Auth configuration notes (Clerk)
- [x] Local run instructions
- [x] Sample input requirements
- [x] Generated test plan export support
- [x] 10 test cases for the assistant
- [x] Agentic workflow evidence
- [x] Known limitations documented

---

## Team

**Group 22** — Talentserv AI Hackathon

---

## License

MIT (hackathon submission)
