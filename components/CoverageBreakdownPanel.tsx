/**
 * CoverageBreakdownPanel
 * ----------------------
 * Prominent coverage score, dimension breakdown, and missing-scenario guidance.
 */

"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Target,
} from "lucide-react";

import type { TestCaseValidationReport } from "@/lib/schemas";
import { coverageScoreTone } from "@/lib/coverage-engine";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  green: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ring: "ring-emerald-500/20",
    score: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  yellow: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    ring: "ring-amber-500/20",
    score: "text-amber-800",
    bar: "bg-amber-500",
  },
  red: {
    badge: "bg-red-100 text-red-800 border-red-200",
    ring: "ring-red-500/20",
    score: "text-red-700",
    bar: "bg-red-500",
  },
} as const;

export function CoverageScoreBadge({
  report,
  className,
}: {
  report: TestCaseValidationReport;
  className?: string;
}) {
  const score = report.coverageScore ?? 0;
  const tone = coverageScoreTone(score);
  const styles = TONE_STYLES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles.badge,
        className,
      )}
      title={`Coverage score ${score}%`}
    >
      <Target className="h-3.5 w-3.5" />
      Coverage {score}%
    </span>
  );
}

export function CoverageBreakdownPanel({
  report,
  compact = false,
}: {
  report: TestCaseValidationReport;
  compact?: boolean;
}) {
  const score = report.coverageScore ?? 0;
  const tone = coverageScoreTone(score);
  const styles = TONE_STYLES[tone];
  const breakdown = report.coverageBreakdown ?? [];
  const missing = report.missingScenarios ?? [];
  const coveredCount = breakdown.filter((a) => a.covered).length;

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-background shadow-sm ring-1",
        styles.ring,
      )}
    >
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Layers className={cn("h-5 w-5", styles.score)} />
              <h3 className="text-sm font-semibold">Test Coverage Analysis</h3>
              <CoverageScoreBadge report={report} />
            </div>
            <p className="text-sm text-muted-foreground">
              {coveredCount}/{breakdown.length} coverage areas met ·{" "}
              {Object.values(report.categoryCoverage).reduce((a, b) => a + b, 0)}{" "}
              total cases
            </p>
          </div>
          <div className="flex min-w-[8rem] flex-col items-end gap-1">
            <span className={cn("text-3xl font-bold tabular-nums", styles.score)}>
              {score}%
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Coverage score
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>{score >= 85 ? "Excellent" : score >= 70 ? "Adequate" : "Needs work"}</span>
            <span>100%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", styles.bar)}
              style={{ width: `${Math.min(100, score)}%` }}
            />
          </div>
        </div>
      </div>

      {!compact && breakdown.length > 0 && (
        <div className="border-b border-border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coverage breakdown
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {breakdown.map((area) => (
              <div
                key={area.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  area.covered
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {area.covered ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="truncate text-xs font-medium">{area.label}</span>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {area.count}/{area.minRequired}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Missing scenarios — recommendations
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
            {missing.slice(0, 12).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-600">•</span>
                <span>{item}</span>
              </li>
            ))}
            {missing.length > 12 && (
              <li className="text-xs text-amber-800">
                +{missing.length - 12} more recommendations in the validation panel
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
