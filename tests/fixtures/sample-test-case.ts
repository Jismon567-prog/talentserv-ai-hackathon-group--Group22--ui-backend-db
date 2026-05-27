import type { AgentOutput, TestCase } from "@/lib/schemas";

export function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "TC-REG-001",
    scenario:
      "Clinician registers a synthetic patient via the OpenMRS registration workflow.",
    category: "Functional",
    priority: "High",
    preconditions: ["Authenticated Clerk user with registration privilege"],
    steps: [
      {
        step: 1,
        action: "Navigate to the OpenMRS patient registration form",
        expected: "Registration form loads without errors",
      },
      {
        step: 2,
        action: "Submit synthetic patient demographics with TEST- identifier",
        expected: "Patient record is created successfully",
      },
    ],
    expectedResult:
      "Synthetic patient appears in OpenMRS with a TEST- prefixed identifier.",
    openmrsRelevant: {
      entities: ["Patient", "PatientIdentifier"],
      roles: ["Clinician"],
      workflows: ["patient-registration"],
      privileges: ["Add Patients"],
    },
    tags: ["smoke", "registration"],
    ...overrides,
  };
}

export function makeMinimalAgentOutput(
  testCases: TestCase[] = [makeTestCase()],
): AgentOutput {
  const now = new Date().toISOString();
  return {
    meta: {
      runId: "11111111-1111-4111-8111-111111111111",
      agentVersion: "0.1.0",
      generatedAt: now,
      requirementText:
        "As a clinician, I can register a synthetic patient in OpenMRS with audit logging enabled.",
      model: "gpt-4o-mini",
    },
    stages: [
      {
        name: "requirement-parsing",
        status: "succeeded",
        startedAt: now,
        finishedAt: now,
      },
    ],
    testCases,
    testCaseValidation: {
      score: 85,
      coverageScore: 75,
      passed: true,
      generatedAt: now,
      summary: "Fixture validation report for automated export tests.",
      checks: [],
      suggestions: [],
      categoryCoverage: {
        Functional: 1,
        Negative: 0,
        Validation: 0,
        Security: 0,
        Privacy: 0,
        Audit: 0,
      },
      coverageBreakdown: [],
      missingScenarios: [],
      duplicateIds: [],
    },
    syntheticData: {
      patients: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          givenName: "Synthia",
          familyName: "Testpatient",
          identifier: "TEST-001",
          synthetic: true,
        },
      ],
      users: [],
      visits: [],
      encounters: [],
    },
    automation: {
      uiTest: "// playwright ui skeleton",
      apiTest: "// playwright api skeleton",
      notes: "Fixture automation skeleton.",
    },
    coverage: {
      generatedAt: now,
      totalTestCases: testCases.length,
      byCategory: {
        Functional: testCases.filter((tc) => tc.category === "Functional").length,
        Negative: 0,
        Validation: 0,
        Security: 0,
        Privacy: 0,
        Audit: 0,
      },
      byEntity: {
        Patient: 1,
        PatientIdentifier: 1,
        Visit: 0,
        Encounter: 0,
        Obs: 0,
        User: 0,
        Role: 0,
        Privilege: 0,
      },
      byWorkflow: { "patient-registration": 1 },
      coveragePct: 0.75,
      gaps: [],
    },
    safety: {
      passed: true,
      items: [
        {
          ruleId: "no-real-phi",
          title: "No real PHI",
          status: "pass",
          detail: "Fixture uses synthetic placeholders only.",
        },
      ],
    },
  };
}
