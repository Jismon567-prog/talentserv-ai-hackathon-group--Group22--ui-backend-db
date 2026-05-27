/**
 * Generation history — persist and load agent runs from Supabase.
 */

import type { GenerationInsert, GenerationRow, Json } from "./database.types";
import { normalizeAgentOutput, normalizeAutomationPayload } from "./normalize";
import type {
  AgentOutput,
  CoverageReport,
  SafetyChecklist,
  SyntheticData,
  TestCase,
} from "./schemas";
import { validateTestCases } from "./validator";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";

/** Lightweight row for history lists in the dashboard. */
export interface GenerationSummary {
  id: string;
  requirement: string;
  model: string | null;
  testCaseCount: number;
  createdAt: string;
}

/** Full persisted record returned when loading a past generation. */
export interface GenerationRecord {
  id: string;
  userId: string;
  requirement: string;
  model: string | null;
  testCases: AgentOutput["testCases"];
  syntheticData: AgentOutput["syntheticData"];
  automationSkeleton: AgentOutput["automation"];
  coverage: AgentOutput["coverage"] | null;
  safety: AgentOutput["safety"] | null;
  createdAt: string;
}

function asTestCases(value: Json): TestCase[] {
  return Array.isArray(value) ? (value as TestCase[]) : [];
}

function asSyntheticData(value: Json): SyntheticData {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SyntheticData)
    : { patients: [], users: [], visits: [], encounters: [] };
}

function asAutomation(value: Json | unknown): AgentOutput["automation"] {
  return normalizeAutomationPayload(value);
}

function automationFromRow(row: Partial<GenerationRow> & Record<string, unknown>): unknown {
  return (
    row.automation_skeleton ??
    row.automation ??
    row.automationSkeleton ??
    {}
  );
}

function asCoverage(value: Json | null): CoverageReport | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CoverageReport)
    : null;
}

function asSafety(value: Json | null): SafetyChecklist | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SafetyChecklist)
    : null;
}

function rowToSummary(row: Partial<GenerationRow> & Pick<GenerationRow, "id" | "requirement" | "created_at">): GenerationSummary {
  return {
    id: row.id,
    requirement: row.requirement,
    model: row.model ?? null,
    testCaseCount: asTestCases(row.test_cases ?? []).length,
    createdAt: row.created_at,
  };
}

function rowToRecord(row: Partial<GenerationRow> & Pick<GenerationRow, "id" | "user_id" | "requirement" | "created_at">): GenerationRecord {
  const ext = row as Partial<GenerationRow> & Record<string, unknown>;
  return {
    id: row.id,
    userId: row.user_id,
    requirement: row.requirement,
    model: row.model ?? null,
    testCases: asTestCases(row.test_cases ?? []),
    syntheticData: asSyntheticData(row.synthetic_data ?? {}),
    automationSkeleton: asAutomation(automationFromRow(ext)),
    coverage: asCoverage(row.coverage ?? null),
    safety: asSafety(row.safety ?? null),
    createdAt: row.created_at,
  };
}

/** Reconstruct an `AgentOutput` suitable for the dashboard result tabs. */
export function generationRecordToAgentOutput(
  record: GenerationRecord,
  agentVersion = "0.1.0",
): AgentOutput {
  return normalizeAgentOutput({
    meta: {
      runId: record.id,
      agentVersion,
      generatedAt: record.createdAt,
      requirementText: record.requirement,
      model: record.model ?? undefined,
    },
    stages: [],
    testCases: record.testCases,
    testCaseValidation: validateTestCases(record.testCases),
    syntheticData: record.syntheticData,
    automation: record.automationSkeleton,
    coverage: record.coverage ?? {
      generatedAt: record.createdAt,
      totalTestCases: record.testCases.length,
      byCategory: {
        Functional: 0,
        Negative: 0,
        Validation: 0,
        Security: 0,
        Privacy: 0,
        Audit: 0,
      },
      byEntity: {
        Patient: 0,
        PatientIdentifier: 0,
        Visit: 0,
        Encounter: 0,
        Obs: 0,
        User: 0,
        Role: 0,
        Privilege: 0,
      },
      byWorkflow: {},
      coveragePct: 0,
      gaps: [],
    },
    safety: record.safety ?? {
      passed: true,
      items: [],
    },
  });
}

/** Columns guaranteed on the earliest `generations` table shape. */
const LIST_SELECT =
  "id, user_id, requirement, test_cases, synthetic_data, automation_skeleton, created_at";

/** Optional columns added in migration 002 — queried separately when present. */
const OPTIONAL_SELECT = "model, coverage, safety";

function isMissingColumnError(message: string, column: string): boolean {
  return (
    message.includes(`column generations.${column} does not exist`) ||
    message.includes(`column "${column}" does not exist`)
  );
}

function formatHistorySaveError(message: string): string {
  if (/row-level security policy/i.test(message)) {
    return (
      `${message} — Run supabase/migrations/003_disable_rls.sql in the Supabase SQL Editor, ` +
      "and verify SUPABASE_SERVICE_ROLE_KEY is the service_role secret (not the anon key)."
    );
  }
  return message;
}

/** Persist a successful agent run. Returns the new row id, or null if Supabase is off. */
export async function saveGeneration(
  userId: string,
  output: AgentOutput,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const automation = normalizeAutomationPayload(output.automation);

  const baseInsert = {
    user_id: userId,
    requirement: output.meta.requirementText,
    test_cases: output.testCases as unknown as Json,
    synthetic_data: output.syntheticData as unknown as Json,
    automation_skeleton: automation as unknown as Json,
  };

  const fullInsert: GenerationInsert = {
    ...baseInsert,
    model: output.meta.model ?? null,
    coverage: output.coverage as unknown as Json,
    safety: output.safety as unknown as Json,
  };

  const supabase = getSupabaseAdmin();

  let result = await supabase
    .from("generations")
    .insert(fullInsert)
    .select("id")
    .single();

  if (
    result.error &&
    (isMissingColumnError(result.error.message, "model") ||
      isMissingColumnError(result.error.message, "coverage") ||
      isMissingColumnError(result.error.message, "safety"))
  ) {
    result = await supabase
      .from("generations")
      .insert(baseInsert)
      .select("id")
      .single();
  }

  if (result.error) {
    throw new Error(
      `Failed to save generation history: ${formatHistorySaveError(result.error.message)}`,
    );
  }

  return result.data.id;
}

/** List recent generations for a Clerk user (newest first). */
export async function listGenerations(
  userId: string,
  limit = 50,
): Promise<GenerationSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseAdmin();

  const fullQuery = await supabase
    .from("generations")
    .select(`${LIST_SELECT}, ${OPTIONAL_SELECT}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  let data: unknown[] | null = fullQuery.data;
  let loadError = fullQuery.error;

  // Older tables may lack model / coverage / safety — fall back to base columns.
  if (
    loadError &&
    (isMissingColumnError(loadError.message, "model") ||
      isMissingColumnError(loadError.message, "coverage") ||
      isMissingColumnError(loadError.message, "safety"))
  ) {
    const baseQuery = await supabase
      .from("generations")
      .select(LIST_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    data = baseQuery.data;
    loadError = baseQuery.error;
  }

  if (loadError) {
    throw new Error(`Failed to load generation history: ${loadError.message}`);
  }

  return (data ?? []).map((row) =>
    rowToSummary(row as unknown as GenerationRow),
  );
}

/** Load one generation by id, scoped to the owning Clerk user. */
export async function getGenerationById(
  userId: string,
  id: string,
): Promise<GenerationRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load generation: ${error.message}`);
  }

  if (!data) return null;
  return rowToRecord(data as unknown as GenerationRow);
}
