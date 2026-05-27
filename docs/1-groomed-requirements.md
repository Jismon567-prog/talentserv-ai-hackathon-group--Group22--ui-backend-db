# Groomed Requirements Document

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Hackathon:** Talentserv AI Hackathon — Group 22 · Challenge 6  
**Version:** 1.0  
**Date:** May 2026

---

## 1. Refined Project Requirement

Build an intelligent, multi-stage AI agent that accepts healthcare user stories or requirements written in clinical language and produces a complete, audit-ready test automation package for **OpenMRS** workflows. The agent must:

1. Parse and analyze the requirement using OpenMRS domain concepts (Patient, Visit, Encounter, Obs, PatientIdentifier, User, Role, Privilege).
2. Plan risk, privacy, and security test coverage before generating cases.
3. Generate **6–10 high-quality test cases** spanning Functional, Negative, Validation, Security, Privacy, and Audit categories.
4. Produce **100% synthetic** test data (patients, visits, encounters, users) — never real PHI.
5. Emit **Playwright UI** and **REST API** automation skeletons aligned to generated cases.
6. Compute a **coverage report** and **safety checklist** with deterministic validation.
7. Present results in a authenticated web dashboard with export (Markdown, JSON, CSV) and generation history.

The solution must demonstrate a visible **six-stage agentic workflow**, use **third-party authentication (Clerk)**, and be deployable as a modern TypeScript web application.

---

## 2. Assumptions

| ID | Assumption |
|----|------------|
| A-01 | Users are QA engineers, clinical informatics staff, or hackathon judges with basic OpenMRS familiarity. |
| A-02 | Requirements are written in English as user stories or acceptance criteria (20–8,000 characters). |
| A-03 | An OpenAI and/or Groq API key is available for LLM stages; Groq free tier is acceptable for demos. |
| A-04 | Clerk is used for identity; no custom username/password storage is required. |
| A-05 | Supabase is optional; the app degrades gracefully when history storage is not configured. |
| A-06 | Generated automation skeletons are **templates** for future execution against OpenMRS REST or UI — not live test runners in MVP. |
| A-07 | All patient identifiers, names, and clinical values in output are fictional/synthetic. |
| A-08 | Target OpenMRS reference model aligns with [openmrs-core](https://github.com/openmrs/openmrs-core) concepts. |

---

## 3. Scope

### In Scope

- Clerk-authenticated dashboard (`/dashboard`) with requirement input and sample workflows
- Six-stage agent pipeline with real-time progress UI and server-side stage trace
- LLM-powered requirement analysis, risk planning (combined call), and test case generation
- Local deterministic stages: synthetic data, automation skeletons, coverage & safety
- Zod schema validation with graceful dropping of malformed individual test cases
- Test case quality validator with coverage scoring (0–100) and re-validation in UI
- Export toolbar: Copy Markdown, JSON, CSV; download full report
- Supabase-backed generation history (per Clerk user)
- Agent QA meta-testing catalog (10 documented test cases)
- Support for OpenAI (GPT-4o, GPT-4o Mini, GPT-3.5) and Groq (Llama, Gemma) models
- Responsive UI with Tailwind CSS and shadcn/ui-style components

### Out of Scope

| Item | Rationale |
|------|-----------|
| Live execution against a running OpenMRS instance | MVP delivers skeletons, not CI integration |
| Real patient data import or EHR integration | Privacy/compliance boundary |
| Custom RBAC or user management beyond Clerk | Third-party auth requirement satisfied by Clerk |
| Multi-tenant organization management | Single-user demo scope |
| Fine-tuned or on-prem LLM hosting | Uses commercial API providers |
| Full Playwright test suite execution in production | Templates only for hackathon |
| Internationalization (i18n) | English-only MVP |
| Offline mode | Requires network for LLM and auth |

---

## 4. User Stories

### US-01 — Authenticated Access

**As a** QA engineer,  
**I want to** sign in with a third-party identity provider,  
**So that** my generated test plans are private and tied to my account.

### US-02 — Requirement Input

**As a** test designer,  
**I want to** paste a healthcare user story or pick a sample OpenMRS workflow,  
**So that** I can quickly start generation without writing boilerplate.

### US-03 — Agent Pipeline Visibility

**As a** reviewer,  
**I want to** see each agent stage progress (requirement parsing, test generation, synthetic data, automation, coverage),  
**So that** I can trust the multi-stage workflow and diagnose failures.

### US-04 — Comprehensive Test Cases

**As a** QA lead,  
**I want** generated test cases in Functional, Negative, Validation, Security, Privacy, and Audit categories,  
**So that** OpenMRS workflows are covered beyond happy-path testing.

### US-05 — Synthetic Test Data

**As a** privacy officer,  
**I want** all patient and clinical data flagged as synthetic,  
**So that** no real PHI appears in artifacts or exports.

### US-06 — Automation Skeletons

**As an** automation engineer,  
**I want** Playwright and REST API test skeletons mapped to generated cases,  
**So that** I can extend them into a real test suite.

### US-07 — Coverage & Safety Review

**As a** release manager,  
**I want** a coverage breakdown and safety checklist with pass/fail rules,  
**So that** I can gate releases on privacy and audit requirements.

### US-08 — Export & Share

**As a** team member,  
**I want to** export results as Markdown, JSON, or CSV,  
**So that** I can attach artifacts to Jira, Confluence, or CI pipelines.

### US-09 — Generation History

**As a** returning user,  
**I want to** browse and reload past generations,  
**So that** I can compare runs without re-invoking the LLM.

### US-10 — Model Selection

**As a** cost-conscious developer,  
**I want to** choose between paid OpenAI and free Groq models,  
**So that** I can balance quality, speed, and cost during development.

---

## 5. Acceptance Criteria

### AC-01 — Authentication

- [ ] Unauthenticated users cannot access `/dashboard` or `/api/agent/*`
- [ ] Sign-in and sign-up routes redirect to dashboard after success
- [ ] User avatar/menu visible in dashboard header

### AC-02 — Requirement Validation

- [ ] Requirements shorter than 20 characters return HTTP 400 `INVALID_BODY`
- [ ] Requirements longer than 8,000 characters are rejected
- [ ] At least 10 sample requirements available in the UI

### AC-03 — Agent Pipeline

- [ ] Successful run returns `stageTrace` with six logical stages
- [ ] Stages 1+2 execute in a single combined LLM call
- [ ] Stages 4–6 execute locally without additional LLM calls
- [ ] Failed stage returns structured error with stage id and partial trace

### AC-04 — Test Case Quality

- [ ] Each valid test case includes id, scenario, category, steps, entities, and OpenMRS relevance
- [ ] Malformed individual cases are dropped with warnings; run succeeds if ≥1 valid case remains
- [ ] Validator produces score 0–100 with category breakdown and suggestions
- [ ] Re-validate button refreshes QA and coverage scores client-side

### AC-05 — Synthetic Data Safety

- [ ] Every patient record has `synthetic: true`
- [ ] No realistic PHI patterns enforced by prompts and normalization
- [ ] Safety checklist includes must-pass rules for synthetic data

### AC-06 — OpenMRS Grounding

- [ ] Test cases reference OpenMRS entities: Patient, Visit, Encounter, Obs, PatientIdentifier, User, Role, Privilege
- [ ] Coverage report counts cases by entity and category

### AC-07 — Export

- [ ] Markdown export includes test cases, synthetic data summary, coverage, and safety
- [ ] JSON export is valid against AgentOutput schema
- [ ] CSV export includes test case id, category, scenario, and steps

### AC-08 — History (Optional)

- [ ] When Supabase is configured, successful runs persist with Clerk `userId`
- [ ] History panel lists recent generations with requirement preview and case count
- [ ] Clicking a history item reloads full AgentOutput in the dashboard

### AC-09 — Performance

- [ ] Server route `maxDuration` ≥ 120 seconds
- [ ] Client abort timeout ≥ 130 seconds to avoid premature cancellation
- [ ] Default model is GPT-4o Mini for speed/cost balance

### AC-10 — Agent Meta-Testing

- [ ] At least 10 documented meta-test cases cover validation, privacy, security, functional, safety, and audit
- [ ] Meta-tests visible on `/dashboard/agent-tests`

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Security | API keys server-side only; Clerk session required for generation |
| Privacy | No PHI in logs; synthetic data only in outputs |
| Usability | Single-page dashboard workflow; mobile-responsive layout |
| Maintainability | TypeScript throughout; Zod schemas as contracts |
| Observability | Stage trace with durationMs and output preview per LLM stage |
| Deployability | Vercel-compatible Next.js 15 App Router application |

---

## 7. References

- [OpenMRS Core](https://github.com/openmrs/openmrs-core)
- [OpenMRS REST API](https://rest.openmrs.org/)
- Project context: `PROJECT_CONTEXT.md`
