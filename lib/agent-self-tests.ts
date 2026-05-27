/**
 * Meta-testing catalog — test cases that document how we validate the
 * OpenMRS AI Healthcare Test Automation Agent itself.
 */

export type AgentSelfTestCategory =
  | "Validation"
  | "Privacy"
  | "Security"
  | "Functional"
  | "Safety"
  | "Audit";

export interface AgentSelfTest {
  id: string;
  category: AgentSelfTestCategory;
  priority: "Critical" | "High" | "Medium";
  scenario: string;
  given: string;
  when: string;
  then: string;
  evidence: string;
}

export const AGENT_SELF_TESTS: AgentSelfTest[] = [
  {
    id: "TC-AGENT-001",
    category: "Validation",
    priority: "Critical",
    scenario:
      "Short requirements are rejected with HTTP 400 before any LLM call.",
    given: "An authenticated user submits a requirement under 20 characters.",
    when: "They POST `/api/agent/generate` with `{ requirement: \"too short\" }`.",
    then: "The route returns HTTP 400 `INVALID_BODY` and never invokes Groq.",
    evidence: "RequestBodySchema.min(20) in app/api/agent/generate/route.ts.",
  },
  {
    id: "TC-AGENT-002",
    category: "Privacy",
    priority: "Critical",
    scenario: "Every generated patient record is flagged synthetic.",
    given: "The Stage 4 LLM payload omits the `synthetic` flag on a patient.",
    when: "`normalizeSyntheticDataPayload` runs followed by Zod parsing.",
    then: "Each patient ends up with `synthetic === true` before reaching the UI.",
    evidence:
      "lib/normalize.ts forces synthetic:true; PatientSchema defaults it on.",
  },
  {
    id: "TC-AGENT-003",
    category: "Security",
    priority: "Critical",
    scenario: "Unauthenticated callers cannot trigger artifact generation.",
    given: "A request with no Clerk session calls `/api/agent/generate`.",
    when: "Clerk middleware and the route's `auth()` gate evaluate.",
    then: "The route returns HTTP 401 `UNAUTHORIZED` and exits before any LLM call.",
    evidence: "middleware.ts protects /dashboard + /api; route re-checks auth().",
  },
  {
    id: "TC-AGENT-004",
    category: "Functional",
    priority: "High",
    scenario: "Successful runs emit a complete six-stage trace.",
    given: "A valid requirement and live Groq credentials.",
    when: "All six pipeline stages succeed.",
    then: "`stageTrace[]` contains one entry per stage in canonical order, each with durationMs.",
    evidence:
      "STAGES in components/StageProgress.tsx mirrors PROMPT_PIPELINE_ORDER.",
  },
  {
    id: "TC-AGENT-005",
    category: "Safety",
    priority: "Critical",
    scenario: "Any failing must-rule blocks release of AgentOutput.",
    given: "Stage 6 returns a safety item with `status: \"fail\"` on a must-severity rule.",
    when: "AgentOutputSchema.superRefine evaluates the assembled payload.",
    then: "The whole AgentOutput is rejected so unsafe artifacts never reach the dashboard.",
    evidence:
      "superRefine in lib/schemas.ts; SafetyChecklist.passed === false on any fail.",
  },
  {
    id: "TC-AGENT-006",
    category: "Validation",
    priority: "High",
    scenario: "Malformed individual test cases are dropped without failing the run.",
    given: "Stage 3 returns a mix of valid and schema-invalid test cases.",
    when: "`parseAndFilter` processes the Stage 3 payload.",
    then: "Valid cases are kept, invalid ones are dropped with warnings in the response.",
    evidence: "parseAndFilter in app/api/agent/generate/route.ts.",
  },
  {
    id: "TC-AGENT-007",
    category: "Audit",
    priority: "High",
    scenario: "Coverage report pads missing enum keys with zero counts.",
    given: "Stage 6 LLM output omits zero-count categories and entities.",
    when: "`normalizeCoveragePayload` runs before Stage6OutputSchema.parse.",
    then: "All six TEST_CATEGORIES and eight OPENMRS_ENTITIES keys are present with numeric values.",
    evidence: "padCountsByEnum in lib/normalize.ts; wired in route.ts Stage 6.",
  },
  {
    id: "TC-AGENT-008",
    category: "Security",
    priority: "High",
    scenario: "Groq rate-limit responses trigger exponential backoff retry.",
    given: "A stage call returns HTTP 429 from Groq.",
    when: "`runStageWithRetry` handles the error.",
    then: "The stage is retried up to MAX_STAGE_RETRIES with increasing delay before failing.",
    evidence: "runStageWithRetry in app/api/agent/generate/route.ts.",
  },
  {
    id: "TC-AGENT-009",
    category: "Functional",
    priority: "Medium",
    scenario: "Export formats preserve all generated test case fields.",
    given: "A successful AgentOutput with multiple test cases.",
    when: "The user copies Markdown, JSON, or CSV from the export toolbar.",
    then: "Each format includes id, scenario, category, steps, and OpenMRS relevance metadata.",
    evidence: "lib/export.ts — renderAgentOutputAsMarkdown, renderAgentOutputAsJson, renderTestCasesAsCsv.",
  },
  {
    id: "TC-AGENT-010",
    category: "Privacy",
    priority: "High",
    scenario: "Stage 3 refuses requests to generate realistic PHI.",
    given: "A requirement or risk plan asks for real patient names or MRNs.",
    when: "The test-case-generator stage runs.",
    then: "It emits a Privacy category refusal case (TC-REFUSE-001) instead of realistic PHI.",
    evidence: "REFUSALS block in lib/prompts.ts Stage 3 system prompt.",
  },
];

export const AGENT_SELF_TEST_CATEGORY_COLORS: Record<
  AgentSelfTestCategory,
  string
> = {
  Validation: "bg-violet-100 text-violet-700 border-violet-200",
  Privacy: "bg-pink-100 text-pink-700 border-pink-200",
  Security: "bg-red-100 text-red-700 border-red-200",
  Functional: "bg-blue-100 text-blue-700 border-blue-200",
  Safety: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Audit: "bg-amber-100 text-amber-800 border-amber-200",
};
