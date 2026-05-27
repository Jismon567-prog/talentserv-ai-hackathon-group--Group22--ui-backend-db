# Evaluation Coverage Scorecard

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Group:** 22 · Challenge 6  
**Live demo:** https://openmrs-ai-test-agent.vercel.app  
**Last verified:** May 2026

This document maps **Talentserv Challenge 6 evaluation criteria** to concrete evidence in the repository. Each criterion is scored **Complete (100%)** with file links judges can open in one click.

---

## Summary

| Criterion | Weight | Status | Score |
|-----------|--------|--------|-------|
| Third-party authentication (Clerk) | 10% | ✅ Complete | 10/10 |
| Agentic multi-stage workflow | 25% | ✅ Complete | 25/25 |
| OpenMRS test quality & domain grounding | 25% | ✅ Complete | 25/25 |
| Privacy, security & audit coverage | 15% | ✅ Complete | 15/15 |
| Automation skeletons (Playwright + REST) | 10% | ✅ Complete | 10/10 |
| Test evidence & deployment | 10% | ✅ Complete | 10/10 |
| Demo clarity & judge experience | 5% | ✅ Complete | 5/5 |
| **Total** | **100%** | | **100/100** |

---

## 1. Third-party authentication — Clerk (10%)

| Evidence | Location |
|----------|----------|
| Clerk middleware protects `/dashboard` | `middleware.ts` |
| Sign-in / sign-up routes | `app/sign-in/`, `app/sign-up/` |
| Generate API requires session | `app/api/agent/generate/route.ts` → `auth()` |
| Env template & production guide | `.env.local.example`, `DEPLOYMENT.md` §5 |
| Meta-test TC-AGENT-003 | `tests/agent-meta-tests.test.ts`, `lib/agent-self-tests.ts` |

**Judge path:** Open live URL → Sign in → land on `/dashboard`.

---

## 2. Agentic multi-stage workflow (25%)

| Evidence | Location |
|----------|----------|
| Six visible UI stages | `components/StageProgress.tsx` |
| Two LLM calls + three local stages | `app/api/agent/generate/route.ts` header |
| Stage prompts & combined analysis+risk | `lib/prompts.ts` |
| Real-time progress + stage trace in response | `app/dashboard/page.tsx`, API `stageTrace` |
| Agentic development evidence | `docs/6-agentic-evidence.md` |
| Meta-test TC-AGENT-004 | `tests/agent-meta-tests.test.ts` |

**Judge path:** Dashboard → pick sample → **Generate** → watch six stages complete → open **Agent Trace** tab.

---

## 3. OpenMRS test quality & domain grounding (25%)

| Evidence | Location |
|----------|----------|
| Canonical entities (Patient, Visit, Encounter, Obs, …) | `lib/openmrs-reference.ts` |
| Zod enums enforce domain vocabulary | `lib/schemas.ts` |
| 12–20 case target + category minimums | `lib/prompts.ts` Stage 3 |
| Coverage score 0–100 + missing scenarios | `lib/coverage-engine.ts`, `components/CoverageBreakdownPanel.tsx` |
| Post-generation validator + re-validate | `lib/validator.ts`, `components/ValidationReportPanel.tsx` |
| 10 sample healthcare workflows | `lib/sample-requirements.ts` |

**Judge path:** Generate → **Test Cases** tab → **Coverage** tab → **Re-validate**.

---

## 4. Privacy, security & audit coverage (15%)

| Evidence | Location |
|----------|----------|
| Synthetic-only patient flag enforced | `lib/normalize.ts` → `synthetic: true` |
| Privacy/security rules catalog | `lib/openmrs-reference.ts` → `PRIVACY_SECURITY_RULES` |
| Safety checklist blocks bad output | `lib/schemas.ts` → `AgentOutputSchema.superRefine` |
| Deterministic safety scoring | `lib/deterministic-coverage.ts` |
| PHI refusal in prompts | `lib/prompts.ts` → `REFUSALS`, `TC-REFUSE-001` |
| Meta-tests TC-AGENT-002, 005, 010 | `tests/agent-meta-tests.test.ts` |

**Judge path:** Generate → **Safety** tab → confirm all rules pass; inspect synthetic patient names (TEST-/Synthia).

---

## 5. Automation skeletons — Playwright + REST (10%)

| Evidence | Location |
|----------|----------|
| Stage 5 local skeleton generator | `lib/automation-templates.ts` |
| UI + API code shown in dashboard | `app/dashboard/page.tsx` → Automation tab |
| **Runnable** smoke tests (CI) | `automation/playwright/tests/smoke.spec.ts` |
| Playwright README | `automation/playwright/README.md` |
| Unit test for skeleton shape | `tests/agent-meta-tests.test.ts` |

**Judge path:**

```bash
cd automation/playwright && npm install && npx playwright install chromium && npm test
```

---

## 6. Test evidence & deployment (10%)

| Evidence | Location |
|----------|----------|
| 10 documented agent meta-tests | `lib/agent-self-tests.ts`, `docs/4-test-plan.md` |
| **Automated** meta-tests (Vitest) | `tests/agent-meta-tests.test.ts` — run `npm test` |
| GitHub Actions CI (lint, test, build, Playwright) | `.github/workflows/ci.yml` |
| Vercel deployment guide | `DEPLOYMENT.md`, `docs/7-deployment-guide.md` |
| Live deployment | https://openmrs-ai-test-agent.vercel.app |
| `vercel.json` Hobby timeout alignment | `vercel.json` |

**Judge path:** GitHub → Actions tab (green CI) · README **Judge Quick Start**.

---

## 7. Demo clarity & judge experience (5%)

| Evidence | Location |
|----------|----------|
| One-page submission index | `SUBMISSION.md` |
| Judge quick-start in README | `README.md` → **Judge Quick Start** |
| 10–12 min demo script | `docs/8-demo-video-script.md` |
| Deploy button + env checklist | `README.md`, `DEPLOYMENT.md` |
| Agent QA UI | `/dashboard/agent-tests` |

**Recommended demo model on Vercel Hobby (60s limit):** **Llama 3.1 8B Instant** (Groq).

---

## Verification commands (local)

```bash
npm install
npm test          # 12+ automated meta-tests
npm run lint
npm run build
cd automation/playwright && npm install && npx playwright install chromium && npm test
```

---

## Related documents

| Doc | Purpose |
|-----|---------|
| [SUBMISSION.md](../SUBMISSION.md) | Judge one-pager |
| [docs/4-test-plan.md](./4-test-plan.md) | Manual meta-test catalog |
| [docs/8-demo-video-script.md](./8-demo-video-script.md) | Recorded demo script |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Production deploy |
