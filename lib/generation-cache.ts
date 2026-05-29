import type { AgentOutput } from "./schemas";
import { normalizeAgentOutput } from "./normalize";

// ---------------------------------------------------------------------------
// Current generation — localStorage session cache (per Clerk user)
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "openmrs-agent:current-generation:";

/** Serializable snapshot of a successful API response + workspace context. */
export interface CachedGenerationResult {
  ok: true;
  data: AgentOutput;
  stageTrace: {
    id: string;
    name: string;
    status: string;
    durationMs?: number;
    message?: string;
  }[];
  validation: { passed: boolean; issues: unknown[] };
  warnings: { droppedTestCases: { index: number; reason: string }[] };
  historyId: string | null;
}

export interface CurrentGenerationCache {
  userId: string;
  requirement: string;
  model: string;
  savedAt: string;
  result: CachedGenerationResult;
  stageStatuses?: Record<string, string>;
  stageDurations?: Record<string, number | undefined>;
}

export interface SaveCurrentGenerationInput {
  requirement: string;
  model: string;
  result: CachedGenerationResult;
  stageStatuses?: Record<string, string>;
  stageDurations?: Record<string, number | undefined>;
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Minimal sanity check so corrupt localStorage does not crash the dashboard. */
function isValidCache(value: unknown, userId: string): value is CurrentGenerationCache {
  if (!value || typeof value !== "object") return false;
  const v = value as CurrentGenerationCache;
  return (
    v.userId === userId &&
    typeof v.requirement === "string" &&
    typeof v.model === "string" &&
    v.result?.ok === true &&
    v.result.data != null &&
    Array.isArray(v.result.data.testCases)
  );
}

/**
 * Persist the active generation for the signed-in user.
 * Survives page refresh; scoped per Clerk userId.
 */
export function saveCurrentGeneration(
  userId: string,
  input: SaveCurrentGenerationInput,
): void {
  if (!isBrowser() || !userId) return;

  const payload: CurrentGenerationCache = {
    userId,
    requirement: input.requirement,
    model: input.model,
    savedAt: new Date().toISOString(),
    result: {
      ...input.result,
      data: normalizeAgentOutput(input.result.data),
    },
    stageStatuses: input.stageStatuses,
    stageDurations: input.stageDurations,
  };

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch (err) {
    console.warn("[saveCurrentGeneration] localStorage write failed:", err);
  }
}

/** Restore the last active generation for this user, or null if none / invalid. */
export function loadCurrentGeneration(
  userId: string,
): CurrentGenerationCache | null {
  if (!isBrowser() || !userId) return null;

  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidCache(parsed, userId)) {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    return {
      ...parsed,
      result: {
        ...parsed.result,
        data: normalizeAgentOutput(parsed.result.data),
      },
    };
  } catch {
    try {
      localStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Remove the session cache for this user (Clear Current Result). */
export function clearCurrentGeneration(userId: string): void {
  if (!isBrowser() || !userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}
