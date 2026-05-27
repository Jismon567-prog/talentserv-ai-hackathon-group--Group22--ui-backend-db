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
  return testCases.map((tc) => ({
    id: tc.id,
    category: tc.category,
    scenario: tc.scenario,
    entities: tc.openmrsRelevant.entities,
    roles: tc.openmrsRelevant.roles,
    workflows: tc.openmrsRelevant.workflows,
    tags: tc.tags,
  }));
}

/** Slim test-case view for automation skeleton (one representative flow). */
export function slimTestCasesForAutomation(testCases: TestCase[]) {
  return testCases.map((tc) => ({
    id: tc.id,
    scenario: tc.scenario,
    category: tc.category,
    steps: tc.steps.slice(0, 2),
    expectedResult: tc.expectedResult,
  }));
}
