/**
 * Automated meta-tests for TC-AGENT-001 … TC-AGENT-010.
 * Maps 1:1 to lib/agent-self-tests.ts and docs/4-test-plan.md.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AGENT_SELF_TESTS } from "@/lib/agent-self-tests";
import { buildAutomationSkeleton } from "@/lib/automation-templates";
import {
  renderAgentOutputAsJson,
  renderAgentOutputAsMarkdown,
  renderTestCasesAsCsv,
} from "@/lib/export";
import { ALLOWED_LLM_MODEL_IDS, DEFAULT_LLM_MODEL } from "@/lib/llm-models";
import {
  normalizeCoveragePayload,
  normalizeSyntheticDataPayload,
} from "@/lib/normalize";
import { OPENMRS_ENTITIES, TEST_CATEGORIES } from "@/lib/openmrs-reference";
import { PROMPT_PIPELINE_ORDER } from "@/lib/prompts";
import {
  AgentOutputSchema,
  TestCaseSchema,
} from "@/lib/schemas";
import { validateTestCases } from "@/lib/validator";
import {
  makeMinimalAgentOutput,
  makeTestCase,
} from "./fixtures/sample-test-case";

const RequestBodySchema = z.object({
  requirement: z
    .string()
    .trim()
    .min(20, "Requirement must be at least 20 characters long.")
    .max(8000, "Requirement is too long (max 8000 characters)."),
  requirementId: z.string().trim().max(120).optional(),
  model: z.enum(ALLOWED_LLM_MODEL_IDS).optional().default(DEFAULT_LLM_MODEL),
});

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Agent meta-test catalog", () => {
  it("TC-AGENT-001 — short requirements rejected before LLM (schema min 20)", () => {
    const result = RequestBodySchema.safeParse({ requirement: "too short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "requirement")).toBe(
        true,
      );
    }
  });

  it("TC-AGENT-002 — normalizeSyntheticDataPayload forces synthetic:true", () => {
    const raw = {
      syntheticData: {
        patients: [{ givenName: "Jane", familyName: "Doe" }],
        users: [],
        visits: [],
        encounters: [],
      },
    };
    const normalized = normalizeSyntheticDataPayload(raw) as {
      syntheticData: { patients: { synthetic?: boolean }[] };
    };
    expect(normalized.syntheticData.patients[0].synthetic).toBe(true);
  });

  it("TC-AGENT-003 — Clerk protects dashboard and API routes", () => {
    const middleware = readRepoFile("middleware.ts");
    const generateRoute = readRepoFile("app/api/agent/generate/route.ts");
    expect(middleware).toMatch(/auth\.protect\(\)/);
    expect(middleware).toMatch(/\/dashboard/);
    expect(generateRoute).toMatch(/auth\(\)/);
    expect(generateRoute).toMatch(/UNAUTHENTICATED/);
    expect(generateRoute).toMatch(/status: 401/);
  });

  it("TC-AGENT-004 — six-stage UI order matches pipeline prompt order", () => {
    const stageProgress = readRepoFile("components/StageProgress.tsx");
    expect(PROMPT_PIPELINE_ORDER).toHaveLength(6);
    for (const stageId of PROMPT_PIPELINE_ORDER) {
      expect(stageProgress).toContain(`id: "${stageId}"`);
    }
  });

  it("TC-AGENT-005 — AgentOutput rejected when safety checklist has fail", () => {
    const output = makeMinimalAgentOutput();
    output.safety = {
      passed: false,
      items: [
        {
          ruleId: "rbac-enforced",
          title: "RBAC enforced",
          status: "fail",
          detail: "Missing Security cases.",
        },
      ],
    };
    const parsed = AgentOutputSchema.safeParse(output);
    expect(parsed.success).toBe(false);
  });

  it("TC-AGENT-006 — malformed test cases dropped without failing valid ones", () => {
    const valid = makeTestCase();
    const invalid = { id: "not-a-valid-id", scenario: "x" };
    const items = [valid, invalid];
    const kept: typeof valid[] = [];
    const dropped: { index: number; reason: string }[] = [];

    for (const [index, item] of items.entries()) {
      const result = TestCaseSchema.safeParse(item);
      if (result.success) kept.push(result.data);
      else {
        dropped.push({
          index,
          reason: result.error.issues.map((i) => i.message).join("; "),
        });
      }
    }

    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("TC-REG-001");
    expect(dropped).toHaveLength(1);
    expect(dropped[0].index).toBe(1);
  });

  it("TC-AGENT-007 — normalizeCoveragePayload pads all enum keys", () => {
    const raw = {
      coverage: {
        byCategory: { Functional: 2 },
        byEntity: { Patient: 1 },
        byWorkflow: {},
      },
    };
    const normalized = normalizeCoveragePayload(raw) as {
      coverage: {
        byCategory: Record<string, number>;
        byEntity: Record<string, number>;
      };
    };
    for (const category of TEST_CATEGORIES) {
      expect(typeof normalized.coverage.byCategory[category]).toBe("number");
    }
    for (const entity of OPENMRS_ENTITIES) {
      expect(typeof normalized.coverage.byEntity[entity]).toBe("number");
    }
    expect(normalized.coverage.byCategory.Negative).toBe(0);
    expect(normalized.coverage.byEntity.Obs).toBe(0);
  });

  it("TC-AGENT-008 — generate route retries Groq/OpenAI rate limits", () => {
    const route = readRepoFile("app/api/agent/generate/route.ts");
    expect(route).toMatch(/runStageWithRetry/);
    expect(route).toMatch(/429|rate.?limit/i);
  });

  it("TC-AGENT-009 — export formats preserve test case metadata", () => {
    const output = makeMinimalAgentOutput([makeTestCase()]);
    const md = renderAgentOutputAsMarkdown(output);
    const json = renderAgentOutputAsJson(output);
    const csv = renderTestCasesAsCsv(output.testCases);

    expect(md).toContain("TC-REG-001");
    expect(md).toContain("Functional");
    expect(json).toContain('"scenario"');
    expect(json).toContain("PatientIdentifier");
    expect(csv).toContain("TC-REG-001");
    expect(csv).toContain("Clinician");
    expect(csv.split("\n")[0]).toContain("entities");
  });

  it("TC-AGENT-010 — Stage 3 prompt refuses realistic PHI generation", () => {
    const prompts = readRepoFile("lib/prompts.ts");
    expect(prompts).toMatch(/REFUSALS/);
    expect(prompts).toContain("TC-REFUSE-001");
    expect(prompts).toMatch(/realistic PHI/i);
  });

  it("documents at least 10 agent meta-tests", () => {
    expect(AGENT_SELF_TESTS.length).toBeGreaterThanOrEqual(10);
    const ids = AGENT_SELF_TESTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("OpenMRS test quality & automation skeletons", () => {
  it("validateTestCases scores a well-formed OpenMRS suite", () => {
    const cases = [
      makeTestCase(),
      makeTestCase({
        id: "TC-SEC-002",
        category: "Security",
        scenario:
          "Unauthorized receptionist cannot access clinician-only patient chart in OpenMRS.",
        openmrsRelevant: {
          entities: ["Patient", "User", "Role", "Privilege"],
          roles: ["Receptionist", "Clinician"],
          workflows: ["patient-chart"],
          privileges: ["app:coreapps.patientDashboard"],
        },
        tags: ["rbac"],
      }),
    ];
    const report = validateTestCases(cases);
    expect(report.score).toBeGreaterThan(0);
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it("buildAutomationSkeleton emits runnable Playwright snippets", () => {
    const skeleton = buildAutomationSkeleton([makeTestCase()]);
    expect(skeleton.uiTest).toContain("@playwright/test");
    expect(skeleton.uiTest).toContain("page.goto");
    expect(skeleton.apiTest).toContain("fetch");
    expect(skeleton.apiTest).toContain("Authorization");
    expect(skeleton.notes).toMatch(/BASE_URL/i);
  });
});
