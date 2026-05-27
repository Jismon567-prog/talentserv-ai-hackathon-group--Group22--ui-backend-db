"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Info,
  RefreshCw,
  XCircle,
} from "lucide-react";

import type { TestCaseValidationReport } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { validationScoreTone } from "@/lib/validator";

const TONE_STYLES = {
  green: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ring: "ring-emerald-500/20",
    score: "text-emerald-700",
  },
  yellow: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    ring: "ring-amber-500/20",
    score: "text-amber-800",
  },
  red: {
    badge: "bg-red-100 text-red-800 border-red-200",
    ring: "ring-red-500/20",
    score: "text-red-700",
  },
} as const;

const SEVERITY_ICON = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_STYLES = {
  critical: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
} as const;

export function ValidationScoreBadge({
  report,
  className,
}: {
  report: TestCaseValidationReport;
  className?: string;
}) {
  const tone = validationScoreTone(report.score);
  const styles = TONE_STYLES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles.badge,
        className,
      )}
      title={report.summary}
    >
      <ClipboardCheck className="h-3.5 w-3.5" />
      QA {report.score}/100
    </span>
  );
}

export function ValidationReportPanel({
  report,
  onRevalidate,
  revalidating = false,
  compact = false,
  defaultCollapsed,
}: {
  report: TestCaseValidationReport;
  onRevalidate?: () => void;
  revalidating?: boolean;
  compact?: boolean;
  defaultCollapsed?: boolean;
}) {
  const tone = validationScoreTone(report.score);
  const styles = TONE_STYLES[tone];
  const failedChecks = report.checks.filter((c) => !c.passed);
  const passedChecks = report.checks.filter((c) => c.passed);
  const collapsedByDefault =
    defaultCollapsed ?? (report.score >= 80 && report.passed);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-background shadow-sm ring-1",
        styles.ring,
      )}
    >
      {/* Header + action — outside <details> so the button does not toggle the panel */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardCheck className={cn("h-5 w-5", styles.score)} />
            <h3 className="text-sm font-semibold">Test Case Quality Validation</h3>
            <ValidationScoreBadge report={report} />
            {report.passed ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs improvement
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
          <p className="text-[10px] text-muted-foreground">
            Validated{" "}
            {new Date(report.generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        {onRevalidate && (
          <button
            type="button"
            onClick={onRevalidate}
            disabled={revalidating}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", revalidating && "animate-spin")}
            />
            {revalidating ? "Re-validating…" : "Re-validate"}
          </button>
        )}
      </div>

      <details className="group" open={!collapsedByDefault}>
        <summary className="cursor-pointer list-none border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          {collapsedByDefault ? "Show validation details" : "Hide validation details"}
        </summary>

        {!compact && (
          <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(report.categoryCoverage).map(([category, count]) => (
              <div
                key={category}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <p className="text-lg font-semibold tabular-nums">{count}</p>
              </div>
            ))}
          </div>
        )}

        {report.suggestions.length > 0 && (
          <div className="border-b border-border bg-amber-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Suggestions
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
              {report.suggestions.map((suggestion) => (
                <li key={suggestion} className="flex gap-2">
                  <span className="text-amber-600">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Validation checks ({passedChecks.length}/{report.checks.length} passed)
          </p>
          <div className="space-y-2">
            {failedChecks.length > 0 && (
              <CheckGroup title="Issues" checks={failedChecks} defaultOpen />
            )}
            {!compact && passedChecks.length > 0 && (
              <CheckGroup title="Passed checks" checks={passedChecks} defaultOpen={false} />
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function CheckGroup({
  title,
  checks,
  defaultOpen,
}: {
  title: string;
  checks: TestCaseValidationReport["checks"];
  defaultOpen: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
        {title} ({checks.length})
      </summary>
      <ul className="space-y-2 border-t border-border px-3 py-3">
        {checks.map((check) => {
          const Icon = SEVERITY_ICON[check.severity];
          return (
            <li
              key={check.id}
              className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    check.passed ? "text-emerald-600" : SEVERITY_STYLES[check.severity],
                  )}
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{check.label}</p>
                  <p className="text-muted-foreground">{check.message}</p>
                  {check.suggestion && !check.passed && (
                    <p className="text-xs text-amber-800">{check.suggestion}</p>
                  )}
                  {check.testCaseIds && check.testCaseIds.length > 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Cases: {check.testCaseIds.slice(0, 6).join(", ")}
                      {check.testCaseIds.length > 6 ? "…" : ""}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
