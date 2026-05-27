# Demo Video Script (10–12 minutes)

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Audience:** Hackathon judges  
**Live URL:** https://openmrs-ai-test-agent.vercel.app

---

## Before recording

1. Sign in to the live app once (warm cold start).
2. Select model **Llama 3.1 8B Instant** (Groq) if on Vercel Hobby (60s timeout).
3. Have a sample requirement ready (e.g. **Patient View Access**).
4. Optional: open `/dashboard/agent-tests` in a second tab.

---

## Script

| Time | Scene | Narration / action |
|------|-------|-------------------|
| 0:00 | Title slide | "Group 22 — OpenMRS AI Healthcare Test Automation Agent. Converts clinical user stories into OpenMRS test plans, synthetic data, and automation skeletons." |
| 0:30 | Landing page | Show branding; click **Sign in**; complete Clerk auth. |
| 1:00 | Dashboard tour | Point out requirement textarea, 10 samples, model picker, Generate button, history sidebar. |
| 1:30 | Input | Click **Patient View Access** sample (or paste a 2–3 sentence user story). |
| 2:00 | Model | Select **Llama 3.1 8B Instant** (or GPT-4o Mini if Pro timeout). |
| 2:15 | Generate | Click **Generate**; narrate six stages: Analyze → Risk → Test Cases → Synthetic Data → Automation → Coverage. |
| 3:30 | Agent trace | Open trace/progress; mention two LLM calls + three local deterministic stages. |
| 4:30 | Test cases | Scroll test cases; highlight Functional, Security, Privacy, Audit categories and OpenMRS entities. |
| 5:30 | Coverage | Open **Coverage** tab; explain 0–100 score and missing-scenario guidance. |
| 6:30 | Validation | Show validation report; click **Re-validate** after edits. |
| 7:00 | Synthetic data | Show patients flagged synthetic; no real PHI. |
| 7:30 | Automation | Show Playwright UI + REST snippets; mention runnable smoke tests in `automation/playwright/`. |
| 8:00 | Safety | Safety checklist — RBAC, audit, synthetic identifiers. |
| 8:30 | Export | Copy Markdown / JSON / CSV. |
| 9:00 | Agent QA | Navigate to **Agent QA** (`/dashboard/agent-tests`); show 10 meta-tests TC-AGENT-001–010. |
| 9:45 | CI / tests | Terminal: `npm test` (Vitest meta-tests) and GitHub Actions badge. |
| 10:30 | Architecture | Brief: Next.js 15, Clerk, OpenAI/Groq, optional Supabase. |
| 11:00 | Close | "Live at openmrs-ai-test-agent.vercel.app — repo link in README and SUBMISSION.md." |

---

## Talking points if generation is slow

- Vercel Hobby caps functions at 60 seconds; Groq is fastest.
- Stages 4–6 are instant (local templates).
- Full docs: `DEPLOYMENT.md`, `docs/9-evaluation-coverage.md`.

---

## Optional B-roll

- Cursor / agentic evidence: `docs/6-agentic-evidence.md`
- Playwright smoke: `cd automation/playwright && npm test`
