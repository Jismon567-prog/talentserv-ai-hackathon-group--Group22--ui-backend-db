/**
 * LLM-output normalizers
 * ----------------------
 * Tiny, defensive coercions applied to LLM-stage payloads BEFORE Zod
 * validation. Each helper is intentionally narrow: it patches up the
 * specific shape slips we have seen in practice and leaves everything else
 * untouched.
 *
 * Stage 4 (`normalizeSyntheticDataPayload`):
 *   - Ensures the four synthetic-data collections are arrays.
 *   - Forces every patient to carry `synthetic: true` — our hard safety
 *     guarantee that no real PHI ever transits the pipeline.
 *
 * Stage 6 (`normalizeCoveragePayload`):
 *   - Pads `coverage.byCategory` / `coverage.byEntity` with zeroes for any
 *     enum keys the LLM omitted. Zod v4's `z.record(enumKey, value)` is
 *     exhaustive — it requires every enum literal as a key — and the LLM
 *     reasonably elides zero-count buckets. Padding here preserves the
 *     downstream "all keys present" invariant while not failing the run.
 */

import {
  COMMON_ROLES,
  OPENMRS_ENTITIES,
  PRIVILEGES,
  TEST_CATEGORIES,
  TEST_PRIORITIES,
} from "./openmrs-reference";
import type {
  AgentOutput,
  AutomationSkeleton,
  TestCaseValidationReport,
} from "./schemas";
import { validateTestCases } from "./validator";

const TC_ID_PATTERN = /^TC-[A-Z0-9]+-\d{3,}$/;

type OpenMrsEntity = (typeof OPENMRS_ENTITIES)[number];
type CommonRole = (typeof COMMON_ROLES)[number];
type Privilege = (typeof PRIVILEGES)[number];

const ENTITY_ALIASES: Record<string, OpenMrsEntity> = {
  patient: "Patient",
  patients: "Patient",
  person: "Patient",
  persons: "Patient",
  demographics: "Patient",
  "patient identifier": "PatientIdentifier",
  patientidentifier: "PatientIdentifier",
  identifier: "PatientIdentifier",
  identifiers: "PatientIdentifier",
  "patient id": "PatientIdentifier",
  visit: "Visit",
  visits: "Visit",
  encounter: "Encounter",
  encounters: "Encounter",
  obs: "Obs",
  observation: "Obs",
  observations: "Obs",
  concept: "Obs",
  user: "User",
  users: "User",
  provider: "User",
  role: "Role",
  roles: "Role",
  privilege: "Privilege",
  privileges: "Privilege",
  rbac: "Role",
};

const CATEGORY_ALIASES: Record<string, (typeof TEST_CATEGORIES)[number]> = {
  functional: "Functional",
  negative: "Negative",
  validation: "Validation",
  security: "Security",
  privacy: "Privacy",
  audit: "Audit",
  "role-based": "Security",
  rbac: "Security",
};

const PRIORITY_ALIASES: Record<string, (typeof TEST_PRIORITIES)[number]> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function matchEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  aliases: Record<string, T> = {},
): T | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  const direct = allowed.find((item) => item === value);
  if (direct) return direct;
  const ci = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  if (ci) return ci;
  return aliases[value.toLowerCase()];
}

function splitTokens(value: string): string[] {
  return value
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function entityToken(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of ["entity", "name", "type", "object", "value", "id"]) {
      if (typeof obj[key] === "string") return obj[key].trim();
    }
    return Object.keys(obj).join(", ");
  }
  return String(raw).trim();
}

function flattenRawList(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    return splitTokens(raw);
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (typeof item === "string" && /[,;|]/.test(item)) return splitTokens(item);
      return [item];
    });
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const values = Object.values(obj);
    if (values.every((v) => typeof v === "boolean")) {
      return Object.entries(obj)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
    }
    return [raw];
  }
  return [raw];
}

function normalizeEntityValue(raw: unknown): OpenMrsEntity | undefined {
  for (const token of flattenRawList(raw)) {
    const value = entityToken(token);
    if (!value) continue;

    const direct = OPENMRS_ENTITIES.find(
      (entity) => entity.toLowerCase() === value.toLowerCase(),
    );
    if (direct) return direct;

    const aliasKey = value.toLowerCase().replace(/\s+/g, " ");
    if (ENTITY_ALIASES[aliasKey]) return ENTITY_ALIASES[aliasKey];

    const partial = OPENMRS_ENTITIES.find((entity) =>
      aliasKey.includes(entity.toLowerCase()),
    );
    if (partial) return partial;
  }
  return undefined;
}

function normalizeEntityList(raw: unknown): OpenMrsEntity[] {
  const items = flattenRawList(raw);
  const out: OpenMrsEntity[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const entity = normalizeEntityValue(item);
    if (entity && !seen.has(entity)) {
      seen.add(entity);
      out.push(entity);
    }
  }

  return out.length > 0 ? out : ["Patient"];
}

function normalizeRoleList(raw: unknown): CommonRole[] {
  const out: CommonRole[] = [];
  const seen = new Set<string>();

  for (const token of flattenRawList(raw)) {
    const value = entityToken(token);
    if (!value) continue;
    const role =
      COMMON_ROLES.find((known) => known.toLowerCase() === value.toLowerCase()) ??
      COMMON_ROLES.find((known) => value.toLowerCase().includes(known.toLowerCase()));
    if (role && !seen.has(role)) {
      seen.add(role);
      out.push(role);
    }
  }

  return out;
}

function normalizePrivilegeList(raw: unknown): Privilege[] {
  const out: Privilege[] = [];
  const seen = new Set<string>();

  for (const token of flattenRawList(raw)) {
    const value = entityToken(token);
    if (!value) continue;
    const privilege =
      PRIVILEGES.find((known) => known.toLowerCase() === value.toLowerCase()) ??
      PRIVILEGES.find((known) => value.toLowerCase().includes(known.toLowerCase()));
    if (privilege && !seen.has(privilege)) {
      seen.add(privilege);
      out.push(privilege);
    }
  }

  return out;
}

function readOpenMrsRelevance(item: Record<string, unknown>): Record<string, unknown> {
  const candidates = [
    item.openmrsRelevant,
    item.openMRSRelevant,
    item.openmrs_relevant,
    item.relevant,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return asObj(candidate);
    }
  }
  return {};
}

/** Coerce common LLM id slips into `TC-AREA-001` before strict Zod validation. */
export function normalizeTestCaseId(raw: unknown, fallbackIndex: number): string {
  let id = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

  const tcMatch = id.match(/^TC-([A-Z0-9]+)-(\d+)$/);
  if (tcMatch) {
    const [, area, seq] = tcMatch;
    return `TC-${area}-${seq.padStart(3, "0")}`;
  }

  const shortMatch = id.match(/^([A-Z0-9]+)-(\d+)$/);
  if (shortMatch) {
    const [, area, seq] = shortMatch;
    return `TC-${area}-${seq.padStart(3, "0")}`;
  }

  const digitsOnly = id.match(/^(\d+)$/);
  if (digitsOnly) {
    return `TC-GEN-${digitsOnly[1].padStart(3, "0")}`;
  }

  if (TC_ID_PATTERN.test(id)) return id;
  return `TC-GEN-${String(fallbackIndex + 1).padStart(3, "0")}`;
}

function normalizeTestCaseItem(raw: unknown, index: number): Record<string, unknown> {
  const item = asObj(raw);
  const relevance = readOpenMrsRelevance(item);

  const steps = ensureArray<unknown>(item.steps)
    .map((stepRaw, stepIndex) => {
      const step = asObj(stepRaw);
      const stepNum =
        typeof step.step === "number"
          ? step.step
          : Number.parseInt(String(step.step ?? stepIndex + 1), 10) || stepIndex + 1;
      const action = String(step.action ?? step.description ?? "").trim();
      const expected = String(step.expected ?? step.expectedResult ?? "").trim();
      if (!action || !expected) return null;
      return {
        ...step,
        step: stepNum,
        action,
        expected,
      };
    })
    .filter((step): step is { step: number; action: string; expected: string } =>
      step != null,
    );

  const normalizedSteps =
    steps.length > 0
      ? steps
      : [
          {
            step: 1,
            action: "Execute the scenario under test in OpenMRS.",
            expected: "The system behaves as described in the expected result.",
          },
        ];

  const scenario =
    String(item.scenario ?? item.title ?? item.name ?? "").trim() ||
    `Verify OpenMRS workflow for test case ${index + 1}`;

  return {
    ...item,
    id: normalizeTestCaseId(item.id, index),
    scenario,
    category:
      matchEnum(item.category, TEST_CATEGORIES, CATEGORY_ALIASES) ?? "Functional",
    priority:
      matchEnum(item.priority, TEST_PRIORITIES, PRIORITY_ALIASES) ?? "Medium",
    preconditions: ensureArray<unknown>(item.preconditions).map((p) =>
      String(p ?? "").trim(),
    ),
    steps: normalizedSteps,
    expectedResult:
      String(item.expectedResult ?? item.expected ?? scenario).trim() ||
      "Expected outcome is observed.",
    openmrsRelevant: {
      entities: normalizeEntityList(relevance.entities),
      roles: normalizeRoleList(relevance.roles),
      workflows: flattenRawList(relevance.workflows).map((w) => entityToken(w)),
      privileges: normalizePrivilegeList(relevance.privileges),
    },
    tags: ensureArray<unknown>(item.tags).map((tag) => String(tag ?? "").trim()),
    traceabilityRef:
      item.traceabilityRef != null
        ? String(item.traceabilityRef).trim()
        : undefined,
  };
}

/**
 * Normalize Stage 3 `{ testCases: [...] }` items before `TestCaseSchema` validation.
 * Fixes common LLM slips: short ids (`TC-REG-1`), casing, enum aliases, step numbers.
 */
export function normalizeTestCasesPayload(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const root = asObj(raw);
  const cases = "testCases" in root ? root.testCases : raw;
  const seenIds = new Set<string>();

  return ensureArray<unknown>(cases).map((item, index) => {
    const normalized = normalizeTestCaseItem(item, index);
    let id = String(normalized.id);
    while (seenIds.has(id)) {
      const next = index + seenIds.size + 1;
      id = normalizeTestCaseId(`TC-GEN-${next}`, next - 1);
      normalized.id = id;
    }
    seenIds.add(id);
    return normalized;
  });
}

/** Wrap a single value in an array; pass arrays through; null/undefined → []. */
const ensureArray = <T,>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

/** Narrow `unknown` to a record-like object, defaulting to `{}`. */
const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * Normalize the Stage 4 payload before strict `SyntheticDataSchema.parse`.
 * Accepts the wrapper `{ syntheticData: { ... } }` and returns the same
 * shape with the four collections array-ified and patients flagged synthetic.
 */
export function normalizeSyntheticDataPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !("syntheticData" in raw)) return raw;
  const inner = asObj((raw as Record<string, unknown>).syntheticData);

  return {
    syntheticData: {
      ...inner,
      patients: ensureArray<unknown>(inner.patients).map((p) => ({
        ...asObj(p),
        // Safety floor: every patient row is explicitly synthetic.
        synthetic: true,
      })),
      users: ensureArray<unknown>(inner.users),
      visits: ensureArray<unknown>(inner.visits),
      encounters: ensureArray<unknown>(inner.encounters),
    },
  };
}

/**
 * Pad an enum-keyed counts record so every enum literal is present. Existing
 * numeric values are preserved; missing keys are inserted as `0`. Non-numeric
 * values are coerced via `Number(...) || 0` so a stray `"3"` from the LLM
 * survives instead of failing strict validation.
 */
function padCountsByEnum(
  raw: unknown,
  keys: readonly string[],
): Record<string, number> {
  const src = asObj(raw);
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = src[k];
    out[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  // Preserve any extra keys the LLM emitted (e.g. a custom test category)
  // so the data isn't silently dropped before downstream use.
  for (const [k, v] of Object.entries(src)) {
    if (!(k in out)) out[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  return out;
}

/**
 * Normalize the Stage 6 payload before strict `Stage6OutputSchema.parse`.
 *
 * Accepts the wrapper `{ coverage, safety }` and pads
 * `coverage.byCategory` / `coverage.byEntity` so every TEST_CATEGORIES /
 * OPENMRS_ENTITIES literal is present with at least `0`. Also ensures
 * `coverage.byWorkflow` is at minimum an object so the strict schema
 * doesn't reject a missing key. The `safety` half is passed through
 * unchanged.
 */
export function normalizeCoveragePayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const root = asObj(raw);
  const coverage = asObj(root.coverage);

  return {
    ...root,
    coverage: {
      ...coverage,
      byCategory: padCountsByEnum(coverage.byCategory, TEST_CATEGORIES),
      byEntity: padCountsByEnum(coverage.byEntity, OPENMRS_ENTITIES),
      byWorkflow: asObj(coverage.byWorkflow),
    },
  };
}

/** Coerce unknown values to a trimmed string (for code blobs). */
function coerceString(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

/** Parse jsonb that occasionally arrives double-encoded as a string. */
function parseJsonMaybe(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  return value;
}

/**
 * Normalize automation skeleton payloads from DB, localStorage, or legacy
 * shapes into `{ uiTest, apiTest, notes? }`.
 *
 * Handles common slips:
 *   - Stage-5 wrapper: `{ automation: { uiTest, apiTest } }`
 *   - Legacy keys: `automationSkeleton`, `automation_skeleton`
 *   - snake_case: `ui_test`, `api_test`
 *   - jsonb returned as a JSON string
 */
export function normalizeAutomationPayload(raw: unknown): AutomationSkeleton {
  const empty: AutomationSkeleton = { uiTest: "", apiTest: "" };
  const parsed = parseJsonMaybe(raw);
  if (parsed == null) return empty;
  if (typeof parsed === "string") {
    // Raw code string with no structure — treat as uiTest for display.
    return parsed.trim() ? { uiTest: parsed, apiTest: "" } : empty;
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) return empty;

  const root = asObj(parsed);
  let inner = root;

  if (root.automation != null) {
    inner = asObj(parseJsonMaybe(root.automation));
  } else if (root.automationSkeleton != null) {
    inner = asObj(parseJsonMaybe(root.automationSkeleton));
  } else if (root.automation_skeleton != null) {
    inner = asObj(parseJsonMaybe(root.automation_skeleton));
  }

  const uiTest = coerceString(
    inner.uiTest ?? inner.ui_test ?? inner.UITest ?? inner.ui,
  );
  const apiTest = coerceString(
    inner.apiTest ?? inner.api_test ?? inner.APITest ?? inner.api,
  );
  const notes =
    typeof inner.notes === "string" && inner.notes.trim()
      ? inner.notes
      : undefined;

  if (!uiTest.trim() && !apiTest.trim()) return empty;
  return notes ? { uiTest, apiTest, notes } : { uiTest, apiTest };
}

/** Ensure validation report exists; recompute when missing or stale (cache/history). */
export function ensureTestCaseValidation(
  output: Pick<AgentOutput, "testCases" | "testCaseValidation">,
): TestCaseValidationReport {
  const existing = output.testCaseValidation;
  if (
    existing?.checks?.length &&
    typeof existing.coverageScore === "number" &&
    existing.coverageBreakdown?.length
  ) {
    return existing;
  }
  return validateTestCases(output.testCases);
}

/** Ensure AgentOutput is complete after cache/history loads. */
export function normalizeAgentOutput(output: AgentOutput): AgentOutput {
  const normalized = {
    ...output,
    automation: normalizeAutomationPayload(output.automation),
  };
  return {
    ...normalized,
    testCaseValidation: ensureTestCaseValidation(normalized),
  };
}
