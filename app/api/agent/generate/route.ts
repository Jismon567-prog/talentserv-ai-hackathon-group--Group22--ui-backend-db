/**
 * POST /api/agent/generate
 * ------------------------
 * Orchestrates the six-stage OpenMRS AI Healthcare Test-Automation Agent.
 *
 * Pipeline (two LLM calls + local stages):
 *
 *   1+2. Requirement Analyzer + Risk Planner  ── single combined call
 *   3.   Test Case Generator
 *   4.   Synthetic Data Generator             ── local (no LLM)
 *   5.   Automation Skeleton Writer           ── local (no LLM)
 *   6.   Coverage & Safety Reviewer           ── local (no LLM)
 *
 * Inputs:    { requirement: string, requirementId?: string, model?: string }
 * Outputs:   { ok: true,  data: AgentOutput,  stageTrace: StageTraceEntry[], validation: ... }
 *            { ok: false, error: { stage?, code, message, details? }, stageTrace }
 *
 * Notes:
 * - Supports OpenAI (paid) and Groq (free tier) via the OpenAI SDK.
 * - Model is selected by the client (default: gpt-4o-mini).
 * - JSON responses are parsed defensively (optional markdown fences stripped).
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
  normalizeTestCasesPayload,
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
import { buildAutomationSkeleton } from "@/lib/automation-templates";
import { buildSyntheticData } from "@/lib/synthetic-data-templates";
import { validateTestCases } from "@/lib/validator";
import {
  PROMPT_STAGE_TO_PIPELINE,
  STAGE_PROMPTS,
  buildCombinedAnalysisRiskMessages,
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

// Two LLM calls; stages 4–6 are computed locally. Allow headroom for cold starts.
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// LLM configuration
// ---------------------------------------------------------------------------

const AGENT_VERSION = "0.1.0";

/** OpenAI SDK timeout per HTTP request (test-case stage needs the most time). */
const LLM_REQUEST_TIMEOUT_MS = 55_000;

/** Low temperature for deterministic, audit-friendly test generation. */
const TEMPERATURE = 0.2;

/** Cap output tokens per stage — shorter responses finish sooner. */
const STAGE_MAX_TOKENS: Record<PromptStageId, number> = {
  "requirement-analyzer": 1536,
  "risk-and-privacy-planner": 1536,
  "test-case-generator": 4096,
  "synthetic-data-generator": 1024,
  "automation-skeleton-writer": 512,
  "coverage-and-safety-reviewer": 512,
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

function isTimeoutError(message: string): boolean {
  return /\btimeout\b|timed out|ETIMEDOUT|time.?out|aborted|deadline exceeded/i.test(
    message,
  );
}

function formatStageError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (isTimeoutError(message)) {
    return `Request timed out after ${LLM_REQUEST_TIMEOUT_MS / 1000}s. Try GPT-4o Mini (default), use a shorter requirement, or wait and retry.`;
  }
  return message;
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
  maxAttempts = 2,
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
    const message = formatStageError(err);
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
const CombinedAnalysisSchema = z.object({
  analysis: z.unknown(),
  riskPlan: z.unknown(),
});
const Stage4OutputSchema = z.object({
  syntheticData: SyntheticDataSchema,
});
const Stage5OutputSchema = z.object({
  automation: AutomationSkeletonSchema,
});

/** Combined stages 1+2 in one LLM round-trip (~10–15s saved). */
async function runCombinedAnalysisStage(
  client: OpenAI,
  apiModel: string,
  requirementText: string,
  requirementId?: string,
): Promise<{
  data: { analysis: unknown; riskPlan: unknown } | null;
  traces: StageTraceEntry[];
}> {
  const startedAt = new Date();
  const baseTrace = {
    pipelineStage: "requirement-parsing" as PipelineStageName,
    startedAt: startedAt.toISOString(),
  };

  try {
    const { system, user } = buildCombinedAnalysisRiskMessages({
      requirementText,
      requirementId,
    });

    const completion = await client.chat.completions.create({
      model: apiModel,
      temperature: TEMPERATURE,
      max_tokens: 2048,
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

    const parsed = CombinedAnalysisSchema.parse(extractJsonObject(raw));
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = `Combined analysis + risk plan in ${durationMs} ms`;

    return {
      data: { analysis: parsed.analysis, riskPlan: parsed.riskPlan },
      traces: [
        {
          id: "requirement-analyzer",
          name: STAGE_PROMPTS["requirement-analyzer"].name,
          ...baseTrace,
          status: "succeeded",
          finishedAt: finishedAt.toISOString(),
          durationMs,
          outputPreview: preview(raw),
          message,
        },
        {
          id: "risk-and-privacy-planner",
          name: STAGE_PROMPTS["risk-and-privacy-planner"].name,
          ...baseTrace,
          status: "succeeded",
          finishedAt: finishedAt.toISOString(),
          durationMs,
          message: "Completed with combined analysis call",
        },
      ],
    };
  } catch (err) {
    const finishedAt = new Date();
    const message = formatStageError(err);
    return {
      data: null,
      traces: [
        {
          id: "requirement-analyzer",
          name: STAGE_PROMPTS["requirement-analyzer"].name,
          ...baseTrace,
          status: "failed",
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          message,
        },
        {
          id: "risk-and-privacy-planner",
          name: STAGE_PROMPTS["risk-and-privacy-planner"].name,
          ...baseTrace,
          status: "skipped",
          finishedAt: finishedAt.toISOString(),
          message: "Skipped — combined analysis failed",
        },
      ],
    };
  }
}

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
    const resolved = resolveLlm(model, LLM_REQUEST_TIMEOUT_MS);
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

  // Stage 1+2 — Combined Requirement Analysis + Risk Plan (single LLM call)
  const combined = await runCombinedAnalysisStage(
    client,
    apiModel,
    body.requirement,
    body.requirementId,
  );
  stageTrace.push(...combined.traces);
  if (!combined.data) {
    return errorResponse(
      "requirement-analyzer",
      combined.traces[0],
      stageTrace,
      isTimeoutError(combined.traces[0].message ?? "") ? 504 : 502,
    );
  }
  const { analysis, riskPlan } = combined.data;

  // Stage 3 — Test Case Generator
  const stage3 = await runStageWithRetry(client, apiModel, "test-case-generator", {
    analysis,
    riskPlan,
  });
  stageTrace.push(stage3.trace);
  if (stage3.trace.status !== "succeeded") {
    return errorResponse(
      "test-case-generator",
      stage3.trace,
      stageTrace,
      isTimeoutError(stage3.trace.message ?? "") ? 504 : 502,
    );
  }
  let testCases: TestCase[];
  let droppedTestCases: { index: number; reason: string }[] = [];
  try {
    const rawTestCases = Stage3OutputSchema.parse(stage3.data).testCases;
    const normalizedTestCases = normalizeTestCasesPayload({
      testCases: rawTestCases,
    });
    const filtered = parseAndFilter(normalizedTestCases, TestCaseSchema);
    testCases = filtered.valid;
    droppedTestCases = filtered.dropped;
    if (testCases.length === 0) {
      if (droppedTestCases.length > 0) {
        console.error(
          "[agent] All test cases dropped. Sample failures:",
          droppedTestCases.slice(0, 5),
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

  // Stage 4 — Synthetic Data (local; no LLM)
  const stage4Started = new Date();
  const syntheticDataRaw = buildSyntheticData(testCases);
  const stage4Finished = new Date();
  stageTrace.push({
    id: "synthetic-data-generator",
    name: STAGE_PROMPTS["synthetic-data-generator"].name,
    pipelineStage: "synthetic-data",
    status: "succeeded",
    startedAt: stage4Started.toISOString(),
    finishedAt: stage4Finished.toISOString(),
    durationMs: stage4Finished.getTime() - stage4Started.getTime(),
    message: "Generated locally from test cases (no LLM call)",
  });

  const stage5Started = new Date();
  const automation = buildAutomationSkeleton(testCases);
  const stage5Finished = new Date();
  stageTrace.push({
    id: "automation-skeleton-writer",
    name: STAGE_PROMPTS["automation-skeleton-writer"].name,
    pipelineStage: "automation-skeleton",
    status: "succeeded",
    startedAt: stage5Started.toISOString(),
    finishedAt: stage5Finished.toISOString(),
    durationMs: stage5Finished.getTime() - stage5Started.getTime(),
    message: "Generated locally from test cases (no LLM call)",
  });

  let syntheticData: SyntheticData;
  try {
    const normalized = normalizeSyntheticDataPayload({ syntheticData: syntheticDataRaw });
    syntheticData = Stage4OutputSchema.parse(normalized).syntheticData;
  } catch (err) {
    return schemaErrorResponse(
      "synthetic-data-generator",
      "Synthetic data failed schema validation.",
      err,
      stageTrace,
    );
  }

  // Stage 6 — Coverage & Safety (computed locally; no LLM round-trip)
  const stage6Started = new Date();
  let coverage = computeCoverageReport(testCases);
  let safety = computeSafetyChecklist(testCases, syntheticData, automation);
  const testCaseValidation = validateTestCases(testCases);
  coverage = {
    ...coverage,
    coveragePct: testCaseValidation.coverageScore / 100,
  };
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
    testCaseValidation,
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
  const timedOut = isTimeoutError(failedTrace.message ?? "");
  return NextResponse.json<ErrorBody>(
    {
      ok: false,
      error: {
        stage,
        code: timedOut ? "TIMEOUT" : "STAGE_FAILED",
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
