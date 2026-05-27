# Test Plan and Test Cases

**Project:** OpenMRS AI Healthcare Test Automation Agent  
**Version:** 1.0  
**Date:** May 2026

---

## 1. Test Strategy Overview

Testing for this project operates at **three layers**:

| Layer | Scope | Method |
|-------|-------|--------|
| **L1 — Agent Meta-Tests** | The AI agent pipeline itself | Documented test cases + manual/API verification |
| **L2 — Schema & Validator Tests** | Data contracts and QA engine | TypeScript compile, Zod parsing, re-validate UI |
| **L3 — UI / Integration** | Dashboard workflow | Manual exploratory + future Playwright E2E |

This document focuses on **L1 meta-tests** (validating the agent) and outlines the broader strategy. The canonical meta-test catalog lives in `lib/agent-self-tests.ts` and is rendered in the UI at `/dashboard/agent-tests`.

---

## 2. Test Environment

| Component | Requirement |
|-----------|-------------|
| Node.js | 20+ |
| Browser | Chrome / Edge / Safari (latest) |
| Auth | Clerk test application with valid keys |
| LLM | `OPENAI_API_KEY` and/or `GROQ_API_KEY` |
| Database | Supabase optional (history tests) |
| Base URL | `http://localhost:3000` (or deployed Vercel URL) |

---

## 3. Test Categories

| Category | Focus |
|----------|-------|
| **Functional** | End-to-end pipeline, exports, stage trace |
| **Validation** | Input limits, schema enforcement, malformed LLM output |
| **Security** | Authentication, rate-limit retry, unauthorized access |
| **Privacy** | Synthetic data flags, PHI refusal |
| **Safety** | Safety checklist must-rules blocking unsafe output |
| **Audit** | Coverage normalization, trace completeness |

---

## 4. Agent Meta-Test Cases

### TC-AGENT-001 — Short Requirement Rejection (Validation)

| Field | Detail |
|-------|--------|
| **Priority** | Critical |
| **Scenario** | Short requirements are rejected with HTTP 400 before any LLM call. |
| **Given** | An authenticated user submits a requirement under 20 characters. |
| **When** | They POST `/api/agent/generate` with `{ "requirement": "too short" }`. |
| **Then** | The route returns HTTP 400 `INVALID_BODY` and never invokes the LLM. |
| **Evidence** | `RequestBodySchema.min(20)` in `app/api/agent/generate/route.ts` |

---

### TC-AGENT-002 — Synthetic Patient Flag (Privacy)

| Field | Detail |
|-------|--------|
| **Priority** | Critical |
| **Scenario** | Every generated patient record is flagged synthetic. |
| **Given** | Synthetic data payload omits the `synthetic` flag on a patient. |
| **When** | `normalizeSyntheticDataPayload` runs followed by Zod parsing. |
| **Then** | Each patient ends up with `synthetic === true` before reaching the UI. |
| **Evidence** | `lib/normalize.ts`; Patient schema defaults |

---

### TC-AGENT-003 — Unauthenticated Access Blocked (Security)

| Field | Detail |
|-------|--------|
| **Priority** | Critical |
| **Scenario** | Unauthenticated callers cannot trigger artifact generation. |
| **Given** | A request with no Clerk session calls `/api/agent/generate`. |
| **When** | Clerk middleware and the route's `auth()` gate evaluate. |
| **Then** | The route returns HTTP 401 `UNAUTHENTICATED` and exits before any LLM call. |
| **Evidence** | `middleware.ts`; route auth check |

---

### TC-AGENT-004 — Six-Stage Trace (Functional)

| Field | Detail |
|-------|--------|
| **Priority** | High |
| **Scenario** | Successful runs emit a complete six-stage trace. |
| **Given** | A valid requirement and configured LLM credentials. |
| **When** | All pipeline stages succeed. |
| **Then** | `stageTrace[]` contains entries for all six stages with `durationMs` where applicable. |
| **Evidence** | `components/StageProgress.tsx`; `PROMPT_STAGE_TO_PIPELINE` in `lib/prompts.ts` |

---

### TC-AGENT-005 — Safety Must-Rule Enforcement (Safety)

| Field | Detail |
|-------|--------|
| **Priority** | Critical |
| **Scenario** | Failing must-rule safety items are surfaced in the safety checklist. |
| **Given** | Generated artifacts include a safety item with `status: "fail"` on a must-severity rule. |
| **When** | `computeSafetyChecklist` evaluates the assembled payload. |
| **Then** | `SafetyChecklist.passed === false`; dashboard displays failing items. |
| **Evidence** | `lib/deterministic-coverage.ts`; `lib/schemas.ts` |

---

### TC-AGENT-006 — Malformed Test Case Drop (Validation)

| Field | Detail |
|-------|--------|
| **Priority** | High |
| **Scenario** | Malformed individual test cases are dropped without failing the entire run. |
| **Given** | Stage 3 returns a mix of valid and schema-invalid test cases. |
| **When** | `parseAndFilter` processes the Stage 3 payload. |
| **Then** | Valid cases are kept; invalid ones appear in `warnings.droppedTestCases`. |
| **Evidence** | `parseAndFilter` in `app/api/agent/generate/route.ts` |

---

### TC-AGENT-007 — Coverage Enum Padding (Audit)

| Field | Detail |
|-------|--------|
| **Priority** | High |
| **Scenario** | Coverage report includes all category and entity keys with numeric values. |
| **Given** | Coverage computation runs on a partial test suite. |
| **When** | `computeCoverageReport` executes. |
| **Then** | All six `TEST_CATEGORIES` and eight OpenMRS entity keys are present (zero-padded where missing). |
| **Evidence** | `lib/deterministic-coverage.ts`; `lib/openmrs-reference.ts` |

---

### TC-AGENT-008 — Rate Limit Retry (Security)

| Field | Detail |
|-------|--------|
| **Priority** | High |
| **Scenario** | LLM rate-limit responses trigger backoff retry. |
| **Given** | A stage call returns HTTP 429 from the provider. |
| **When** | `runStageWithRetry` handles the error. |
| **Then** | The stage is retried (up to 2 attempts) with increasing delay before failing. |
| **Evidence** | `runStageWithRetry` in `app/api/agent/generate/route.ts` |

---

### TC-AGENT-009 — Export Field Integrity (Functional)

| Field | Detail |
|-------|--------|
| **Priority** | Medium |
| **Scenario** | Export formats preserve all generated test case fields. |
| **Given** | A successful AgentOutput with multiple test cases. |
| **When** | The user copies Markdown, JSON, or CSV from the export toolbar. |
| **Then** | Each format includes id, scenario, category, steps, and OpenMRS metadata. |
| **Evidence** | `lib/export.ts` |

---

### TC-AGENT-010 — PHI Refusal Prompt (Privacy)

| Field | Detail |
|-------|--------|
| **Priority** | High |
| **Scenario** | Stage 3 refuses requests to generate realistic PHI. |
| **Given** | A requirement asks for real patient names or MRNs. |
| **When** | The test-case-generator stage runs. |
| **Then** | Output includes a Privacy-category refusal case instead of realistic PHI. |
| **Evidence** | REFUSALS block in `lib/prompts.ts` Stage 3 system prompt |

---

## 5. Additional Manual Test Scenarios

### Happy Path — Full Generation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Sign in via Clerk | Redirect to `/dashboard` |
| 2 | Click "Patient registration" sample | Requirement populates textarea |
| 3 | Select GPT-4o Mini | Model chip updates |
| 4 | Click Generate | Stage progress animates through 6 stages |
| 5 | Wait for completion | Test Cases tab shows 6–10 cases |
| 6 | Open Synthetic Data tab | Patients with synthetic flag |
| 7 | Open Coverage tab | Coverage score and gaps displayed |
| 8 | Click Copy Markdown | Clipboard contains formatted report |

### Negative — Timeout / LLM Failure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit very long requirement with slow free model | Progress shows slow warning |
| 2 | If server times out | Error banner with stage name and retry guidance |
| 3 | Partial trace preserved | Failed stage marked in StageProgress |

### Security — Session Expiry

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Sign out mid-session | Dashboard redirects to sign-in |
| 2 | Call generate API without cookie | HTTP 401 |

### Privacy — Export Review

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate any sample | Review exported JSON |
| 2 | Search for patient names | All names are fictional/test patterns |
| 3 | Check synthetic flag | All patients have `"synthetic": true` |

---

## 6. Test Case Quality Validation (Post-Generation)

The `lib/validator.ts` engine runs automatically after Stage 3 and on **Re-validate**:

| Check | Severity | Description |
|-------|----------|-------------|
| Suite size | Critical | 6–10 cases target |
| Category coverage | Critical | Functional, Negative, Security, Privacy minimums |
| Step quality | Warning | Action verbs, minimum lengths |
| OpenMRS grounding | Important | Entity references, REST/UI surface terms |
| Duplicate scenarios | Warning | Fingerprint deduplication |
| Vague language | Info | Flags generic phrasing |

---

## 7. Entry and Exit Criteria

### Entry Criteria

- Local dev server running (`npm run dev`)
- Valid Clerk and at least one LLM API key configured
- Test user account created in Clerk

### Exit Criteria

- All 10 meta-test cases verified (manual or scripted)
- Happy-path generation completes in under 130 seconds with default model
- No unauthenticated access to generate endpoint
- Export formats validated for field completeness
- Re-validate button updates QA score and timestamp

---

## 8. Traceability Matrix

| Requirement | Test Case(s) |
|-------------|--------------|
| AC-01 Authentication | TC-AGENT-003 |
| AC-02 Requirement Validation | TC-AGENT-001 |
| AC-03 Agent Pipeline | TC-AGENT-004 |
| AC-04 Test Case Quality | TC-AGENT-006, validator checks |
| AC-05 Synthetic Data | TC-AGENT-002, TC-AGENT-010 |
| AC-06 OpenMRS Grounding | TC-AGENT-007, validator checks |
| AC-07 Export | TC-AGENT-009 |
| AC-08 Safety | TC-AGENT-005 |
| AC-10 Meta-Testing | TC-AGENT-001 through TC-AGENT-010 |

---

## 9. Related Documents

- [Groomed Requirements](./1-groomed-requirements.md)
- [Critical Review](./5-critical-review.md)
- UI catalog: `/dashboard/agent-tests`
