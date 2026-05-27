"use client";

/**
 * StageProgress
 * -------------
 * Six-step horizontal stepper that visualises the agent pipeline.
 *
 * The API is a single POST that returns the full result — there is no
 * server-sent event stream — so the dashboard runs a small heuristic
 * timer that ticks each stage to "succeeded" at empirically-observed
 * times, then reconciles against the authoritative stageTrace returned
 * by the server. Pure-display logic lives here; the timer + reconciliation
 * live in the dashboard so this component stays trivially testable.
 *
 * STAGES is exported so the dashboard and any future status endpoint
 * agree on the canonical ordering and ids (which mirror lib/prompts.ts'
 * PROMPT_PIPELINE_ORDER).
 */

import {
  Activity,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type StageStatus = "pending" | "running" | "succeeded" | "failed";

export interface StageMeta {
  /** Matches the PromptStageId in lib/prompts.ts. */
  id: string;
  label: string;
  description: string;
}

/** Canonical six-stage pipeline. Keep in sync with lib/prompts.ts. */
export const STAGES: StageMeta[] = [
  {
    id: "requirement-analyzer",
    label: "Requirement Analysis",
    description: "Parse the user story into OpenMRS actors and workflows.",
  },
  {
    id: "risk-and-privacy-planner",
    label: "Risk Planning",
    description: "Inventory PHI, RBAC matrix, and threat model.",
  },
  {
    id: "test-case-generator",
    label: "Test Generation",
    description: "Functional, Negative, Validation, Security, Privacy, Audit.",
  },
  {
    id: "synthetic-data-generator",
    label: "Synthetic Data",
    description: "Patients, Users, Visits, Encounters.",
  },
  {
    id: "automation-skeleton-writer",
    label: "Automation",
    description: "Playwright UI + REST API skeleton.",
  },
  {
    id: "coverage-and-safety-reviewer",
    label: "Coverage Review",
    description: "Coverage report and safety checklist.",
  },
];

/**
 * Approximate cumulative milliseconds at which each stage typically
 * completes. Stages 4+5 run in parallel on the server; both tick at ~32s.
 * Stage 6 is computed locally (~33s). Used to drive a faux progressive
 * timeline while the single POST request is in flight.
 */
export const HEURISTIC_STAGE_END_MS = [
  4_000,
  9_000,
  20_000,
  32_000,
  32_000,
  33_000,
];

export interface StageProgressProps {
  /** Map of stage id → current status. Missing entries are "pending". */
  statuses: Record<string, StageStatus>;
  /** True while the API request is in flight. Drives the spinner state. */
  loading: boolean;
  /** Optional duration (ms) labels per stage, sourced from the trace. */
  durations?: Record<string, number | undefined>;
}

export function StageProgress({
  statuses,
  loading,
  durations,
}: StageProgressProps) {
  const completed = STAGES.filter((s) => statuses[s.id] === "succeeded").length;
  const failed = STAGES.some((s) => statuses[s.id] === "failed");
  const overall = failed
    ? "failed"
    : completed === STAGES.length
      ? "complete"
      : loading
        ? "running"
        : "pending";

  return (
    <section className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-medium">Pipeline</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full",
              overall === "complete" && "bg-emerald-500",
              overall === "failed" && "bg-red-500",
              overall === "running" && "animate-pulse bg-blue-500",
              overall === "pending" && "bg-zinc-300",
            )}
          />
          <span className="text-muted-foreground">
            {completed}/{STAGES.length} stages
            {overall === "failed" && " · failed"}
            {overall === "complete" && " · complete"}
          </span>
        </div>
      </div>

      <ol className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {STAGES.map((stage, i) => {
          const status = statuses[stage.id] ?? "pending";
          const ms = durations?.[stage.id];
          return (
            <li
              key={stage.id}
              className="flex flex-1 items-start gap-3 lg:flex-col lg:items-center lg:gap-2 lg:px-2"
            >
              <StageNode index={i + 1} status={status} />
              <div className="min-w-0 lg:text-center">
                <div className="text-xs font-medium text-foreground">
                  {stage.label}
                </div>
                <div className="line-clamp-2 text-[11px] text-muted-foreground">
                  {stage.description}
                </div>
                {typeof ms === "number" && status === "succeeded" && (
                  <div className="mt-0.5 text-[10px] font-mono text-emerald-600">
                    {(ms / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StageNode({ index, status }: { index: number; status: StageStatus }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        status === "pending" && "border-border bg-muted text-muted-foreground",
        status === "running" &&
          "border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-100",
        status === "succeeded" &&
          "border-emerald-500 bg-emerald-50 text-emerald-700",
        status === "failed" && "border-red-500 bg-red-50 text-red-700",
      )}
    >
      {status === "running" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === "succeeded" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : status === "failed" ? (
        <XCircle className="h-4 w-4" />
      ) : (
        index
      )}
    </div>
  );
}
