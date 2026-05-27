/**
 * POST /api/agent/generate
 * ------------------------
 * Orchestrates the six-stage OpenMRS AI Healthcare Test-Automation Agent.
 *
 * Pipeline (each stage is one OpenAI chat-completion call):
 *
 *   1. Requirement Analyzer
 *   2. Risk & Privacy Planner
 *   3. Functional & Security Test Case Generator
 *   4. Synthetic Test Data Generator  ─┐
 *   5. Automation Skeleton Writer       ├─ run in parallel after Stage 3
 *   6. Coverage & Safety Reviewer       └─ computed locally (no LLM call)
 *
 * Inputs:    { requirement: string, requirementId?: string, model?: string }
 * Outputs:   { ok: true,  data: AgentOutput,  stageTrace: StageTraceEntry[], validation: ... }
 *            { ok: false, error: { stage?, code, message, details? }, stageTrace }
 *
 * Notes:
 * - Supports OpenAI (paid) and Groq (free tier) via the OpenAI SDK.
 * - Model is selected by the client (default: gpt-4o-mini).
 * - We also defensively parse out a JSON object in case the model wraps output
 *   in a fenced block.
 * - We auto-correct deterministic fields (coverage.totalTestCases,
 *   safety.passed) before final Zod validation so a small model slip does
 *   not invalidate an otherwise good run.
 * - Clerk auth is required by default — the dashboard is the caller. To
 *   bypass for unauthenticated probing, see `requireAuth` below.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  normalizeSyntheticDataPayload,
} from "@/lib/normalize";
import {
  computeCoverageReport,
  computeSafetyChecklist,
} from "@/lib/deterministic-coverage";
import { saveGeneration } from "@/lib/history";
import {
  ALLOWED_LLM_MODEL_IDS,
  DEFAULT_LLM_MODEL,
  type LlmModelId,
} from "@/lib/llm-models";
import { resolveLlm } from "@/lib/llm-client";
import {
  PROMPT_STAGE_TO_PIPELINE,
  STAGE_PROMPTS,
  buildStageMessages,
  type PromptStageId,
  type StageInputMap,
} from "@/lib/prompts";
import {
  AgentOutputSchema,
  AutomationSkeletonSchema,
  SyntheticDataSchema,
  TestCaseSchema,
  type AgentOutput,
  type AutomationSkeleton,
  type PipelineStageName,
  type SyntheticData,
  type TestCase,
} from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Next.js route configuration
// ---------------------------------------------------------------------------

// The OpenAI SDK + Node crypto needs the Node runtime.
export const runtime = "nodejs";

// Five LLM calls (stages 4+5 run in parallel; stage 6 is computed locally).
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// LLM configuration
// ---------------------------------------------------------------------------

const AGENT_VERSION = "0.1.0";

/**
 * Per-call timeout. gpt-4o / gpt-4o-mini usually reply in 5-30s; Stage 3/4/5
 * return larger JSON payloads so we allow up to 90s per stage.
 */
const PER_CALL_TIMEOUT_MS = 90_000;

/** Low temperature for deterministic, audit-friendly test generation. */
const TEMPERATURE = 0.2;

/** Cap output tokens per stage — shorter responses finish sooner. */
const STAGE_MAX_TOKENS: Record<PromptStageId, number> = {
  "requirement-analyzer": 2048,
  "risk-and-privacy-planner": 2048,
  "test-case-generator": 8192,
  "synthetic-data-generator": 3072,
  "automation-skeleton-writer": 3072,
  "coverage-and-safety-reviewer": 2048,
};

/** Flip to `false` to allow unauthenticated calls during local probing. */
const requireAuth = true;

// ---------------------------------------------------------------------------
// Request / response contracts
// ---------------------------------------------------------------------------

const RequestBodySchema = z.object({
  requirement: z
    .string()
    .trim()
    .min(20, "Requirement must be at least 20 characters long.")
    .max(8000, "Requirement is too long (max 8000 characters)."),
  requirementId: z.string().trim().max(120).optional(),
  model: z.enum(ALLOWED_LLM_MODEL_IDS).optional().default(DEFAULT_LLM_MODEL),
});

type StageStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

interface StageTraceEntry {
  id: PromptStageId;
  name: string;
  pipelineStage: PipelineStageName;
  status: StageStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  message?: string;
  /** Truncated raw output preview, useful for debugging in the UI. */
  outputPreview?: string;
}

interface SuccessBody {
  ok: true;
  data: AgentOutput;
  stageTrace: StageTraceEntry[];
  validation: {
    passed: boolean;
    issues: z.core.$ZodIssue[];
  };
  /** Items that the LLM produced but that failed individual validation. */
  warnings: {
    droppedTestCases: { index: number; reason: string }[];
  };
  /** Supabase row id when history save succeeded; null if storage is off or save failed. */
  historyId: string | null;
}

interface ErrorBody {
  ok: false;
  error: {
    stage?: PromptStageId;
    code: string;
    message: string;
    details?: unknown;
  };
  stageTrace: StageTraceEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull the first JSON object out of an LLM response, tolerating optional
 * markdown fences. We *prefer* the model's JSON-mode output, but real-world
 * LLMs occasionally wrap their JSON, so we strip fences defensively.
 */
function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("LLM response did not contain a JSON object.");
  }
  return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
}

function preview(value: string, max = 400): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Validate each element of an array independently. Returns the valid items
 * plus a per-item drop report. Used to gracefully handle the occasional
 * malformed item an LLM produces in a long list (single-item slip should
 * not invalidate an otherwise good run).
 */
function parseAndFilter<T>(
  items: unknown[],
  schema: z.ZodType<T>,
): { valid: T[]; dropped: { index: number; reason: string }[] } {
  const valid: T[] = [];
  const dropped: { index: number; reason: string }[] = [];
  for (const [index, item] of items.entries()) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      dropped.push({
        index,
        reason: result.error.issues
          .map((iss) => `${iss.path.join(".") || "(root)"}: ${iss.message}`)
          .join("; "),
      });
    }
  }
  return { valid, dropped };
}

/**
 * Retry a stage on OpenAI 429 (rate limit) responses. Respects the
 * "try again in Xs" hint when present; otherwise uses exponential backoff.
 */
async function runStageWithRetry<K extends PromptStageId>(
  client: OpenAI,
  apiModel: string,
  id: K,
  input: StageInputMap[K],
  maxAttempts = 3,
): Promise<{ data: unknown; trace: StageTraceEntry }> {
  let last: { data: unknown; trace: StageTraceEntry } | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runStage(client, apiModel, id, input);
    if (result.trace.status === "succeeded") return result;

    const msg = result.trace.message ?? "";
    const isRateLimit = /\b429\b|rate.?limit/i.test(msg);
    if (!isRateLimit || attempt === maxAttempts) return result;

    const hint = /try again in\s+([\d.]+)\s*s/i.exec(msg);
    const waitMs = hint
      ? Math.ceil(parseFloat(hint[1]) * 1000) + 1500
      : Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    last = result;
    await sleep(waitMs);
  }
  return last!;
}

// ---------------------------------------------------------------------------
// Stage runner
// ---------------------------------------------------------------------------

/**
 * Run a single pipeline stage end-to-end:
 *   1. Build the system + user messages from `lib/prompts.ts`.
 *   2. Call OpenAI in JSON mode.
 *   3. Parse the response, returning the parsed JSON + a trace entry.
 *
 * Caller is responsible for narrowing the returned `unknown` payload via the
 * appropriate Zod schema (see the orchestrator below).
 */
async function runStage<K extends PromptStageId>(
  client: OpenAI,
  apiModel: string,
  id: K,
  input: StageInputMap[K],
): Promise<{ data: unknown; trace: StageTraceEntry }> {
  const stage = STAGE_PROMPTS[id];
  const pipelineStage = PROMPT_STAGE_TO_PIPELINE[id];

  const startedAt = new Date();
  const trace: StageTraceEntry = {
    id,
    name: stage.name,
    pipelineStage,
    status: "running",
    startedAt: startedAt.toISOString(),
  };

  try {
    const { system, user } = buildStageMessages(id, input);

    const completion = await client.chat.completions.create({
      model: apiModel,
      temperature: TEMPERATURE,
      max_tokens: STAGE_MAX_TOKENS[id],
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      throw new Error("LLM returned an empty response.");
    }

    const parsed = extractJsonObject(raw);

    const finishedAt = new Date();
    return {
      data: parsed,
      trace: {
        ...trace,
        status: "succeeded",
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        outputPreview: preview(raw),
        message: `Completed in ${finishedAt.getTime() - startedAt.getTime()} ms`,
      },
    };
  } catch (err) {
    const finishedAt = new Date();
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      trace: {
        ...trace,
        status: "failed",
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message,
      },
    };
  }
}

/**
 * Build the `PipelineStage[]` slice of the AgentOutput from our richer trace.
 * The schema's `PipelineStage` is coarser (5 stages); we collapse stages 1+2.
 */
function tracesToPipelineStages(
  traces: StageTraceEntry[],
): AgentOutput["stages"] {
  const byPipeline = new Map<PipelineStageName, StageTraceEntry[]>();
  for (const t of traces) {
    const bucket = byPipeline.get(t.pipelineStage) ?? [];
    bucket.push(t);
    byPipeline.set(t.pipelineStage, bucket);
  }

  return Array.from(byPipeline.entries()).map(([name, bucket]) => {
    const firstStart = bucket
      .map((b) => b.startedAt)
      .sort()[0];
    const lastFinish = bucket
      .map((b) => b.finishedAt)
      .filter((s): s is string => Boolean(s))
      .sort()
      .pop();
    const status = bucket.some((b) => b.status === "failed")
      ? ("failed" as const)
      : bucket.every((b) => b.status === "succeeded")
        ? ("succeeded" as const)
        : ("running" as const);

    return {
      name,
      status,
      startedAt: firstStart,
      finishedAt: lastFinish,
      message: bucket.map((b) => `${b.id}: ${b.status}`).join("; "),
    };
  });
}

// ---------------------------------------------------------------------------
// Per-stage output wrappers (the model wraps each stage's payload)
// ---------------------------------------------------------------------------

/**
 * We accept any array at the outer level and validate each test case
 * individually below. LLMs occasionally emit one malformed item in a long
 * list (empty `steps`, wrong type on `entities`, etc.); dropping the bad
 * item and continuing is much friendlier than failing the whole pipeline.
 */
const Stage3OutputSchema = z.object({
  testCases: z.array(z.unknown()).min(1),
});
const Stage4OutputSchema = z.object({
  syntheticData: SyntheticDataSchema,
});
const Stage5OutputSchema = z.object({
  automation: AutomationSkeletonSchema,
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  const stageTrace: StageTraceEntry[] = [];

  // ---- Auth ------------------------------------------------------------
  let userId: string | null = null;
  if (requireAuth) {
    const session = await auth();
    userId = session.userId;
    if (!userId) {
      return NextResponse.json<ErrorBody>(
        {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "You must be signed in to call the agent.",
          },
          stageTrace,
        },
        { status: 401 },
      );
    }
  }

  // ---- Body validation -------------------------------------------------
  let body: z.infer<typeof RequestBodySchema>;
  try {
    const json = await req.json();
    body = RequestBodySchema.parse(json);
  } catch (err) {
    return NextResponse.json<ErrorBody>(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message:
            err instanceof z.ZodError
              ? "Request body failed validation."
              : "Request body must be valid JSON: { requirement: string }.",
          details: err instanceof z.ZodError ? err.issues : String(err),
        },
        stageTrace,
      },
      { status: 400 },
    );
  }

  // ---- LLM client (OpenAI or Groq based on selected model) ------------
  const model = body.model as LlmModelId;
  let client: OpenAI;
  let apiModel: string;
  try {
    const resolved = resolveLlm(model, PER_CALL_TIMEOUT_MS);
    client = resolved.client;
    apiModel = resolved.apiModel;
  } catch (err) {
    return NextResponse.json<ErrorBody>(
      {
        ok: false,
        error: {
          code: "CONFIG_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to initialize the LLM client.",
        },
        stageTrace,
      },
      { status: 500 },
    );
  }

  // ---- Pipeline --------------------------------------------------------
  //
  // Each stage's failure short-circuits the pipeline with a structured error
  // that includes which stage failed and the partial trace, so the UI can
  // render an honest "stage 3 failed" timeline.

  // Stage 1 — Requirement Analyzer
  const stage1 = await runStageWithRetry(client, apiModel, "requirement-analyzer", {
    requirementText: body.requirement,
    requirementId: body.requirementId,
  });
  stageTrace.push(stage1.trace);
  if (stage1.trace.status !== "succeeded") {
    return errorResponse("requirement-analyzer", stage1.trace, stageTrace, 502);
  }
  const analysis = stage1.data;

  // Stage 2 — Risk & Privacy Planner
  const stage2 = await runStageWithRetry(client, apiModel, "risk-and-privacy-planner", {
    analysis,
  });
  stageTrace.push(stage2.trace);
  if (stage2.trace.status !== "succeeded") {
    return errorResponse(
      "risk-and-privacy-planner",
      stage2.trace,
      stageTrace,
      502,
    );
  }
  const riskPlan = stage2.data;

  // Stage 3 — Test Case Generator
  const stage3 = await runStageWithRetry(client, apiModel, "test-case-generator", {
    analysis,
    riskPlan,
  });
  stageTrace.push(stage3.trace);
  if (stage3.trace.status !== "succeeded") {
    return errorResponse("test-case-generator", stage3.trace, stageTrace, 502);
  }
  let testCases: TestCase[];
  let droppedTestCases: { index: number; reason: string }[] = [];
  try {
    const rawTestCases = Stage3OutputSchema.parse(stage3.data).testCases;
    const filtered = parseAndFilter(rawTestCases, TestCaseSchema);
    testCases = filtered.valid;
    droppedTestCases = filtered.dropped;
    if (testCases.length === 0) {
      if (droppedTestCases[0]) {
        console.error(
          "[agent] All test cases dropped. First failure reason:",
          droppedTestCases[0],
        );
      }
      return schemaErrorResponse(
        "test-case-generator",
        "All test cases failed schema validation.",
        droppedTestCases,
        stageTrace,
      );
    }
    if (droppedTestCases.length > 0) {
      stage3.trace.message = `${stage3.trace.message ?? ""} (dropped ${droppedTestCases.length} malformed case(s))`;
    }
  } catch (err) {
    return schemaErrorResponse(
      "test-case-generator",
      "Test case payload failed schema validation.",
      err,
      stageTrace,
    );
  }

  // Stages 4 + 5 — Synthetic Data and Automation (parallel; both depend on testCases only)
  const [stage4, stage5] = await Promise.all([
    runStageWithRetry(client, apiModel, "synthetic-data-generator", {
      testCases,
      riskPlan,
    }),
    runStageWithRetry(client, apiModel, "automation-skeleton-writer", {
      testCases,
    }),
  ]);
  stageTrace.push(stage4.trace, stage5.trace);
  if (stage4.trace.status !== "succeeded") {
    return errorResponse(
      "synthetic-data-generator",
      stage4.trace,
      stageTrace,
      502,
    );
  }
  if (stage5.trace.status !== "succeeded") {
    return errorResponse(
      "automation-skeleton-writer",
      stage5.trace,
      stageTrace,
      502,
    );
  }
  let syntheticData: SyntheticData;
  try {
    const normalized = normalizeSyntheticDataPayload(stage4.data);
    syntheticData = Stage4OutputSchema.parse(normalized).syntheticData;
  } catch (err) {
    return schemaErrorResponse(
      "synthetic-data-generator",
      "Synthetic data failed schema validation.",
      err,
      stageTrace,
    );
  }

  let automation: AutomationSkeleton;
  try {
    automation = Stage5OutputSchema.parse(stage5.data).automation;
  } catch (err) {
    return schemaErrorResponse(
      "automation-skeleton-writer",
      "Automation skeleton failed schema validation.",
      err,
      stageTrace,
    );
  }

  // Stage 6 — Coverage & Safety (computed locally; no LLM round-trip)
  const stage6Started = new Date();
  let coverage = computeCoverageReport(testCases);
  let safety = computeSafetyChecklist(testCases, syntheticData, automation);
  const stage6Finished = new Date();
  stageTrace.push({
    id: "coverage-and-safety-reviewer",
    name: STAGE_PROMPTS["coverage-and-safety-reviewer"].name,
    pipelineStage: "coverage-and-safety",
    status: "succeeded",
    startedAt: stage6Started.toISOString(),
    finishedAt: stage6Finished.toISOString(),
    durationMs: stage6Finished.getTime() - stage6Started.getTime(),
    message: "Computed locally (no LLM call)",
  });

  // ---- Deterministic fixups -------------------------------------------
  //
  // The schema enforces a few invariants the model occasionally misses. We
  // fix them here so a model slip does not invalidate an otherwise good run.

  if (coverage.totalTestCases !== testCases.length) {
    coverage = { ...coverage, totalTestCases: testCases.length };
  }
  const computedPassed = !safety.items.some((i) => i.status === "fail");
  if (safety.passed !== computedPassed) {
    safety = { ...safety, passed: computedPassed };
  }

  // ---- Assemble + validate AgentOutput --------------------------------
  const candidate: AgentOutput = {
    meta: {
      runId: crypto.randomUUID(),
      agentVersion: AGENT_VERSION,
      generatedAt: new Date().toISOString(),
      requirementId: body.requirementId,
      requirementText: body.requirement,
      model,
    },
    stages: tracesToPipelineStages(stageTrace),
    testCases,
    syntheticData,
    automation,
    coverage,
    safety,
  };

  const validation = AgentOutputSchema.safeParse(candidate);

  let historyId: string | null = null;
  if (userId) {
    try {
      historyId = await saveGeneration(userId, candidate);
    } catch (err) {
      console.error("[agent] Failed to save generation history:", err);
    }
  }

  // We still return 200 with the data on a soft-failure (e.g. safety items
  // show `fail`). The dashboard renders the issues; the schema gate is
  // intentionally strict for downstream automation that ingests the output.
  return NextResponse.json<SuccessBody>(
    {
      ok: true,
      data: candidate,
      stageTrace,
      validation: validation.success
        ? { passed: true, issues: [] }
        : { passed: false, issues: validation.error.issues },
      warnings: {
        droppedTestCases,
      },
      historyId,
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function errorResponse(
  stage: PromptStageId,
  failedTrace: StageTraceEntry,
  stageTrace: StageTraceEntry[],
  status: number,
): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>(
    {
      ok: false,
      error: {
        stage,
        code: "STAGE_FAILED",
        message: failedTrace.message ?? `Stage ${stage} failed.`,
        details: failedTrace.outputPreview,
      },
      stageTrace,
    },
    { status },
  );
}

function schemaErrorResponse(
  stage: PromptStageId,
  message: string,
  err: unknown,
  stageTrace: StageTraceEntry[],
): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>(
    {
      ok: false,
      error: {
        stage,
        code: "SCHEMA_VALIDATION_FAILED",
        message,
        details:
          err instanceof z.ZodError
            ? err.issues
            : err instanceof Error
              ? err.message
              : err,
      },
      stageTrace,
    },
    { status: 422 },
  );
}

// ---------------------------------------------------------------------------
// Method guards
// ---------------------------------------------------------------------------

export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST with body { requirement: string }.",
      },
    },
    { status: 405 },
  );
}
