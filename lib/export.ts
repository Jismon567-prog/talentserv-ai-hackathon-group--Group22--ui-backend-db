/**
 * Export helpers — Markdown, JSON, and CSV formats for generated artifacts.
 */

import { renderAgentOutputAsMarkdown } from "./markdown";
import type { AgentOutput, TestCase } from "./schemas";

export { renderAgentOutputAsMarkdown };

/** Full AgentOutput as pretty-printed JSON. */
export function renderAgentOutputAsJson(output: AgentOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * Flat CSV of test cases — suitable for import into TestRail, Zephyr, or Excel.
 * One row per test case; steps are concatenated with " | " separators.
 */
export function renderTestCasesAsCsv(testCases: TestCase[]): string {
  const headers = [
    "id",
    "scenario",
    "category",
    "priority",
    "preconditions",
    "steps",
    "expectedResult",
    "entities",
    "roles",
    "workflows",
    "privileges",
    "tags",
    "traceabilityRef",
  ] as const;

  const rows = testCases.map((tc) => [
    tc.id,
    tc.scenario,
    tc.category,
    tc.priority,
    tc.preconditions.join(" | "),
    tc.steps
      .map((s) => `${s.step}. ${s.action} → ${s.expected}`)
      .join(" | "),
    tc.expectedResult,
    tc.openmrsRelevant.entities.join("; "),
    tc.openmrsRelevant.roles.join("; "),
    tc.openmrsRelevant.workflows.join("; "),
    tc.openmrsRelevant.privileges.join("; "),
    tc.tags.join("; "),
    tc.traceabilityRef ?? "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join(
    "\n",
  );
}

/** CSV export scoped to test cases from a full agent run. */
export function renderAgentTestCasesCsv(output: AgentOutput): string {
  return renderTestCasesAsCsv(output.testCases);
}

/** RFC 4180-style cell escaping. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Suggested filename stem for downloads (no extension). */
export function exportFilenameStem(output: AgentOutput): string {
  const safeId = output.meta.runId.slice(0, 8);
  const stamp = new Date(output.meta.generatedAt)
    .toISOString()
    .replace(/[:.]/g, "-");
  return `openmrs-agent-${stamp}-${safeId}`;
}
