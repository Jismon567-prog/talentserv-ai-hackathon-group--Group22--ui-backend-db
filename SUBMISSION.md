# Hackathon Submission — Group 22

**Challenge 6:** OpenMRS AI Healthcare Test Automation Agent  
**Team:** Talentserv AI Hackathon — Group 22

---

## Live demo (start here)

**URL:** https://openmrs-ai-test-agent.vercel.app

1. Click **Sign in** (Clerk — Google or email).
2. Go to **Dashboard**.
3. Click a **sample requirement** (e.g. Patient View Access).
4. Choose **Llama 3.1 8B Instant** (fastest on free Vercel tier).
5. Click **Generate** (~30–90s).
6. Review tabs: Test Cases · Coverage · Synthetic Data · Automation · Safety · Export.

---

## Repository

https://github.com/Ts-akshayshipurkar/talentserv-ai-hackathon-group--Group22--ui-backend-db

---

## Submission documents

| # | Document |
|---|----------|
| 1 | [Groomed Requirements](docs/1-groomed-requirements.md) |
| 2 | [Implementation Plan](docs/2-implementation-plan.md) |
| 3 | [Architecture](docs/3-architecture.md) |
| 4 | [Test Plan (+ 10 meta-tests)](docs/4-test-plan.md) |
| 5 | [Critical Review](docs/5-critical-review.md) |
| 6 | [Agentic Evidence](docs/6-agentic-evidence.md) |
| 7 | [Deployment Guide](docs/7-deployment-guide.md) |
| 8 | [Demo Video Script](docs/8-demo-video-script.md) |
| 9 | [**Evaluation Coverage (100%)**](docs/9-evaluation-coverage.md) |

---

## Automated verification

```bash
npm install && npm test && npm run build
cd automation/playwright && npm install && npx playwright install chromium && npm test
```

CI: `.github/workflows/ci.yml` (lint · Vitest · build · Playwright smoke)

---

## Agent QA meta-tests (UI)

Dashboard → **Agent QA** → `/dashboard/agent-tests`

Automated: `npm test` maps to TC-AGENT-001 through TC-AGENT-010.

---

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTs-akshayshipurkar%2Ftalentserv-ai-hackathon-group--Group22--ui-backend-db&project-name=openmrs-ai-test-agent)

Full steps: [DEPLOYMENT.md](DEPLOYMENT.md)
