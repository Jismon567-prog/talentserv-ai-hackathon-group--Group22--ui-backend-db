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
  OPENMRS_ENTITIES,
  TEST_CATEGORIES,
} from "./openmrs-reference";
import type { AgentOutput, AutomationSkeleton } from "./schemas";

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

/** Ensure `AgentOutput.automation` is present and flattened after cache/history loads. */
export function normalizeAgentOutput(output: AgentOutput): AgentOutput {
  return {
    ...output,
    automation: normalizeAutomationPayload(output.automation),
  };
}
