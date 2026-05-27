/**
 * Markdown export
 * ---------------
 * Renders a full `AgentOutput` into a single Markdown report suitable for
 * "Copy as Markdown" / "Download report.md" actions in the dashboard.
 *
 * Style goals:
 *  - Human-skim-able sections (headings, tables for counts, fenced code).
 *  - Stable enough that two runs over the same output produce identical
 *    text (no timestamps beyond what's already in the payload).
 *  - No external markdown library — keeps the bundle and risk surface tiny.
 */

import type { AgentOutput } from "./schemas";

/** Public entry point. */
export function renderAgentOutputAsMarkdown(output: AgentOutput): string {
  return [
    renderHeader(output),
    renderTestCases(output),
    renderSyntheticData(output),
    renderAutomation(output),
    renderCoverageAndSafety(output),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderHeader(output: AgentOutput): string {
  const { meta } = output;
  return [
    `# OpenMRS AI Test Automation Report`,
    ``,
    `- **Run id:** \`${meta.runId}\``,
    `- **Generated:** ${meta.generatedAt}`,
    `- **Model:** \`${meta.model ?? "n/a"}\``,
    `- **Agent version:** \`${meta.agentVersion}\``,
    ``,
    `## Requirement`,
    ``,
    `> ${meta.requirementText.split("\n").join("\n> ")}`,
  ].join("\n");
}

function renderTestCases(output: AgentOutput): string {
  if (output.testCases.length === 0) return "";
  const lines: string[] = [`## Test cases (${output.testCases.length})`, ``];
  for (const tc of output.testCases) {
    lines.push(`### \`${tc.id}\` — ${tc.scenario}`);
    lines.push("");
    lines.push(`- **Category:** ${tc.category}`);
    lines.push(`- **Priority:** ${tc.priority}`);
    if (tc.openmrsRelevant.entities.length > 0) {
      lines.push(
        `- **Entities:** ${tc.openmrsRelevant.entities.join(", ")}`,
      );
    }
    if (tc.openmrsRelevant.roles.length > 0) {
      lines.push(`- **Roles:** ${tc.openmrsRelevant.roles.join(", ")}`);
    }
    if (tc.preconditions.length > 0) {
      lines.push("");
      lines.push(`**Preconditions**`);
      for (const p of tc.preconditions) lines.push(`- ${p}`);
    }
    lines.push("");
    lines.push(`**Steps**`);
    for (const s of tc.steps) {
      lines.push(`${s.step}. ${s.action}`);
      lines.push(`   - _Expected:_ ${s.expected}`);
    }
    lines.push("");
    lines.push(`**Expected result:** ${tc.expectedResult}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderSyntheticData(output: AgentOutput): string {
  const { patients, users, visits, encounters } = output.syntheticData;
  const total =
    patients.length + users.length + visits.length + encounters.length;
  if (total === 0) return "";

  const lines: string[] = [`## Synthetic data (${total} records)`, ``];
  lines.push(`| Collection | Count |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Patients | ${patients.length} |`);
  lines.push(`| Users | ${users.length} |`);
  lines.push(`| Visits | ${visits.length} |`);
  lines.push(`| Encounters | ${encounters.length} |`);
  lines.push("");

  if (patients.length > 0) {
    lines.push(`### Patients`);
    lines.push(``);
    lines.push(`| id | name | gender | birthdate | identifier |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const p of patients) {
      lines.push(
        `| ${md(p.id)} | ${md(p.name)} | ${md(p.gender)} | ${md(p.birthdate)} | ${md(p.identifier)} |`,
      );
    }
    lines.push("");
  }

  if (users.length > 0) {
    lines.push(`### Users`);
    lines.push(``);
    lines.push(`| id | username | role | fullName |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const u of users) {
      lines.push(
        `| ${md(u.id)} | ${md(u.username)} | ${md(u.role)} | ${md(u.fullName)} |`,
      );
    }
    lines.push("");
  }

  if (visits.length > 0) {
    lines.push(`### Visits`);
    lines.push(``);
    lines.push(`| id | patientId | visitDate | status |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const v of visits) {
      lines.push(
        `| ${md(v.id)} | ${md(v.patientId)} | ${md(v.visitDate)} | ${md(v.status)} |`,
      );
    }
    lines.push("");
  }

  if (encounters.length > 0) {
    lines.push(`### Encounters`);
    lines.push(``);
    for (const e of encounters) {
      lines.push(
        `- **${md(e.type ?? "Encounter")}** · patient \`${md(e.patientId)}\` · visit \`${md(e.visitId)}\` · ${md(e.encounterDate)}`,
      );
      if (e.notes) lines.push(`  - ${e.notes}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderAutomation(output: AgentOutput): string {
  const { uiTest, apiTest, notes } = output.automation;
  if (!uiTest.trim() && !apiTest.trim()) return "";

  const lines: string[] = [`## Automation skeleton`, ``];
  if (notes) lines.push(`> ${notes}`, ``);

  if (uiTest.trim()) {
    lines.push(`### Playwright — UI test`);
    lines.push("");
    lines.push("```typescript");
    lines.push(uiTest.trim());
    lines.push("```");
    lines.push("");
  }
  if (apiTest.trim()) {
    lines.push(`### fetch — REST API test`);
    lines.push("");
    lines.push("```typescript");
    lines.push(apiTest.trim());
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

function renderCoverageAndSafety(output: AgentOutput): string {
  const { coverage, safety } = output;
  const lines: string[] = [`## Coverage & safety`, ``];

  const pct = Math.round(coverage.coveragePct * 100);
  lines.push(
    `- **Coverage:** ${pct}% · ${coverage.totalTestCases} test case${
      coverage.totalTestCases === 1 ? "" : "s"
    }`,
  );

  lines.push("");
  lines.push(`### By category`);
  lines.push(``);
  lines.push(`| Category | Count |`);
  lines.push(`| --- | --- |`);
  for (const [k, v] of Object.entries(coverage.byCategory)) {
    lines.push(`| ${k} | ${v ?? 0} |`);
  }
  lines.push("");

  lines.push(`### By OpenMRS entity`);
  lines.push(``);
  lines.push(`| Entity | Count |`);
  lines.push(`| --- | --- |`);
  for (const [k, v] of Object.entries(coverage.byEntity)) {
    lines.push(`| ${k} | ${v ?? 0} |`);
  }
  lines.push("");

  if (coverage.gaps.length > 0) {
    lines.push(`### Gaps`);
    for (const g of coverage.gaps) {
      lines.push(`- **[${g.severity}]** ${g.area}: ${g.reason}`);
    }
    lines.push("");
  }

  lines.push(`### Safety checklist`);
  lines.push(``);
  lines.push(
    `Overall: **${safety.passed ? "PASS" : "FAIL"}** · ` +
      `${safety.items.filter((i) => i.status === "pass").length} pass, ` +
      `${safety.items.filter((i) => i.status === "warn").length} warn, ` +
      `${safety.items.filter((i) => i.status === "fail").length} fail`,
  );
  lines.push("");
  lines.push(`| Rule | Status | Detail |`);
  lines.push(`| --- | --- | --- |`);
  for (const item of safety.items) {
    lines.push(
      `| \`${md(item.ruleId)}\` — ${md(item.title)} | ${item.status.toUpperCase()} | ${mdEscape(item.detail)} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Markdown table-cell safe rendering of an optional string. */
function md(v: string | undefined | null): string {
  if (v == null || v === "") return "—";
  return mdEscape(v);
}

/** Escape pipes and newlines so they don't break the markdown table. */
function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}
