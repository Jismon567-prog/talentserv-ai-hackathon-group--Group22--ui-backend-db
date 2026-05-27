/**
 * Helpers to shrink LLM prompts — fewer input tokens means faster completions.
 */

import type { TestCase } from "@/lib/schemas";

/** Compact JSON (no pretty-print) for stage user messages. */
export function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Slim test-case view for synthetic-data generation (no full step lists). */
export function slimTestCasesForSyntheticData(testCases: TestCase[]) {
  return testCases.slice(0, 8).map((tc) => ({
    id: tc.id,
    category: tc.category,
    scenario: tc.scenario.slice(0, 160),
    entities: tc.openmrsRelevant.entities,
    roles: tc.openmrsRelevant.roles.slice(0, 2),
    tags: tc.tags.slice(0, 4),
  }));
}

/** Slim Stage 1 analysis for downstream stages. */
export function slimAnalysisForPipeline(analysis: unknown): unknown {
  if (!analysis || typeof analysis !== "object") return analysis;
  const a = analysis as Record<string, unknown>;
  return {
    summary: a.summary,
    actors: Array.isArray(a.actors) ? a.actors.slice(0, 6) : a.actors,
    workflows: Array.isArray(a.workflows) ? a.workflows.slice(0, 4) : a.workflows,
    acceptanceCriteria: Array.isArray(a.acceptanceCriteria)
      ? a.acceptanceCriteria.slice(0, 8)
      : a.acceptanceCriteria,
    entitiesTouched: Array.isArray(a.entitiesTouched)
      ? a.entitiesTouched.slice(0, 8)
      : a.entitiesTouched,
  };
}

/** Slim Stage 2 risk plan for test-case generation. */
export function slimRiskPlanForTestGen(riskPlan: unknown): unknown {
  if (!riskPlan || typeof riskPlan !== "object") return riskPlan;
  const r = riskPlan as Record<string, unknown>;
  return {
    phiFields: Array.isArray(r.phiFields) ? r.phiFields.slice(0, 8) : r.phiFields,
    rolesUnderTest: Array.isArray(r.rolesUnderTest)
      ? r.rolesUnderTest.slice(0, 4)
      : r.rolesUnderTest,
    requiredTestCategories: Array.isArray(r.requiredTestCategories)
      ? r.requiredTestCategories
      : r.requiredTestCategories,
    topThreats: Array.isArray(r.threats)
      ? (r.threats as unknown[]).slice(0, 6)
      : r.topThreats,
  };
}

/** Slim test-case view for automation skeleton (one representative flow). */
export function slimTestCasesForAutomation(testCases: TestCase[]) {
  return testCases.slice(0, 3).map((tc) => ({
    id: tc.id,
    scenario: tc.scenario.slice(0, 120),
    category: tc.category,
    steps: tc.steps.slice(0, 2),
    expectedResult: tc.expectedResult.slice(0, 120),
  }));
}
