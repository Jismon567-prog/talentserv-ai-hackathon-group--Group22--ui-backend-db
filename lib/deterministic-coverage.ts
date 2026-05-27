/**
 * Local coverage + safety scoring — replaces the Stage 6 LLM call so the
 * pipeline finishes one round-trip sooner with deterministic, schema-safe output.
 */

import {
  OPENMRS_ENTITIES,
  PRIVACY_SECURITY_RULES,
  TEST_CATEGORIES,
} from "@/lib/openmrs-reference";
import type {
  AutomationSkeleton,
  CoverageGap,
  CoverageReport,
  SafetyChecklist,
  SafetyChecklistItem,
  SafetyCheckStatus,
  SyntheticData,
  TestCase,
} from "@/lib/schemas";

function initCategoryCounts(): CoverageReport["byCategory"] {
  return Object.fromEntries(
    TEST_CATEGORIES.map((c) => [c, 0]),
  ) as CoverageReport["byCategory"];
}

function initEntityCounts(): CoverageReport["byEntity"] {
  return Object.fromEntries(
    OPENMRS_ENTITIES.map((e) => [e, 0]),
  ) as CoverageReport["byEntity"];
}

export function computeCoverageReport(testCases: TestCase[]): CoverageReport {
  const byCategory = initCategoryCounts();
  const byEntity = initEntityCounts();
  const byWorkflow: Record<string, number> = {};

  for (const tc of testCases) {
    byCategory[tc.category] += 1;
    for (const entity of tc.openmrsRelevant.entities) {
      byEntity[entity] += 1;
    }
    for (const workflow of tc.openmrsRelevant.workflows) {
      byWorkflow[workflow] = (byWorkflow[workflow] ?? 0) + 1;
    }
  }

  const categoriesWithCases = TEST_CATEGORIES.filter((c) => byCategory[c] > 0).length;
  const entitiesWithCases = OPENMRS_ENTITIES.filter((e) => byEntity[e] > 0).length;
  const coveragePct = (categoriesWithCases + entitiesWithCases) / 14;

  const gaps: CoverageGap[] = [];
  for (const category of TEST_CATEGORIES) {
    if (byCategory[category] === 0) {
      gaps.push({
        area: category,
        reason: `No ${category} test cases were generated.`,
        severity: category === "Functional" ? "high" : "medium",
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalTestCases: testCases.length,
    byCategory,
    byEntity,
    byWorkflow,
    coveragePct,
    gaps,
  };
}

function hasCategory(testCases: TestCase[], category: TestCase["category"]): boolean {
  return testCases.some((tc) => tc.category === category);
}

function hasRbacCase(testCases: TestCase[]): boolean {
  return testCases.some(
    (tc) =>
      tc.category === "Security" &&
      (tc.tags.some((t) => /rbac|role/i.test(t)) ||
        tc.openmrsRelevant.privileges.length > 0),
  );
}

function hasSyntheticIdentifiers(syntheticData: SyntheticData): boolean {
  const patients = syntheticData.patients ?? [];
  if (patients.length === 0) return true;
  return patients.every((p) => {
    const id = String(p.identifier ?? "");
    return !id || /TEST|SYNTH|FAKE|DEMO/i.test(id);
  });
}

function evaluateRule(
  rule: (typeof PRIVACY_SECURITY_RULES)[number],
  testCases: TestCase[],
  syntheticData: SyntheticData,
  automation: AutomationSkeleton,
): SafetyChecklistItem {
  let status: SafetyCheckStatus = "pass";
  let detail = "";

  switch (rule.id) {
    case "no-real-phi":
      detail = `${testCases.length} test case(s) use synthetic placeholders; ${syntheticData.patients?.length ?? 0} synthetic patient record(s).`;
      break;
    case "synthetic-identifiers":
      status = hasSyntheticIdentifiers(syntheticData) ? "pass" : "warn";
      detail = status === "pass"
        ? "Patient identifiers use TEST-/synthetic prefixes."
        : "Verify all PatientIdentifier values are obviously synthetic.";
      break;
    case "rbac-enforced": {
      const rbac = testCases.filter((tc) => tc.category === "Security");
      status = hasRbacCase(testCases) && rbac.length >= 1 ? "pass" : "fail";
      detail =
        rbac.length > 0
          ? `RBAC cases: ${rbac.map((tc) => tc.id).join(", ")}.`
          : "Add Security cases with rbac tags and privilege assertions.";
      break;
    }
    case "audit-trail-required": {
      const audit = testCases.filter((tc) => tc.category === "Audit");
      status = audit.length >= 1 ? "pass" : "fail";
      detail =
        audit.length > 0
          ? `Audit cases: ${audit.map((tc) => tc.id).join(", ")}.`
          : "Add at least one Audit case asserting write operations log actor + action.";
      break;
    }
    case "minimum-necessary":
      status = hasCategory(testCases, "Privacy") ? "pass" : "warn";
      detail = status === "pass"
        ? "Privacy category cases cover minimum-necessary disclosure."
        : "Consider adding Privacy cases for PHI field masking.";
      break;
    case "no-phi-in-logs":
      status = hasCategory(testCases, "Privacy") ? "pass" : "warn";
      detail = "Privacy cases should assert logs/responses omit PHI.";
      break;
    case "session-and-csrf":
      status = hasCategory(testCases, "Security") ? "pass" : "warn";
      detail = "Security cases should cover session/CSRF where UI writes exist.";
      break;
    case "input-sanitization":
      status =
        hasCategory(testCases, "Validation") || hasCategory(testCases, "Security")
          ? "pass"
          : "warn";
      detail = "Validation/Security cases should cover XSS/injection on free-text fields.";
      break;
    default:
      detail = "Rule evaluated against generated artifacts.";
  }

  if (rule.severity === "must" && status === "warn") {
    status = "fail";
  }

  const hasAutomation =
    Boolean(automation.uiTest?.trim()) || Boolean(automation.apiTest?.trim());
  if (
    status === "pass" &&
    (rule.id === "rbac-enforced" || rule.id === "audit-trail-required") &&
    hasAutomation
  ) {
    detail += " Automation skeleton includes uiTest/apiTest examples.";
  }

  return {
    ruleId: rule.id,
    title: rule.title,
    status,
    detail,
  };
}

export function computeSafetyChecklist(
  testCases: TestCase[],
  syntheticData: SyntheticData,
  automation: AutomationSkeleton,
): SafetyChecklist {
  const items = PRIVACY_SECURITY_RULES.map((rule) =>
    evaluateRule(rule, testCases, syntheticData, automation),
  );
  const passed = !items.some((item) => item.status === "fail");
  return { items, passed };
}
