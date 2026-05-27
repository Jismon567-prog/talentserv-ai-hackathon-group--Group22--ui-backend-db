/**
 * Agent I/O Schemas (Zod)
 * -----------------------
 * Runtime-validated contracts for everything the AI test-automation agent
 * produces. The agent's LLM output is parsed through these schemas before it
 * ever reaches the UI, the database, or downstream tooling.
 *
 * Design goals:
 *  - Tight enums (sourced from `./openmrs-reference`) so the model can't
 *    invent test categories, roles, entities, etc.
 *  - Strict-but-forgiving primitives (UUIDs, ISO datetimes) so we can fail
 *    fast on garbage while still accepting normal LLM output.
 *  - `z.infer` types exported for every schema so the rest of the app gets
 *    end-to-end TypeScript safety with no duplicated interfaces.
 *
 * Compatibility: Zod v4 (uses `z.iso.datetime`, `z.uuid`, etc.).
 */

import { z } from "zod";

import {
  COMMON_ROLES,
  ENCOUNTER_TYPES,
  GENDERS,
  IDENTIFIER_TYPES,
  OBS_VALUE_TYPES,
  OPENMRS_ENTITIES,
  PRIVILEGES,
  TEST_CATEGORIES,
  TEST_PRIORITIES,
  VISIT_TYPES,
} from "./openmrs-reference";

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** RFC 4122 UUID; used by all OpenMRS entities. */
export const UuidSchema = z.uuid();

/** ISO-8601 datetime, e.g. `2026-05-25T10:30:00Z`. Timezone offset allowed. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/** ISO-8601 calendar date, e.g. `1985-04-12`. */
export const IsoDateSchema = z.iso.date();

/** Non-empty trimmed string. Preferred over `z.string()` for human text. */
export const NonEmptyStringSchema = z.string().trim().min(1);

// ---------------------------------------------------------------------------
// Reusable enums (single source of truth: `./openmrs-reference`)
// ---------------------------------------------------------------------------

export const OpenMrsEntitySchema = z.enum(OPENMRS_ENTITIES);
export const GenderSchema = z.enum(GENDERS);
export const VisitTypeSchema = z.enum(VISIT_TYPES);
export const EncounterTypeSchema = z.enum(ENCOUNTER_TYPES);
export const IdentifierTypeSchema = z.enum(IDENTIFIER_TYPES);
export const ObsValueTypeSchema = z.enum(OBS_VALUE_TYPES);
export const CommonRoleSchema = z.enum(COMMON_ROLES);
export const PrivilegeSchema = z.enum(PRIVILEGES);
export const TestCategorySchema = z.enum(TEST_CATEGORIES);
export const TestPrioritySchema = z.enum(TEST_PRIORITIES);

// ---------------------------------------------------------------------------
// Synthetic-data record schemas
// ---------------------------------------------------------------------------
//
// These intentionally favour LLM-friendliness over OpenMRS modelling purity:
//   * Flat string fields instead of nested OpenMRS objects.
//   * Nearly every field is optional — the LLM occasionally drops one, and
//     a missing `birthdate` is not worth tanking a whole pipeline run.
//   * Unknown extra keys the LLM emits are passed through, so we never lose
//     data the model decided to include (e.g. allergies, medicalHistory).
//
// Cross-entity referential integrity (visit.patientId → patient.id, etc.) is
// NOT enforced at the schema layer — the test data is for demo display, not
// a relational fixture loader. Downstream consumers that care can spot-check.

/**
 * A single synthetic patient. The only invariant we keep enforcing is
 * `synthetic: true` (defaulted on) — that's the safety floor that proves no
 * real PHI ever leaks through.
 */
export const PatientSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    gender: z.string().optional(),
    birthdate: z.string().optional(),
    identifier: z.string().optional(),
    synthetic: z.boolean().optional().default(true),
  })
  .passthrough();
export type Patient = z.infer<typeof PatientSchema>;

export const UserSchema = z
  .object({
    id: z.string().optional(),
    username: z.string().optional(),
    role: z.string().optional(),
    fullName: z.string().optional(),
  })
  .passthrough();
export type User = z.infer<typeof UserSchema>;

export const VisitSchema = z
  .object({
    id: z.string().optional(),
    patientId: z.string().optional(),
    visitDate: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();
export type Visit = z.infer<typeof VisitSchema>;

/**
 * Encounters are deliberately the most permissive shape — the LLM's clinical
 * detail varies wildly per requirement (vitals, lab orders, drug orders,
 * progress notes) and we don't want to constrain it. We surface a few common
 * fields for typed access in the UI; everything else is passed through.
 */
export const EncounterSchema = z
  .object({
    id: z.string().optional(),
    patientId: z.string().optional(),
    visitId: z.string().optional(),
    type: z.string().optional(),
    encounterDate: z.string().optional(),
    provider: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type Encounter = z.infer<typeof EncounterSchema>;

// ---------------------------------------------------------------------------
// Test case
// ---------------------------------------------------------------------------

/**
 * One step in a test case. Designed to be useful both for human reviewers
 * and for code-generating an automation skeleton (the `data` field carries
 * the inputs Playwright/REST will need).
 */
export const TestStepSchema = z.object({
  /** 1-based step number. */
  step: z.number().int().positive(),
  action: NonEmptyStringSchema.describe(
    "Imperative description of what the actor does, e.g. 'Open the patient registration form'.",
  ),
  expected: NonEmptyStringSchema.describe(
    "Observable outcome that proves the step succeeded.",
  ),
  /**
   * Structured input data referenced by the step (form fields, API body,
   * tabular rows). Intentionally `unknown` because LLMs legitimately emit
   * either an object (form fields) or an array (e.g. table rows / lists).
   * Consumers should narrow with `typeof` / `Array.isArray` before use.
   */
  data: z.unknown().optional(),
});
export type TestStep = z.infer<typeof TestStepSchema>;

/**
 * The OpenMRS context this test exercises. Lets us answer:
 *   "Which entities / roles / workflows does this case actually cover?"
 */
export const OpenMrsRelevanceSchema = z.object({
  entities: z.array(OpenMrsEntitySchema).min(1),
  /** Roles whose perspective the case is written from. */
  roles: z.array(CommonRoleSchema).default([]),
  /** Workflow ids from `OPENMRS_WORKFLOWS`; free-form string keeps it loose. */
  workflows: z.array(NonEmptyStringSchema).default([]),
  /** Privileges asserted (for Security/RBAC cases). */
  privileges: z.array(PrivilegeSchema).default([]),
});
export type OpenMrsRelevance = z.infer<typeof OpenMrsRelevanceSchema>;

export const TestCaseSchema = z.object({
  /** Human-readable id, e.g. `TC-REG-001`. Unique within a single agent run. */
  id: z
    .string()
    .trim()
    .regex(
      /^TC-[A-Z0-9]+-\d{3,}$/,
      "Test case id must look like 'TC-REG-001'.",
    ),
  scenario: NonEmptyStringSchema.describe(
    "Single-sentence summary of what is being verified.",
  ),
  category: TestCategorySchema,
  priority: TestPrioritySchema,
  preconditions: z.array(NonEmptyStringSchema).default([]),
  steps: z.array(TestStepSchema).min(1),
  expectedResult: NonEmptyStringSchema.describe(
    "Overall pass condition for the entire scenario.",
  ),
  openmrsRelevant: OpenMrsRelevanceSchema,
  /** Free-form tags (e.g. 'smoke', 'rbac', 'vitals'). */
  tags: z.array(NonEmptyStringSchema).default([]),
  /** Back-pointer to the originating requirement / user story id. */
  traceabilityRef: z.string().optional(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

// ---------------------------------------------------------------------------
// Test case quality validation (post-generation QA report)
// ---------------------------------------------------------------------------

export const TestCaseValidationCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  passed: z.boolean(),
  message: z.string(),
  suggestion: z.string().optional(),
  testCaseIds: z.array(z.string()).optional(),
});
export type TestCaseValidationCheck = z.infer<typeof TestCaseValidationCheckSchema>;

export const CoverageAreaResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  covered: z.boolean(),
  count: z.number().int().nonnegative(),
  minRequired: z.number().int().nonnegative(),
  severity: z.enum(["critical", "important", "recommended"]),
});
export type CoverageAreaResult = z.infer<typeof CoverageAreaResultSchema>;

export const TestCaseValidationReportSchema = z.object({
  /** Structural / quality score from validation checks (0–100). */
  score: z.number().min(0).max(100),
  /** Breadth score across categories, entities, and suite size (0–100). */
  coverageScore: z.number().min(0).max(100),
  passed: z.boolean(),
  generatedAt: IsoDateTimeSchema,
  summary: NonEmptyStringSchema,
  checks: z.array(TestCaseValidationCheckSchema),
  suggestions: z.array(z.string()).default([]),
  categoryCoverage: z.record(TestCategorySchema, z.number().int().nonnegative()),
  coverageBreakdown: z.array(CoverageAreaResultSchema).default([]),
  missingScenarios: z.array(z.string()).default([]),
  duplicateIds: z.array(z.string()).default([]),
});
export type TestCaseValidationReport = z.infer<typeof TestCaseValidationReportSchema>;

// ---------------------------------------------------------------------------
// Synthetic data bundle
// ---------------------------------------------------------------------------

/**
 * The Stage 4 output container. Every array is optional and defaults to `[]`,
 * so the LLM can omit categories it doesn't have data for (e.g. no users for
 * a non-RBAC requirement) without tanking the run.
 */
export const SyntheticDataSchema = z
  .object({
    patients: z.array(PatientSchema).optional().default([]),
    users: z.array(UserSchema).optional().default([]),
    visits: z.array(VisitSchema).optional().default([]),
    encounters: z.array(EncounterSchema).optional().default([]),
    /** Free-form notes about how the dataset was generated. */
    generationNotes: z.string().optional(),
  })
  .passthrough();
export type SyntheticData = z.infer<typeof SyntheticDataSchema>;

// ---------------------------------------------------------------------------
// Automation skeleton (Playwright UI + REST API examples)
// ---------------------------------------------------------------------------
//
// Deliberately tiny: two readable code blobs instead of a synthetic project
// tree. The 8b-instant model produces this shape reliably; the previous
// `files[]` + path-validation shape was the #1 source of Stage 5 failures.

export const AutomationSkeletonSchema = z
  .object({
    /** Playwright TypeScript example exercising the UI flow. */
    uiTest: z.string().optional().default(""),
    /** fetch/axios TypeScript example exercising the REST API. */
    apiTest: z.string().optional().default(""),
    /** Optional setup/run hints (npm deps, env vars, etc.). */
    notes: z.string().optional(),
  })
  .passthrough();
export type AutomationSkeleton = z.infer<typeof AutomationSkeletonSchema>;

// ---------------------------------------------------------------------------
// Coverage report
// ---------------------------------------------------------------------------

/**
 * A gap the agent could not (or would not) cover, with a reason. Surfaced in
 * the dashboard so a human can decide whether to expand scope.
 */
export const CoverageGapSchema = z.object({
  area: NonEmptyStringSchema,
  reason: NonEmptyStringSchema,
  severity: z.enum(["low", "medium", "high"]),
});
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const CoverageReportSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  totalTestCases: z.number().int().nonnegative(),
  /** Counts grouped by test category. Every category key is required. */
  byCategory: z.record(TestCategorySchema, z.number().int().nonnegative()),
  /** Counts grouped by OpenMRS entity touched. */
  byEntity: z.record(OpenMrsEntitySchema, z.number().int().nonnegative()),
  /** Counts grouped by workflow id (free-form key — workflow ids vary). */
  byWorkflow: z.record(z.string(), z.number().int().nonnegative()),
  /** Aggregate coverage in [0, 1]. Interpretation is up to the scorer. */
  coveragePct: z.number().min(0).max(1),
  gaps: z.array(CoverageGapSchema).default([]),
});
export type CoverageReport = z.infer<typeof CoverageReportSchema>;

// ---------------------------------------------------------------------------
// Safety checklist
// ---------------------------------------------------------------------------

export const SafetyCheckStatusSchema = z.enum(["pass", "warn", "fail"]);
export type SafetyCheckStatus = z.infer<typeof SafetyCheckStatusSchema>;

export const SafetyChecklistItemSchema = z.object({
  /** Stable id from `PRIVACY_SECURITY_RULES`, e.g. `no-real-phi`. */
  ruleId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  status: SafetyCheckStatusSchema,
  /** Why this rule passed/failed (evidence, sample, or remediation hint). */
  detail: z.string().default(""),
});
export type SafetyChecklistItem = z.infer<typeof SafetyChecklistItemSchema>;

export const SafetyChecklistSchema = z
  .object({
    items: z.array(SafetyChecklistItemSchema).min(1),
    /** Convenience flag: true iff no item has status `fail`. */
    passed: z.boolean(),
  })
  .superRefine((checklist, ctx) => {
    const hasFail = checklist.items.some((i) => i.status === "fail");
    if (checklist.passed && hasFail) {
      ctx.addIssue({
        code: "custom",
        path: ["passed"],
        message:
          "`passed` cannot be true while at least one checklist item is `fail`.",
      });
    }
  });
export type SafetyChecklist = z.infer<typeof SafetyChecklistSchema>;

// ---------------------------------------------------------------------------
// Agent pipeline stages (for the multi-stage workflow visualisation)
// ---------------------------------------------------------------------------

export const PipelineStageNameSchema = z.enum([
  "requirement-parsing",
  "test-case-generation",
  "synthetic-data",
  "automation-skeleton",
  "coverage-and-safety",
]);
export type PipelineStageName = z.infer<typeof PipelineStageNameSchema>;

export const PipelineStageSchema = z.object({
  name: PipelineStageNameSchema,
  status: z.enum(["pending", "running", "succeeded", "failed", "skipped"]),
  startedAt: IsoDateTimeSchema.optional(),
  finishedAt: IsoDateTimeSchema.optional(),
  /** Short status message (errors, counts, summary). */
  message: z.string().optional(),
});
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

// ---------------------------------------------------------------------------
// Full agent output
// ---------------------------------------------------------------------------

/**
 * Metadata about a single agent run. `requirementText` is the *exact* input
 * that produced this output; keeping it on the artifact makes traceability
 * automatic.
 */
export const AgentRunMetaSchema = z.object({
  runId: UuidSchema,
  agentVersion: NonEmptyStringSchema,
  generatedAt: IsoDateTimeSchema,
  requirementId: z.string().optional(),
  requirementText: NonEmptyStringSchema,
  /** LLM model identifier (e.g. `claude-opus-4-7` or `gpt-5.5-medium`). */
  model: z.string().optional(),
});
export type AgentRunMeta = z.infer<typeof AgentRunMetaSchema>;

/**
 * The full, validated artifact returned by the agent. Anything that lands in
 * the UI, the DB, or a download zip must conform to this shape.
 *
 * Use `AgentOutputSchema.parse(...)` to throw on the first issue, or
 * `AgentOutputSchema.safeParse(...)` to inspect errors structurally.
 */
export const AgentOutputSchema = z
  .object({
    meta: AgentRunMetaSchema,
    stages: z.array(PipelineStageSchema).min(1),
    testCases: z.array(TestCaseSchema).min(1),
    testCaseValidation: TestCaseValidationReportSchema,
    syntheticData: SyntheticDataSchema,
    automation: AutomationSkeletonSchema,
    coverage: CoverageReportSchema,
    safety: SafetyChecklistSchema,
  })
  .superRefine((output, ctx) => {
    // Coverage `totalTestCases` must match the actual array length.
    if (output.coverage.totalTestCases !== output.testCases.length) {
      ctx.addIssue({
        code: "custom",
        path: ["coverage", "totalTestCases"],
        message: `coverage.totalTestCases (${output.coverage.totalTestCases}) does not match testCases.length (${output.testCases.length}).`,
      });
    }

    // Test-case ids must be unique within a run.
    const seen = new Set<string>();
    output.testCases.forEach((tc, i) => {
      if (seen.has(tc.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["testCases", i, "id"],
          message: `Duplicate test case id: ${tc.id}`,
        });
      }
      seen.add(tc.id);
    });

    // Hard gate: any `fail` in the safety checklist invalidates the output.
    if (output.safety.items.some((i) => i.status === "fail")) {
      ctx.addIssue({
        code: "custom",
        path: ["safety"],
        message:
          "Safety checklist has failing items; the agent output must not be released.",
      });
    }
  });
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ---------------------------------------------------------------------------
// Convenience: a typed `parse` helper with prettier errors
// ---------------------------------------------------------------------------

/**
 * Parses an unknown value as an `AgentOutput`, returning a discriminated
 * result. Prefer this over `AgentOutputSchema.parse` at module boundaries so
 * callers don't have to handle thrown `ZodError`s themselves.
 */
export function parseAgentOutput(
  input: unknown,
):
  | { ok: true; data: AgentOutput }
  | { ok: false; error: z.ZodError<AgentOutput> } {
  const result = AgentOutputSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}
