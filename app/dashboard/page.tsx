"use client";

/**
 * Dashboard — OpenMRS AI Healthcare Test-Automation Agent
 * --------------------------------------------------------
 * Single-page workspace that lets a user paste a healthcare requirement,
 * watch the six-stage agent pipeline run, and review the generated test
 * cases / synthetic data / Playwright skeleton / coverage & safety report.
 *
 * Layout (top → bottom):
 *   1. Header with welcome line + model chip.
 *   2. RequirementCard — textarea + 6 sample buttons + Generate button.
 *   3. StageProgress — six-step horizontal stepper (real-time via heuristic
 *      timer; reconciled against the server's authoritative trace on
 *      response).
 *   4. ExportToolbar — Copy as Markdown, Copy JSON, Copy CSV, Download report.
 *   5. ResultTabs — Test Cases | Synthetic Data | Automation | Coverage.
 *   6. SelfTestsPanel — meta-testing summary with link to full Agent QA page.
 */

import { useUser } from "@clerk/nextjs";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Code2,
  Database,
  Download,
  FileSearch,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  Loader2,
  Pill,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Trash2,
  User as UserIcon,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import {
  CoverageBreakdownPanel,
  CoverageScoreBadge,
} from "@/components/CoverageBreakdownPanel";
import { GenerationHistoryPanel } from "@/components/GenerationHistoryPanel";
import { SelfTestsPanel } from "@/components/SelfTestsPanel";
import {
  ValidationReportPanel,
  ValidationScoreBadge,
} from "@/components/ValidationReportPanel";
import {
  HEURISTIC_STAGE_END_MS,
  STAGES,
  StageProgress,
  type StageStatus,
} from "@/components/StageProgress";
import { SyntheticDataViewer } from "@/components/SyntheticDataViewer";
import { TestCaseCard } from "@/components/TestCaseCard";
import {
  exportFilenameStem,
  renderAgentOutputAsJson,
  renderAgentOutputAsMarkdown,
  renderAgentTestCasesCsv,
} from "@/lib/export";
import {
  DEFAULT_LLM_MODEL,
  getModelDefinition,
  getProviderLabel,
  LLM_MODEL_GROUPS,
  LLM_MODELS,
  type LlmModelId,
} from "@/lib/llm-models";
import {
  SAMPLE_REQUIREMENTS,
  type SampleIconId,
} from "@/lib/sample-requirements";
import { validateTestCases } from "@/lib/validator";
import { computeCoverageReport } from "@/lib/deterministic-coverage";
import { coverageScoreTone } from "@/lib/coverage-engine";
import type {
  AgentOutput,
  AutomationSkeleton,
  CoverageReport,
  SafetyChecklist,
  TestCase,
} from "@/lib/schemas";
import { normalizeAgentOutput } from "@/lib/normalize";
import {
  clearCurrentGeneration,
  loadCurrentGeneration,
  saveCurrentGeneration,
  type CachedGenerationResult,
} from "@/lib/generation-cache";
import { cn } from "@/lib/utils";

/** Must exceed server maxDuration + network buffer (see generate/route.ts). */
const CLIENT_GENERATION_TIMEOUT_MS = 130_000;

// ---------------------------------------------------------------------------
// Sample requirements (quick start) — see lib/sample-requirements.ts
// ---------------------------------------------------------------------------

const SAMPLE_ICONS: Record<SampleIconId, LucideIcon> = {
  user: UserIcon,
  stethoscope: Stethoscope,
  activity: Activity,
  users: Users,
  pill: Pill,
  "shield-check": ShieldCheck,
  "heart-pulse": HeartPulse,
  clipboard: ClipboardList,
  syringe: Syringe,
  "file-search": FileSearch,
};

// ---------------------------------------------------------------------------
// Response shape (mirrors /api/agent/generate/route.ts)
// ---------------------------------------------------------------------------

type ApiSuccess = CachedGenerationResult;

interface ApiError {
  ok: false;
  error: {
    stage?: string;
    code: string;
    message: string;
    details?: unknown;
  };
  stageTrace: {
    id: string;
    name: string;
    status: StageStatus | "skipped";
    durationMs?: number;
    message?: string;
  }[];
}

type ApiResponse = ApiSuccess | ApiError;

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your workspace…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-muted-foreground">
        <ShieldAlert className="mb-3 h-8 w-8 text-amber-500" />
        <p>You need to sign in to use the agent.</p>
      </div>
    );
  }

  return <Workspace />;
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

type WorkspaceView = "generate" | "history";

function Workspace() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("generate");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [requirement, setRequirement] = useState("");
  const [selectedModel, setSelectedModel] =
    useState<LlmModelId>(DEFAULT_LLM_MODEL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [stageStatuses, setStageStatuses] = useState<
    Record<string, StageStatus>
  >(() => Object.fromEntries(STAGES.map((s) => [s.id, "pending"])));
  const [stageDurations, setStageDurations] = useState<
    Record<string, number | undefined>
  >({});
  const [sessionRestored, setSessionRestored] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const requestStartRef = useRef<number>(0);
  const hydratedRef = useRef(false);

  /** Apply stage trace or fall back to all-succeeded (history / cache loads). */
  function applyStageTrace(
    trace: ApiSuccess["stageTrace"] | undefined,
    fallback: StageStatus = "succeeded",
  ) {
    const statuses: Record<string, StageStatus> = Object.fromEntries(
      STAGES.map((s) => [s.id, "pending"]),
    ) as Record<string, StageStatus>;
    const durations: Record<string, number | undefined> = {};

    if (trace && trace.length > 0) {
      for (const t of trace) {
        if (statuses[t.id] !== undefined) {
          statuses[t.id] =
            t.status === "skipped" ? "pending" : (t.status as StageStatus);
          durations[t.id] = t.durationMs;
        }
      }
    } else {
      for (const s of STAGES) statuses[s.id] = fallback;
    }

    setStageStatuses(statuses);
    setStageDurations(durations);
    return { statuses, durations };
  }

  function persistCurrentGeneration(
    req: string,
    model: LlmModelId,
    apiResult: ApiSuccess,
    statuses: Record<string, StageStatus>,
    durations: Record<string, number | undefined>,
  ) {
    if (!user?.id) return;
    saveCurrentGeneration(user.id, {
      requirement: req,
      model,
      result: apiResult,
      stageStatuses: statuses,
      stageDurations: durations,
    });
    setSessionRestored(false);
  }

  // Restore last active generation from localStorage (per Clerk user).
  useEffect(() => {
    if (!user?.id || hydratedRef.current) return;
    hydratedRef.current = true;

    const cached = loadCurrentGeneration(user.id);
    if (!cached) return;

    setRequirement(cached.requirement);
    if (LLM_MODELS.some((m) => m.id === cached.model)) {
      setSelectedModel(cached.model as LlmModelId);
    }
    setResult(cached.result);

    if (cached.stageStatuses) {
      setStageStatuses(cached.stageStatuses as Record<string, StageStatus>);
      setStageDurations(cached.stageDurations ?? {});
    } else {
      applyStageTrace(cached.result.stageTrace);
    }

    setSessionRestored(true);
  }, [user?.id]);

  // Drive the faux progressive timeline while a request is in flight.
  useEffect(() => {
    if (!loading) return;
    requestStartRef.current = Date.now();

    setStageStatuses(() => {
      const fresh: Record<string, StageStatus> = Object.fromEntries(
        STAGES.map((s) => [s.id, "pending"]),
      );
      fresh[STAGES[0].id] = "running";
      return fresh;
    });
    setStageDurations({});

    const timers = HEURISTIC_STAGE_END_MS.map((t, i) =>
      setTimeout(() => {
        setStageStatuses((prev) => {
          const next = { ...prev };
          next[STAGES[i].id] = "succeeded";
          const nextStage = STAGES[i + 1];
          if (nextStage && next[nextStage.id] === "pending") {
            next[nextStage.id] = "running";
          }
          return next;
        });
      }, t),
    );

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  async function handleGenerate() {
    if (!requirement.trim() || requirement.trim().length < 20) {
      setError("Please paste a requirement at least 20 characters long.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);

    const controller = new AbortController();
    const clientTimeout = window.setTimeout(
      () => controller.abort(),
      CLIENT_GENERATION_TIMEOUT_MS,
    );

    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement: requirement.trim(),
          model: selectedModel,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.ok
            ? "Server returned an unexpected response format."
            : `Server error (${res.status}). Try again or pick a different model.`,
        );
      }

      const json: ApiResponse = await res.json();

      const authoritative: Record<string, StageStatus> = Object.fromEntries(
        STAGES.map((s) => [s.id, "pending"]),
      ) as Record<string, StageStatus>;
      const durations: Record<string, number | undefined> = {};
      for (const t of json.stageTrace ?? []) {
        if (authoritative[t.id] !== undefined) {
          authoritative[t.id] =
            t.status === "skipped" ? "pending" : (t.status as StageStatus);
          durations[t.id] = t.durationMs;
        }
      }

      if (json.ok) {
        const normalized: ApiSuccess = {
          ...json,
          data: normalizeAgentOutput(json.data),
        };
        setResult(normalized);
        setStageStatuses(authoritative);
        setStageDurations(durations);
        persistCurrentGeneration(
          requirement.trim(),
          selectedModel,
          normalized,
          authoritative,
          durations,
        );
        if (json.historyId) {
          setHistoryRefreshKey((k) => k + 1);
        }
      } else {
        if (json.error.stage && authoritative[json.error.stage] !== undefined) {
          authoritative[json.error.stage] = "failed";
        }
        setStageStatuses(authoritative);
        setStageDurations(durations);
        setError(
          json.error.code === "TIMEOUT"
            ? `${json.error.message} Try GPT-4o Mini (default) or a shorter requirement.`
            : `${json.error.code}: ${json.error.message}` +
                (json.error.stage ? ` (stage: ${json.error.stage})` : ""),
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError(
          `Generation timed out after ${CLIENT_GENERATION_TIMEOUT_MS / 1000} seconds. The agent uses 2 fast LLM calls — try GPT-4o Mini or shorten the requirement.`,
        );
      } else {
        setError(
          err instanceof Error
            ? `Network error: ${err.message}`
            : "Unknown network error.",
        );
      }
    } finally {
      window.clearTimeout(clientTimeout);
      setLoading(false);
    }
  }

  async function handleRevalidate() {
    if (!result) return;
    setRevalidating(true);
    try {
      // Yield so the spinner paints before synchronous validation work.
      await new Promise((r) => setTimeout(r, 0));
      const validation = validateTestCases(result.data.testCases);
      const coverage = {
        ...computeCoverageReport(result.data.testCases),
        coveragePct: validation.coverageScore / 100,
      };
      const updated: ApiSuccess = {
        ...result,
        data: {
          ...result.data,
          testCaseValidation: validation,
          coverage,
        },
      };
      setResult(updated);
      persistCurrentGeneration(
        requirement.trim(),
        selectedModel,
        updated,
        stageStatuses,
        stageDurations,
      );
    } finally {
      setRevalidating(false);
    }
  }

  function handleLoadHistory(output: AgentOutput, req: string) {
    const normalized = normalizeAgentOutput(output);
    const validation = validateTestCases(normalized.testCases);
    const modelFromMeta = normalized.meta.model;
    const model =
      modelFromMeta && LLM_MODELS.some((m) => m.id === modelFromMeta)
        ? (modelFromMeta as LlmModelId)
        : selectedModel;

    const apiResult: ApiSuccess = {
      ok: true,
      data: {
        ...normalized,
        testCaseValidation: validation,
      },
      stageTrace: [],
      validation: { passed: true, issues: [] },
      warnings: { droppedTestCases: [] },
      historyId: normalized.meta.runId,
    };

    setRequirement(req);
    setSelectedModel(model);
    setResult(apiResult);
    setError(null);
    setWorkspaceView("generate");

    const { statuses, durations } = applyStageTrace(undefined, "succeeded");
    persistCurrentGeneration(req, model, apiResult, statuses, durations);
  }

  function handleClearCurrent() {
    if (user?.id) clearCurrentGeneration(user.id);
    setResult(null);
    setError(null);
    setSessionRestored(false);
    setStageStatuses(
      Object.fromEntries(STAGES.map((s) => [s.id, "pending"])) as Record<
        string,
        StageStatus
      >,
    );
    setStageDurations({});
  }

  const activeModelId = result?.data.meta.model ?? selectedModel;
  const activeModel =
    LLM_MODELS.find((m) => m.id === activeModelId) ??
    getModelDefinition(selectedModel);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a healthcare requirement and the agent will generate test
            cases, synthetic OpenMRS data, and a Playwright skeleton.
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {result?.data.testCaseValidation && (
            <>
              <CoverageScoreBadge report={result.data.testCaseValidation} />
              <ValidationScoreBadge report={result.data.testCaseValidation} />
            </>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            {getProviderLabel(activeModel.provider)} · {activeModel.label}
          </div>
        </div>
      </div>

      {/* Generate | History */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <WorkspaceTab
          active={workspaceView === "generate"}
          onClick={() => setWorkspaceView("generate")}
          icon={FlaskConical}
          label="Generate"
        />
        <WorkspaceTab
          active={workspaceView === "history"}
          onClick={() => setWorkspaceView("history")}
          icon={History}
          label="History"
        />
      </div>

      {sessionRestored && result && workspaceView === "generate" && (
        <RestoredBanner onDismiss={() => setSessionRestored(false)} />
      )}

      {workspaceView === "history" ? (
        <GenerationHistoryPanel
          variant="full"
          refreshKey={historyRefreshKey}
          onLoad={handleLoadHistory}
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-6">
            <RequirementCard
              value={requirement}
              onChange={setRequirement}
              model={selectedModel}
              onModelChange={setSelectedModel}
              onGenerate={handleGenerate}
              loading={loading}
            />

            {(loading || result || error) && (
              <StageProgress
                statuses={stageStatuses}
                loading={loading}
                durations={stageDurations}
                startedAt={loading ? requestStartRef.current : undefined}
              />
            )}

            {error && <ErrorBanner message={error} />}

            {result?.warnings.droppedTestCases.length ? (
              <WarningBanner
                count={result.warnings.droppedTestCases.length}
                warnings={result.warnings.droppedTestCases}
              />
            ) : null}

            {result && (
              <>
                <ExportToolbar
                  output={result.data}
                  onClear={handleClearCurrent}
                />
                <CoverageBreakdownPanel
                  key={result.data.testCaseValidation.generatedAt}
                  report={result.data.testCaseValidation}
                />
                <ValidationReportPanel
                  key={`validation-${result.data.testCaseValidation.generatedAt}`}
                  report={result.data.testCaseValidation}
                  onRevalidate={() => void handleRevalidate()}
                  revalidating={revalidating}
                />
                <ResultTabs
                  key={`${result.data.meta.runId}-${result.data.testCaseValidation.generatedAt}`}
                  output={result.data}
                />
              </>
            )}
          </div>

          <GenerationHistoryPanel
            variant="sidebar"
            className="hidden xl:flex xl:sticky xl:top-6 xl:h-[calc(100vh-5.5rem)] xl:w-full xl:min-h-0"
            refreshKey={historyRefreshKey}
            onLoad={handleLoadHistory}
          />
        </div>
      )}

      {/* Meta — self-tests */}
      <SelfTestsPanel />
    </div>
  );
}

function WorkspaceTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FlaskConical;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Requirement input card
// ---------------------------------------------------------------------------

function RequirementCard({
  value,
  onChange,
  model,
  onModelChange,
  onGenerate,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  model: LlmModelId;
  onModelChange: (model: LlmModelId) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  const selectedMeta = LLM_MODELS.find((m) => m.id === model);
  const charOk = value.trim().length >= 20;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-blue-600/5 to-transparent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Healthcare requirement</h2>
              <p className="text-xs text-muted-foreground">
                Paste a user story — generates 6–10 cases in about 45–90 seconds
              </p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              charOk
                ? "bg-emerald-100 text-emerald-800"
                : "bg-muted text-muted-foreground",
            )}
          >
            {value.length.toLocaleString()} chars
            {!charOk && " · need 20+"}
          </span>
        </div>
      </div>

      <div className="p-5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Example: As a Registration Clerk, I want to register a new outpatient with synthetic demographics and a TEST- identifier so visits and encounters can be created securely…"
        className="min-h-[140px] w-full resize-y rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
        disabled={loading}
      />

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Quick start — pick a clinical scenario:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_REQUIREMENTS.map((s) => {
          const Icon = SAMPLE_ICONS[s.icon];
          return (
            <button
              key={s.label}
              type="button"
              title={s.text}
              onClick={() => onChange(s.text)}
              disabled={loading}
              className="group flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {s.label}
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-blue-700/80">
                  {s.area}
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {s.hint}
                </span>
              </span>
            </button>
          );
        })}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-sm">
          Tip: <strong className="font-medium text-foreground">GPT-4o Mini</strong> is the default — best balance of speed and quality. Runs typically finish within 90 seconds.
        </p>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 sm:flex-none">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              AI model
            </span>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value as LlmModelId)}
              disabled={loading}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LLM_MODEL_GROUPS.map((group) => (
                <optgroup key={group.tier} label={group.label}>
                  {group.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.description}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || !charOk}
            className="inline-flex min-w-[11rem] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Generate Test Plan
              </>
            )}
          </button>
        </div>
      </div>
      {selectedMeta?.recommended && (
        <p className="mt-2 text-right text-[11px] text-emerald-700">
          ✓ Recommended for speed
        </p>
      )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">Generation failed</div>
        <div className="mt-0.5 text-red-700">{message}</div>
      </div>
    </div>
  );
}

function WarningBanner({
  count,
  warnings,
}: {
  count: number;
  warnings: { index: number; reason: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {count} malformed test case{count > 1 ? "s" : ""} were dropped
        </span>
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4" />
        )}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-6 text-xs">
          {warnings.map((w) => (
            <li key={w.index} className="list-disc">
              <span className="font-medium">#{w.index}:</span> {w.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RestoredBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      <span>
        Restored your last active generation from this browser session.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export toolbar — Copy as Markdown / JSON / CSV + Download
// ---------------------------------------------------------------------------

function ExportToolbar({
  output,
  onClear,
}: {
  output: AgentOutput;
  onClear: () => void;
}) {
  const stem = exportFilenameStem(output);

  function downloadMarkdownReport() {
    triggerTextDownload(
      renderAgentOutputAsMarkdown(output),
      `${stem}.md`,
      "text/markdown;charset=utf-8",
    );
  }

  function downloadCsvReport() {
    triggerTextDownload(
      renderAgentTestCasesCsv(output),
      `${stem}-test-cases.csv`,
      "text/csv;charset=utf-8",
    );
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="font-medium">Generation complete.</span>
        <span className="text-xs text-muted-foreground">
          Run id <span className="font-mono">{output.meta.runId.slice(0, 8)}</span>
          {" · "}
          {output.testCases.length} test case
          {output.testCases.length === 1 ? "" : "s"}
          {" · "}
          {Math.round(
            (output.testCaseValidation.coverageScore ??
              output.coverage.coveragePct * 100),
          )}
          % coverage
          {" · "}
          QA {output.testCaseValidation.score}/100
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton
          label="Copy Markdown"
          getText={() => renderAgentOutputAsMarkdown(output)}
        />
        <CopyButton
          label="Copy JSON"
          getText={() => renderAgentOutputAsJson(output)}
        />
        <CopyButton
          label="Copy CSV"
          getText={() => renderAgentTestCasesCsv(output)}
        />
        <button
          type="button"
          onClick={downloadMarkdownReport}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Download .md
        </button>
        <button
          type="button"
          onClick={downloadCsvReport}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Download .csv
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Current Result
        </button>
      </div>
    </section>
  );
}

function triggerTextDownload(
  content: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Results — tabs
// ---------------------------------------------------------------------------

type TabId = "tests" | "data" | "automation" | "coverage";

const TABS: { id: TabId; label: string; icon: typeof FlaskConical }[] = [
  { id: "tests", label: "Test Cases", icon: FlaskConical },
  { id: "data", label: "Synthetic Data", icon: Database },
  { id: "automation", label: "Automation", icon: Code2 },
  { id: "coverage", label: "Coverage & Safety", icon: ShieldCheck },
];

function ResultTabs({ output }: { output: AgentOutput }) {
  const [active, setActive] = useState<TabId>("tests");
  const automation = output.automation ?? { uiTest: "", apiTest: "" };

  return (
    <section className="rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-2">
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = id === active;
            const count =
              id === "tests"
                ? output.testCases.length
                : id === "data"
                  ? output.syntheticData.patients.length +
                    output.syntheticData.users.length +
                    output.syntheticData.visits.length +
                    output.syntheticData.encounters.length
                  : id === "automation"
                    ? (automation.uiTest?.trim() ? 1 : 0) +
                      (automation.apiTest?.trim() ? 1 : 0)
                    : output.safety.items.length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-blue-700"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {active === "tests" && <TestCasesView testCases={output.testCases} />}
        {active === "data" && (
          <SyntheticDataViewer data={output.syntheticData} />
        )}
        {active === "automation" && (
          <AutomationView automation={automation} />
        )}
        {active === "coverage" && (
          <CoverageSafetyView
            coverage={output.coverage}
            safety={output.safety}
            validation={output.testCaseValidation}
          />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab — Test cases
// ---------------------------------------------------------------------------

function TestCasesView({ testCases }: { testCases: TestCase[] }) {
  const categories = Array.from(
    new Set<string>(["All", ...testCases.map((t) => t.category)]),
  );
  const [filter, setFilter] = useState<string>("All");
  const visible =
    filter === "All"
      ? testCases
      : testCases.filter((t) => t.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => {
          const isActive = c === filter;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:border-blue-300 hover:text-blue-700",
              )}
            >
              {c}
              {c !== "All" && (
                <span className="ml-1.5 text-[10px] opacity-80">
                  {testCases.filter((t) => t.category === c).length}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto text-xs text-muted-foreground">
          Showing {visible.length} of {testCases.length}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((tc) => (
          <TestCaseCard key={tc.id} testCase={tc} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Automation
// ---------------------------------------------------------------------------

function AutomationView({ automation }: { automation: AutomationSkeleton }) {
  const hasUi = automation.uiTest.trim().length > 0;
  const hasApi = automation.apiTest.trim().length > 0;

  return (
    <div className="space-y-4">
      {automation.notes && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div className="font-medium text-muted-foreground">Setup notes</div>
          <div className="mt-1 whitespace-pre-wrap text-foreground">
            {automation.notes}
          </div>
        </div>
      )}

      {!hasUi && !hasApi && (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          The agent did not return any code for this stage.
        </div>
      )}

      {hasUi && (
        <CodeBlock
          title="Playwright — UI test"
          language="typescript"
          code={automation.uiTest}
        />
      )}

      {hasApi && (
        <CodeBlock
          title="fetch — REST API test"
          language="typescript"
          code={automation.apiTest}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Coverage & Safety
// ---------------------------------------------------------------------------

function CoverageSafetyView({
  coverage,
  safety,
  validation,
}: {
  coverage: CoverageReport;
  safety: SafetyChecklist;
  validation?: AgentOutput["testCaseValidation"];
}) {
  const pct = validation?.coverageScore ?? Math.round(coverage.coveragePct * 100);
  const tone = coverageScoreTone(pct);
  const toneBar =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "yellow"
        ? "bg-amber-500"
        : "bg-red-500";
  const toneText =
    tone === "green"
      ? "text-emerald-700"
      : tone === "yellow"
        ? "text-amber-800"
        : "text-red-700";

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Coverage Score</div>
              <div className={cn("text-2xl font-semibold tracking-tight", toneText)}>
                {pct}%
              </div>
              <div className="text-xs text-muted-foreground">
                {coverage.totalTestCases} total test case
                {coverage.totalTestCases === 1 ? "" : "s"}
                {pct > 85 ? " · Excellent" : pct >= 70 ? " · Adequate" : " · Needs expansion"}
              </div>
            </div>
            <div className="w-40">
              <div className="mb-1 text-right text-[10px] text-muted-foreground">
                {pct}% / 100%
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", toneBar)}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {validation?.coverageBreakdown && validation.coverageBreakdown.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm font-medium">Coverage breakdown</div>
            <ul className="mt-3 space-y-2">
              {validation.coverageBreakdown.map((area) => {
                const fill = area.covered
                  ? Math.min(100, (area.count / area.minRequired) * 100)
                  : Math.min(100, (area.count / area.minRequired) * 100);
                return (
                  <li key={area.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{area.label}</span>
                      <span className="text-muted-foreground">
                        {area.count}/{area.minRequired}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          area.covered ? "bg-emerald-500" : "bg-amber-500",
                        )}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <BarBlock
          title="By category"
          buckets={coverage.byCategory as Record<string, number>}
          colorMap={{
            Functional: "bg-blue-500",
            Negative: "bg-amber-500",
            Validation: "bg-violet-500",
            Security: "bg-red-500",
            Privacy: "bg-pink-500",
            Audit: "bg-emerald-500",
          }}
        />

        <BarBlock
          title="By OpenMRS entity"
          buckets={coverage.byEntity as Record<string, number>}
        />

        {coverage.gaps.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm font-medium">Missing scenarios & gaps</div>
            <ul className="mt-2 space-y-2 text-xs">
              {(validation?.missingScenarios ?? []).slice(0, 6).map((item) => (
                <li key={item} className="flex items-start gap-2 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{item}</span>
                </li>
              ))}
              {coverage.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      g.severity === "high" && "bg-red-100 text-red-700",
                      g.severity === "medium" && "bg-amber-100 text-amber-700",
                      g.severity === "low" && "bg-zinc-100 text-zinc-700",
                    )}
                  >
                    {g.severity}
                  </span>
                  <div>
                    <div className="font-medium">{g.area}</div>
                    <div className="text-muted-foreground">{g.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div
          className={cn(
            "rounded-lg border p-4",
            safety.passed
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          )}
        >
          <div className="flex items-center gap-2">
            {safety.passed ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            )}
            <div className="font-medium">
              Safety {safety.passed ? "passed" : "FAILED"}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {safety.items.filter((i) => i.status === "pass").length} pass ·{" "}
            {safety.items.filter((i) => i.status === "warn").length} warn ·{" "}
            {safety.items.filter((i) => i.status === "fail").length} fail
          </div>
        </div>

        <ul className="space-y-2">
          {safety.items.map((item) => (
            <li
              key={item.ruleId}
              className="rounded-lg border border-border bg-background p-3 text-xs"
            >
              <div className="flex items-start gap-2">
                {item.status === "pass" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : item.status === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
                )}
                <div className="min-w-0">
                  <div className="font-medium">{item.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {item.ruleId}
                  </div>
                  {item.detail && (
                    <div className="mt-1 text-muted-foreground">
                      {item.detail}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BarBlock({
  title,
  buckets,
  colorMap,
}: {
  title: string;
  buckets: Record<string, number>;
  colorMap?: Record<string, string>;
}) {
  const entries = Object.entries(buckets).filter(([, v]) => v != null);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-3 space-y-2">
        {entries.map(([label, v]) => (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 truncate text-muted-foreground">
              {label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  colorMap?.[label] ?? "bg-blue-500",
                )}
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-medium">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
