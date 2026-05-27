/**
 * Deterministic Playwright + REST automation skeletons from test cases.
 * Skips the Stage 5 LLM round-trip (~8–15s saved per run).
 */

import type { AutomationSkeleton, TestCase } from "./schemas";

function pickRepresentativeCase(testCases: TestCase[]): TestCase {
  return (
    testCases.find((tc) => tc.category === "Functional") ??
    testCases.find((tc) => tc.category === "Security") ??
    testCases[0]
  );
}

function escapeForComment(text: string): string {
  return text.replace(/\*\//g, "* /").slice(0, 120);
}

export function buildAutomationSkeleton(testCases: TestCase[]): AutomationSkeleton {
  if (testCases.length === 0) {
    return { uiTest: "", apiTest: "", notes: "No test cases available." };
  }

  const tc = pickRepresentativeCase(testCases);
  const firstStep = tc.steps[0];
  const entities = tc.openmrsRelevant.entities.join(", ");
  const roles = tc.openmrsRelevant.roles.join(", ") || "Clinician";

  const uiTest = `import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://openmrs-test.example.org";

// ${tc.id}: ${escapeForComment(tc.scenario)}
test("${tc.id} — ${escapeForComment(tc.scenario)}", async ({ page }) => {
  // Preconditions: ${roles}; entities: ${entities}
  await page.goto(\`\${BASE_URL}/openmrs\`);
  ${firstStep ? `// Step 1: ${escapeForComment(firstStep.action)}\n  // Expected: ${escapeForComment(firstStep.expected)}` : ""}
  await expect(page).toHaveURL(/openmrs/);
});`;

  const apiTest = `import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://openmrs-test.example.org";
const AUTH = "Basic " + Buffer.from("clerk.alpha:Test1234").toString("base64");

// ${tc.id}: ${escapeForComment(tc.scenario)}
test("${tc.id} — API smoke for ${tc.category}", async () => {
  const res = await fetch(\`\${BASE_URL}/openmrs/ws/rest/v1/patient?q=Synthia\`, {
    headers: { Authorization: AUTH, Accept: "application/json" },
  });
  expect([200, 401, 403]).toContain(res.status);
});`;

  return {
    uiTest,
    apiTest,
    notes:
      "Generated locally from test cases. Install: npm i -D @playwright/test. Set BASE_URL to your OpenMRS instance.",
  };
}
