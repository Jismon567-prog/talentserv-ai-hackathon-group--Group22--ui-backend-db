/**
 * Coverage analysis engine
 * ------------------------
 * Shared scoring for test-suite breadth: category dimensions, OpenMRS entities,
 * workflows, and suite size (8–12 cases).
 */

import { OPENMRS_ENTITIES, type OpenMrsEntity } from "./openmrs-reference";
import type { TestCase } from "./schemas";

export interface CoverageAreaDefinition {
  id: string;
  label: string;
  minCases: number;
  severity: "critical" | "important" | "recommended";
}

export interface CoverageAreaResult {
  id: string;
  label: string;
  covered: boolean;
  count: number;
  minRequired: number;
  severity: CoverageAreaDefinition["severity"];
}

/** Production coverage dimensions mapped to categories, tags, and clinical signals. */
export const COVERAGE_AREAS: readonly CoverageAreaDefinition[] = [
  {
    id: "functional",
    label: "Functional (Positive)",
    minCases: 2,
    severity: "critical",
  },
  {
    id: "negative",
    label: "Negative / Error scenarios",
    minCases: 1,
    severity: "critical",
  },
  {
    id: "validation",
    label: "Validation & Boundary testing",
    minCases: 1,
    severity: "important",
  },
  {
    id: "rbac",
    label: "Role-based Access Control (RBAC)",
    minCases: 1,
    severity: "critical",
  },
  {
    id: "privacy",
    label: "Privacy & Data Protection (HIPAA-like)",
    minCases: 1,
    severity: "critical",
  },
  {
    id: "audit",
    label: "Audit & Traceability",
    minCases: 1,
    severity: "important",
  },
  {
    id: "security",
    label: "Security (Auth, bypass, injection)",
    minCases: 1,
    severity: "critical",
  },
  {
    id: "performance",
    label: "Performance & Concurrency",
    minCases: 1,
    severity: "recommended",
  },
  {
    id: "regression",
    label: "Regression & Edge cases",
    minCases: 1,
    severity: "important",
  },
  {
    id: "integration",
    label: "Integration (Patient → Visit → Encounter)",
    minCases: 1,
    severity: "critical",
  },
] as const;

export const SUITE_SIZE_TARGET = { min: 6, max: 10 } as const;

const CORE_ENTITIES: OpenMrsEntity[] = [
  "Patient",
  "Visit",
  "Encounter",
  "Obs",
  "User",
  "Role",
  "Privilege",
  "PatientIdentifier",
];

function blob(tc: TestCase): string {
  return [
    tc.scenario,
    tc.expectedResult,
    ...tc.preconditions,
    ...tc.steps.map((s) => `${s.action} ${s.expected}`),
    ...tc.tags,
    ...tc.openmrsRelevant.workflows,
  ]
    .join(" ")
    .toLowerCase();
}

function tagMatch(tc: TestCase, pattern: RegExp): boolean {
  return tc.tags.some((t) => pattern.test(t));
}

function countWhere(testCases: TestCase[], predicate: (tc: TestCase) => boolean): number {
  return testCases.filter(predicate).length;
}

function detectAreaCount(areaId: string, testCases: TestCase[]): number {
  switch (areaId) {
    case "functional":
      return countWhere(testCases, (tc) => tc.category === "Functional");
    case "negative":
      return countWhere(testCases, (tc) => tc.category === "Negative");
    case "validation":
      return countWhere(testCases, (tc) => tc.category === "Validation");
    case "rbac":
      return countWhere(
        testCases,
        (tc) =>
          tc.category === "Security" &&
          (tagMatch(tc, /\b(rbac|role|privilege)\b/i) ||
            (tc.openmrsRelevant.roles?.length ?? 0) > 0 ||
            (tc.openmrsRelevant.privileges?.length ?? 0) > 0),
      );
    case "privacy":
      return countWhere(testCases, (tc) => tc.category === "Privacy");
    case "audit":
      return countWhere(testCases, (tc) => tc.category === "Audit");
    case "security":
      return countWhere(
        testCases,
        (tc) =>
          tc.category === "Security" &&
          /\b(auth|login|session|csrf|idor|injection|bypass|unauthorized|403|401)\b/i.test(
            blob(tc),
          ),
      );
    case "performance":
      return countWhere(
        testCases,
        (tc) =>
          tagMatch(tc, /\b(performance|concurrency|concurrent|load|latency|throughput)\b/i) ||
          /\b(concurrent|parallel|performance|load test|response time|timeout)\b/i.test(blob(tc)),
      );
    case "regression":
      return countWhere(
        testCases,
        (tc) =>
          tagMatch(tc, /\b(regression|edge|edge-case|boundary)\b/i) ||
          (tc.category === "Negative" &&
            /\b(edge|regression|boundary|corner|race)\b/i.test(blob(tc))),
      );
    case "integration":
      return countWhere(testCases, (tc) => {
        const entities = new Set(tc.openmrsRelevant.entities ?? []);
        const hasFlow =
          entities.has("Patient") &&
          entities.has("Visit") &&
          entities.has("Encounter");
        const hasWorkflowTag = tagMatch(tc, /\b(integration|e2e|end-to-end)\b/i);
        const mentionsFlow =
          /\bpatient.*visit.*encounter\b/i.test(blob(tc)) ||
          /\bregistration.*visit.*encounter\b/i.test(blob(tc));
        return hasFlow || hasWorkflowTag || mentionsFlow;
      });
    default:
      return 0;
  }
}

function entityCounts(testCases: TestCase[]): Record<OpenMrsEntity, number> {
  const counts = Object.fromEntries(
    OPENMRS_ENTITIES.map((e) => [e, 0]),
  ) as Record<OpenMrsEntity, number>;

  for (const tc of testCases) {
    for (const entity of tc.openmrsRelevant.entities ?? []) {
      if (entity in counts) counts[entity as OpenMrsEntity] += 1;
    }
  }
  return counts;
}

function suiteSizeScore(count: number): number {
  const { min, max } = SUITE_SIZE_TARGET;
  if (count >= min && count <= max) return 1;
  if (count >= 8 && count < min) return 0.5 + (count - 8) / ((min - 8) * 2);
  if (count > max && count <= max + 6) return 0.85;
  if (count < 8) return Math.max(0.2, count / min);
  return 0.7;
}

function missingScenarioMessage(area: CoverageAreaResult): string {
  const need = area.minRequired - area.count;
  return `Add ${need} more ${area.label} case(s) (have ${area.count}, need ≥${area.minRequired}).`;
}

export { missingScenarioMessage };

export function analyzeCoverage(testCases: TestCase[]): {
  coverageScore: number;
  coverageBreakdown: CoverageAreaResult[];
  missingScenarios: string[];
  entityCoverage: Record<OpenMrsEntity, number>;
} {
  const coverageBreakdown: CoverageAreaResult[] = COVERAGE_AREAS.map((area) => {
    const count = detectAreaCount(area.id, testCases);
    return {
      id: area.id,
      label: area.label,
      covered: count >= area.minCases,
      count,
      minRequired: area.minCases,
      severity: area.severity,
    };
  });

  const entityCoverage = entityCounts(testCases);
  const coreEntitiesCovered = CORE_ENTITIES.filter(
    (e) => entityCoverage[e] > 0,
  ).length;

  const areaScore =
    coverageBreakdown.reduce((sum, area) => {
      const weight =
        area.severity === "critical" ? 3 : area.severity === "important" ? 2 : 1;
      const ratio = Math.min(1, area.count / area.minRequired);
      return sum + ratio * weight;
    }, 0) /
    coverageBreakdown.reduce(
      (sum, area) =>
        sum + (area.severity === "critical" ? 3 : area.severity === "important" ? 2 : 1),
      0,
    );

  const entityScore = coreEntitiesCovered / CORE_ENTITIES.length;
  const sizeScore = suiteSizeScore(testCases.length);

  const coverageScore = Math.round(
    (areaScore * 0.55 + entityScore * 0.3 + sizeScore * 0.15) * 100,
  );

  const missingScenarios: string[] = [];

  if (testCases.length < SUITE_SIZE_TARGET.min) {
    missingScenarios.push(
      `Expand suite to ${SUITE_SIZE_TARGET.min}–${SUITE_SIZE_TARGET.max} cases (currently ${testCases.length}).`,
    );
  }

  for (const area of coverageBreakdown.filter((a) => !a.covered)) {
    missingScenarios.push(missingScenarioMessage(area));
  }

  for (const entity of CORE_ENTITIES) {
    if (entityCoverage[entity] === 0) {
      missingScenarios.push(
        `No test case references OpenMRS entity "${entity}" — add scenarios touching ${entity}.`,
      );
    }
  }

  return {
    coverageScore,
    coverageBreakdown,
    missingScenarios,
    entityCoverage,
  };
}

/** Dashboard color coding: Green >85, Yellow 70–85, Red <70. */
export function coverageScoreTone(score: number): "green" | "yellow" | "red" {
  if (score > 85) return "green";
  if (score >= 70) return "yellow";
  return "red";
}
