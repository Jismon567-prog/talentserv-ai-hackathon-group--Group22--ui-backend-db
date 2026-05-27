/**
 * Test Case Validation Engine
 * ---------------------------
 * Quality gate for LLM-generated OpenMRS healthcare test cases.
 * Runs after schema validation to score completeness, clinical specificity,
 * OpenMRS grounding, and suite-level coverage.
 */

import { TEST_CATEGORIES } from "./openmrs-reference";
import { analyzeCoverage, missingScenarioMessage, SUITE_SIZE_TARGET } from "./coverage-engine";
import type {
  TestCase,
  TestCaseValidationCheck,
  TestCaseValidationReport,
} from "./schemas";

const ACTION_VERBS =
  /\b(open|navigate|submit|enter|select|click|post|get|verify|assert|create|update|delete|search|login|logout|assign|record|place|filter|export|attempt|deny|block|mask|redact)\b/i;

const VAGUE_PHRASES =
  /\b(works correctly|everything works|verify system|check that it works|should work|general test|misc)\b/i;

const SYNTHETIC_HINT =
  /\b(test[- ]?p[- ]?\d+|test[- ]?\d+|synth|synthetic|mock|sandbox|qa[- ]?patient|fictional)\b/i;

const OPENMRS_SURFACE =
  /\b(openmrs|\/ws\/rest|registration|encounter|visit|patient|observation|privilege|audit|clerk|clinician|nurse)\b/i;

const MIN_SCENARIO_LENGTH = 24;
const MIN_STEP_ACTION_LENGTH = 12;
const MIN_STEP_EXPECTED_LENGTH = 8;
const PASS_SCORE_THRESHOLD = 70;
const PASS_COVERAGE_THRESHOLD = 70;

type CheckInput = {
  id: string;
  label: string;
  severity: TestCaseValidationCheck["severity"];
  passed: boolean;
  message: string;
  suggestion?: string;
  testCaseIds?: string[];
};

function buildCheck(input: CheckInput): TestCaseValidationCheck {
  return {
    id: input.id,
    label: input.label,
    severity: input.severity,
    passed: input.passed,
    message: input.message,
    suggestion: input.suggestion,
    testCaseIds: input.testCaseIds,
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function scenarioFingerprint(scenario: string): string {
  return normalizeText(scenario).replace(/[^a-z0-9 ]/g, "");
}

function categoryCounts(testCases: TestCase[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(
    TEST_CATEGORIES.map((c) => [c, 0]),
  );
  for (const tc of testCases) {
    counts[tc.category] = (counts[tc.category] ?? 0) + 1;
  }
  return counts;
}

function scoreFromChecks(checks: TestCaseValidationCheck[]): number {
  if (checks.length === 0) return 0;

  let earned = 0;
  let total = 0;
  for (const check of checks) {
    const weight =
      check.severity === "critical" ? 3 : check.severity === "warning" ? 2 : 1;
    total += weight;
    if (check.passed) earned += weight;
  }

  return Math.round((earned / total) * 100);
}

/**
 * Validates a batch of generated test cases and returns a scored report
 * with actionable healthcare QA feedback.
 */
export function validateTestCases(testCases: TestCase[]): TestCaseValidationReport {
  const checks: TestCaseValidationCheck[] = [];
  const suggestions = new Set<string>();
  const categoryCoverage = categoryCounts(testCases) as TestCaseValidationReport["categoryCoverage"];

  if (testCases.length === 0) {
    return {
      score: 0,
      coverageScore: 0,
      passed: false,
      generatedAt: new Date().toISOString(),
      summary: "No test cases to validate.",
      checks: [
        buildCheck({
          id: "suite-nonempty",
          label: "Suite contains test cases",
          severity: "critical",
          passed: false,
          message: "The test case suite is empty.",
          suggestion: "Generate at least one test case before validation.",
        }),
      ],
      suggestions: ["Generate test cases from a healthcare requirement first."],
      categoryCoverage,
      coverageBreakdown: [],
      missingScenarios: [
        `Generate ${SUITE_SIZE_TARGET.min}–${SUITE_SIZE_TARGET.max} production-level test cases.`,
      ],
      duplicateIds: [],
    };
  }

  const coverageAnalysis = analyzeCoverage(testCases);
  const { coverageScore, coverageBreakdown, missingScenarios, entityCoverage } =
    coverageAnalysis;

  // --- Suite size (production target 12–20) ---------------------------------
  const inTargetRange =
    testCases.length >= SUITE_SIZE_TARGET.min &&
    testCases.length <= SUITE_SIZE_TARGET.max;
  checks.push(
    buildCheck({
      id: "suite-size",
      label: "Production suite size",
      severity: "warning",
      passed: inTargetRange,
      message: inTargetRange
        ? `${testCases.length} cases — within production target (${SUITE_SIZE_TARGET.min}–${SUITE_SIZE_TARGET.max}).`
        : `${testCases.length} case(s) — target ${SUITE_SIZE_TARGET.min}–${SUITE_SIZE_TARGET.max} for comprehensive OpenMRS coverage.`,
      suggestion: `Generate ${SUITE_SIZE_TARGET.min}–${SUITE_SIZE_TARGET.max} distinct scenarios covering all risk areas.`,
    }),
  );

  // --- Coverage dimensions --------------------------------------------------
  for (const area of coverageBreakdown) {
    checks.push(
      buildCheck({
        id: `coverage-${area.id}`,
        label: area.label,
        severity:
          area.severity === "critical"
            ? "critical"
            : area.severity === "important"
              ? "warning"
              : "info",
        passed: area.covered,
        message: area.covered
          ? `${area.count} case(s) — meets minimum (${area.minRequired}).`
          : `${area.count}/${area.minRequired} case(s) — insufficient coverage.`,
        suggestion: area.covered ? undefined : missingScenarioMessage(area),
      }),
    );
  }

  // --- OpenMRS entity coverage ----------------------------------------------
  const uncoveredEntities = Object.entries(entityCoverage)
    .filter(([, count]) => count === 0)
    .map(([entity]) => entity);
  checks.push(
    buildCheck({
      id: "openmrs-entity-coverage",
      label: "Core OpenMRS entity coverage",
      severity: "warning",
      passed: uncoveredEntities.length === 0,
      message:
        uncoveredEntities.length === 0
          ? "All core OpenMRS entities are referenced across the suite."
          : `Missing entity coverage: ${uncoveredEntities.join(", ")}.`,
      suggestion:
        uncoveredEntities.length > 0
          ? `Add cases referencing: ${uncoveredEntities.join(", ")}.`
          : undefined,
    }),
  );

  // --- Per-case structure ---------------------------------------------------
  const missingScenario = testCases.filter((tc) => !tc.scenario?.trim());
  checks.push(
    buildCheck({
      id: "structure-scenario",
      label: "Scenario present",
      severity: "critical",
      passed: missingScenario.length === 0,
      message:
        missingScenario.length === 0
          ? "Every test case includes a scenario summary."
          : `${missingScenario.length} test case(s) missing a scenario.`,
      suggestion: "Add a one-line clinical scenario for each test case.",
      testCaseIds: missingScenario.map((tc) => tc.id),
    }),
  );

  const weakScenarios = testCases.filter(
    (tc) =>
      tc.scenario.trim().length > 0 &&
      (tc.scenario.trim().length < MIN_SCENARIO_LENGTH ||
        VAGUE_PHRASES.test(tc.scenario)),
  );
  checks.push(
    buildCheck({
      id: "structure-scenario-quality",
      label: "Scenario specificity",
      severity: "warning",
      passed: weakScenarios.length === 0,
      message:
        weakScenarios.length === 0
          ? "Scenarios are specific and clinically worded."
          : `${weakScenarios.length} scenario(s) are too short or vague.`,
      suggestion:
        'Use "[Role] can [clinical action] when [context]" with OpenMRS surfaces named.',
      testCaseIds: weakScenarios.map((tc) => tc.id),
    }),
  );

  const missingSteps = testCases.filter((tc) => !tc.steps?.length);
  checks.push(
    buildCheck({
      id: "structure-steps",
      label: "Steps present",
      severity: "critical",
      passed: missingSteps.length === 0,
      message:
        missingSteps.length === 0
          ? "Every test case includes executable steps."
          : `${missingSteps.length} test case(s) have no steps.`,
      suggestion: "Add 1–3 imperative steps referencing UI modules or REST endpoints.",
      testCaseIds: missingSteps.map((tc) => tc.id),
    }),
  );

  const missingExpected = testCases.filter((tc) => !tc.expectedResult?.trim());
  checks.push(
    buildCheck({
      id: "structure-expected",
      label: "Expected result present",
      severity: "critical",
      passed: missingExpected.length === 0,
      message:
        missingExpected.length === 0
          ? "Every test case declares an overall expected result."
          : `${missingExpected.length} test case(s) missing expectedResult.`,
      suggestion: "State the observable pass condition for the whole scenario.",
      testCaseIds: missingExpected.map((tc) => tc.id),
    }),
  );

  const missingPriority = testCases.filter((tc) => !tc.priority);
  checks.push(
    buildCheck({
      id: "structure-priority",
      label: "Priority assigned",
      severity: "warning",
      passed: missingPriority.length === 0,
      message:
        missingPriority.length === 0
          ? "All test cases have a priority."
          : `${missingPriority.length} test case(s) missing priority.`,
      testCaseIds: missingPriority.map((tc) => tc.id),
    }),
  );

  // --- Categories -----------------------------------------------------------
  checks.push(
    buildCheck({
      id: "category-valid",
      label: "Valid test categories",
      severity: "critical",
      passed: testCases.every((tc) =>
        (TEST_CATEGORIES as readonly string[]).includes(tc.category),
      ),
      message: "All categories belong to the OpenMRS test taxonomy.",
      suggestion:
        "Use Functional, Negative, Validation, Security, Privacy, or Audit.",
    }),
  );

  const hasFunctional = categoryCoverage.Functional > 0;
  const hasNegative = categoryCoverage.Negative > 0;
  const hasValidation = categoryCoverage.Validation > 0;
  checks.push(
    buildCheck({
      id: "category-functional",
      label: "Functional coverage",
      severity: "warning",
      passed: hasFunctional,
      message: hasFunctional
        ? "At least one Functional happy-path case exists."
        : "No Functional test case found.",
      suggestion: "Add a happy-path workflow case (registration, visit, vitals, etc.).",
    }),
  );
  checks.push(
    buildCheck({
      id: "category-negative-validation",
      label: "Negative / validation coverage",
      severity: "warning",
      passed: hasNegative || hasValidation,
      message:
        hasNegative || hasValidation
          ? "Negative or Validation cases are present."
          : "No Negative or Validation cases found.",
      suggestion:
        "Add invalid input, duplicate identifier, or field-format validation cases.",
    }),
  );

  const hasSecurity = categoryCoverage.Security > 0;
  const hasPrivacy = categoryCoverage.Privacy > 0;
  const hasAudit = categoryCoverage.Audit > 0;
  checks.push(
    buildCheck({
      id: "category-security-privacy",
      label: "Security & privacy coverage",
      severity: "info",
      passed: hasSecurity && hasPrivacy,
      message:
        hasSecurity && hasPrivacy
          ? "Both Security and Privacy categories are represented."
          : `Security: ${hasSecurity ? "yes" : "no"} · Privacy: ${hasPrivacy ? "yes" : "no"}.`,
      suggestion:
        "Include RBAC denial cases (Security) and PHI masking cases (Privacy).",
    }),
  );
  checks.push(
    buildCheck({
      id: "category-audit",
      label: "Audit coverage",
      severity: "info",
      passed: hasAudit,
      message: hasAudit
        ? "At least one Audit test case exists."
        : "No Audit test case found.",
      suggestion:
        "Add an audit-log assertion after create/update actions (actor, entity, timestamp).",
    }),
  );

  // --- OpenMRS relevance ----------------------------------------------------
  const missingEntities = testCases.filter(
    (tc) => !tc.openmrsRelevant?.entities?.length,
  );
  checks.push(
    buildCheck({
      id: "openmrs-entities",
      label: "OpenMRS entities referenced",
      severity: "critical",
      passed: missingEntities.length === 0,
      message:
        missingEntities.length === 0
          ? "Every test case references OpenMRS entities."
          : `${missingEntities.length} test case(s) missing openmrsRelevant.entities.`,
      suggestion:
        "Name entities such as Patient, Visit, Encounter, User, Role, or Privilege.",
      testCaseIds: missingEntities.map((tc) => tc.id),
    }),
  );

  const weakOpenMrsContext = testCases.filter((tc) => {
    const text = [
      tc.scenario,
      tc.expectedResult,
      ...tc.steps.map((s) => `${s.action} ${s.expected}`),
    ].join(" ");
    return !OPENMRS_SURFACE.test(text);
  });
  checks.push(
    buildCheck({
      id: "openmrs-context",
      label: "OpenMRS clinical context",
      severity: "warning",
      passed: weakOpenMrsContext.length === 0,
      message:
        weakOpenMrsContext.length === 0
          ? "Steps and scenarios reference OpenMRS/clinical surfaces."
          : `${weakOpenMrsContext.length} case(s) lack OpenMRS-specific vocabulary.`,
      suggestion:
        "Reference modules (Registration, Clinical), REST paths, roles, or privileges.",
      testCaseIds: weakOpenMrsContext.map((tc) => tc.id),
    }),
  );

  const securityCases = testCases.filter((tc) => tc.category === "Security");
  const securityMissingRoles = securityCases.filter(
    (tc) => !tc.openmrsRelevant.roles?.length,
  );
  checks.push(
    buildCheck({
      id: "openmrs-security-roles",
      label: "Security cases name roles",
      severity: "warning",
      passed: securityMissingRoles.length === 0,
      message:
        securityCases.length === 0
          ? "No Security cases to evaluate for roles."
          : securityMissingRoles.length === 0
            ? "Security cases specify OpenMRS roles under test."
            : `${securityMissingRoles.length} Security case(s) missing roles.`,
      suggestion:
        "Name authorized vs unauthorized roles (e.g. Registration Clerk vs Nurse).",
      testCaseIds: securityMissingRoles.map((tc) => tc.id),
    }),
  );

  const securityMissingPrivileges = securityCases.filter(
    (tc) => !tc.openmrsRelevant.privileges?.length,
  );
  checks.push(
    buildCheck({
      id: "openmrs-security-privileges",
      label: "Security cases assert privileges",
      severity: "info",
      passed:
        securityCases.length === 0 || securityMissingPrivileges.length === 0,
      message:
        securityCases.length === 0
          ? "No Security cases to evaluate for privileges."
          : securityMissingPrivileges.length === 0
            ? "Security cases reference OpenMRS privileges."
            : `${securityMissingPrivileges.length} Security case(s) missing privileges.`,
      suggestion: 'Assert privileges like "View Patients" or "Add Encounters".',
      testCaseIds: securityMissingPrivileges.map((tc) => tc.id),
    }),
  );

  // --- Duplicates -----------------------------------------------------------
  const idCounts = new Map<string, number>();
  for (const tc of testCases) {
    idCounts.set(tc.id, (idCounts.get(tc.id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  checks.push(
    buildCheck({
      id: "duplicates-id",
      label: "Unique test case IDs",
      severity: "critical",
      passed: duplicateIds.length === 0,
      message:
        duplicateIds.length === 0
          ? "All test case IDs are unique."
          : `Duplicate IDs: ${duplicateIds.join(", ")}.`,
      suggestion: "Use unique IDs like TC-REG-001, TC-REG-002.",
      testCaseIds: duplicateIds,
    }),
  );

  const scenarioMap = new Map<string, string[]>();
  for (const tc of testCases) {
    const fp = scenarioFingerprint(tc.scenario);
    if (!fp) continue;
    const bucket = scenarioMap.get(fp) ?? [];
    bucket.push(tc.id);
    scenarioMap.set(fp, bucket);
  }
  const duplicateScenarios = [...scenarioMap.values()].filter((ids) => ids.length > 1);
  checks.push(
    buildCheck({
      id: "duplicates-scenario",
      label: "No duplicate scenarios",
      severity: "warning",
      passed: duplicateScenarios.length === 0,
      message:
        duplicateScenarios.length === 0
          ? "No near-duplicate scenarios detected."
          : `${duplicateScenarios.length} duplicate scenario group(s) found.`,
      suggestion: "Merge identical scenarios or differentiate preconditions/steps.",
      testCaseIds: duplicateScenarios.flat(),
    }),
  );

  // --- Step quality ---------------------------------------------------------
  const weakSteps: string[] = [];
  for (const tc of testCases) {
    for (const step of tc.steps) {
      const action = step.action.trim();
      const expected = step.expected.trim();
      if (
        action.length < MIN_STEP_ACTION_LENGTH ||
        !ACTION_VERBS.test(action) ||
        expected.length < MIN_STEP_EXPECTED_LENGTH
      ) {
        weakSteps.push(tc.id);
        break;
      }
    }
  }
  checks.push(
    buildCheck({
      id: "steps-actionable",
      label: "Actionable, detailed steps",
      severity: "warning",
      passed: weakSteps.length === 0,
      message:
        weakSteps.length === 0
          ? "Steps use imperative actions with observable expected outcomes."
          : `${weakSteps.length} case(s) have steps that are too short or non-actionable.`,
      suggestion:
        "Start actions with verbs (Open, POST, Verify) and state one observable expected result per step.",
      testCaseIds: [...new Set(weakSteps)],
    }),
  );

  const missingPreconditions = testCases.filter((tc) => !tc.preconditions?.length);
  checks.push(
    buildCheck({
      id: "healthcare-preconditions",
      label: "Clinical preconditions",
      severity: "info",
      passed: missingPreconditions.length <= Math.ceil(testCases.length * 0.4),
      message:
        missingPreconditions.length === 0
          ? "All cases include facility/role/patient preconditions."
          : `${missingPreconditions.length} case(s) omit preconditions.`,
      suggestion:
        "Document authenticated role, location, and synthetic patient/visit state.",
      testCaseIds: missingPreconditions.map((tc) => tc.id),
    }),
  );

  const missingSyntheticHints = testCases.filter((tc) => {
    const blob = [tc.scenario, ...tc.preconditions, tc.expectedResult].join(" ");
    return !SYNTHETIC_HINT.test(blob);
  });
  checks.push(
    buildCheck({
      id: "synthetic-data-hints",
      label: "Synthetic data markers",
      severity: "info",
      passed: missingSyntheticHints.length <= Math.ceil(testCases.length * 0.5),
      message:
        missingSyntheticHints.length === 0
          ? "Cases reference synthetic/test identifiers."
          : `${missingSyntheticHints.length} case(s) do not mention synthetic identifiers.`,
      suggestion:
        'Use TEST-P-001, synthetic UUIDs, or "sandbox patient" in preconditions.',
      testCaseIds: missingSyntheticHints.map((tc) => tc.id),
    }),
  );

  const missingTraceability = testCases.filter((tc) => !tc.traceabilityRef?.trim());
  checks.push(
    buildCheck({
      id: "traceability",
      label: "Traceability references",
      severity: "info",
      passed: missingTraceability.length <= Math.ceil(testCases.length * 0.5),
      message:
        missingTraceability.length === 0
          ? "Cases map to acceptance criteria references."
          : `${missingTraceability.length} case(s) missing traceabilityRef.`,
      suggestion: 'Map cases to AC-001, AC-002 from the requirement analysis.',
      testCaseIds: missingTraceability.map((tc) => tc.id),
    }),
  );

  // --- Suggestions aggregate ------------------------------------------------
  for (const check of checks) {
    if (!check.passed && check.suggestion) {
      suggestions.add(check.suggestion);
    }
  }
  for (const scenario of missingScenarios) {
    suggestions.add(scenario);
  }

  const score = scoreFromChecks(checks);
  const criticalFailures = checks.filter((c) => !c.passed && c.severity === "critical");
  const passed =
    score >= PASS_SCORE_THRESHOLD &&
    coverageScore >= PASS_COVERAGE_THRESHOLD &&
    criticalFailures.length === 0;

  const summary = passed
    ? `Quality ${score}/100 · Coverage ${coverageScore}% — production-ready suite (${testCases.length} cases).`
    : coverageScore < PASS_COVERAGE_THRESHOLD
      ? `Coverage ${coverageScore}% — expand scenarios across missing areas (quality ${score}/100).`
      : criticalFailures.length > 0
        ? `Quality ${score}/100 · Coverage ${coverageScore}% — ${criticalFailures.length} critical issue(s) need attention.`
        : `Quality ${score}/100 · Coverage ${coverageScore}% — address warnings to strengthen clinical coverage.`;

  return {
    score,
    coverageScore,
    passed,
    generatedAt: new Date().toISOString(),
    summary,
    checks,
    suggestions: [...suggestions],
    categoryCoverage,
    coverageBreakdown,
    missingScenarios,
    duplicateIds,
  };
}

/** Badge tone for dashboard UI. */
export function validationScoreTone(
  score: number,
): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}
