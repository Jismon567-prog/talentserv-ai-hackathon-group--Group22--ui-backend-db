"use client";

/**
 * StageProgress
 * -------------
 * Six-step pipeline stepper with progress bar, elapsed time, and stage hints.
 */

import {
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type StageStatus = "pending" | "running" | "succeeded" | "failed";

export interface StageMeta {
  id: string;
  label: string;
  description: string;
}

export const STAGES: StageMeta[] = [
  {
    id: "requirement-analyzer",
    label: "Analyze",
    description: "Parse requirement into OpenMRS workflows.",
  },
  {
    id: "risk-and-privacy-planner",
    label: "Risk Plan",
    description: "PHI inventory, RBAC, and threats.",
  },
  {
    id: "test-case-generator",
    label: "Test Cases",
    description: "Functional, security, privacy, audit cases.",
  },
  {
    id: "synthetic-data-generator",
    label: "Synthetic Data",
    description: "Patients, users, visits (instant).",
  },
  {
    id: "automation-skeleton-writer",
    label: "Automation",
    description: "Playwright + REST skeleton (instant).",
  },
  {
    id: "coverage-and-safety-reviewer",
    label: "Review",
    description: "Coverage, safety, and QA validation.",
  },
];

/** Heuristic timeline while the single POST is in flight (~45–90s, 2 LLM calls). */
export const HEURISTIC_STAGE_END_MS = [
  8_000,
  9_000,
  55_000,
  56_000,
  57_000,
  58_000,
];

export const ESTIMATED_TOTAL_MS = 75_000;
export const SLOW_GENERATION_MS = 65_000;

export interface StageProgressProps {
  statuses: Record<string, StageStatus>;
  loading: boolean;
  durations?: Record<string, number | undefined>;
  startedAt?: number;
}

export function StageProgress({
  statuses,
  loading,
  durations,
  startedAt,
}: StageProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!loading || !startedAt) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [loading, startedAt]);

  const completed = STAGES.filter((s) => statuses[s.id] === "succeeded").length;
  const failed = STAGES.some((s) => statuses[s.id] === "failed");
  const runningStage = STAGES.find((s) => statuses[s.id] === "running");
  const progressPct = Math.min(
    100,
    loading
      ? Math.max(
          8,
          Math.round((elapsedMs / ESTIMATED_TOTAL_MS) * 92),
        )
      : failed
        ? Math.round((completed / STAGES.length) * 100)
        : 100,
  );

  const overall = failed
    ? "failed"
    : completed === STAGES.length && !loading
      ? "complete"
      : loading
        ? "running"
        : "pending";

  const slowWarning = loading && elapsedMs >= SLOW_GENERATION_MS;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-background to-blue-50/40 shadow-sm">
      <div className="border-b border-border/80 bg-background/80 px-5 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <Activity className="h-4 w-4 text-blue-600" />
            )}
            <div>
              <h2 className="text-sm font-semibold">
                {loading ? "Generating your test plan…" : "Pipeline status"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {loading && runningStage
                  ? `Step ${completed + 1} of ${STAGES.length}: ${runningStage.label}`
                  : overall === "complete"
                    ? "All stages finished"
                    : overall === "failed"
                      ? "Pipeline stopped — see error below"
                      : "Ready to run"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {loading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-800">
                <Clock className="h-3 w-3" />
                {(elapsedMs / 1000).toFixed(0)}s
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              ~{Math.round(ESTIMATED_TOTAL_MS / 1000)}s typical
            </span>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              failed ? "bg-red-500" : "bg-blue-600",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{completed}/{STAGES.length} stages</span>
          <span>{progressPct}%</span>
        </div>
        {loading && slowWarning && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Generation is taking longer than expected (~{Math.round(ESTIMATED_TOTAL_MS / 1000)}s typical).
            Still working — large requirements or free-tier models may need extra time.
          </p>
        )}
      </div>

      <ol className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, i) => {
          const status = statuses[stage.id] ?? "pending";
          const ms = durations?.[stage.id];
          return (
            <li
              key={stage.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                status === "running" &&
                  "border-blue-300 bg-blue-50/80 ring-1 ring-blue-200",
                status === "succeeded" &&
                  "border-emerald-200 bg-emerald-50/50",
                status === "failed" && "border-red-200 bg-red-50/50",
                status === "pending" && "border-border bg-background/60",
              )}
            >
              <StageNode index={i + 1} status={status} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">
                  {stage.label}
                </div>
                <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {stage.description}
                </div>
                {typeof ms === "number" && status === "succeeded" && (
                  <div className="mt-0.5 text-[10px] font-mono text-emerald-700">
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
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
        status === "pending" && "border-border bg-muted text-muted-foreground",
        status === "running" &&
          "border-blue-500 bg-blue-600 text-white shadow-sm",
        status === "succeeded" &&
          "border-emerald-500 bg-emerald-600 text-white",
        status === "failed" && "border-red-500 bg-red-600 text-white",
      )}
    >
      {status === "running" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === "succeeded" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status === "failed" ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : (
        index
      )}
    </div>
  );
}
