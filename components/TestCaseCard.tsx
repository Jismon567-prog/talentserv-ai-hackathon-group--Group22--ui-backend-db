"use client";

/**
 * TestCaseCard
 * ------------
 * One card per generated TestCase: id, category, priority, scenario, the
 * touched OpenMRS entities + roles, and an expandable Steps + Expected
 * Result panel. Designed to look clean in a 2-column grid on the dashboard.
 *
 * Category and priority colour palettes are exported so other components
 * (e.g. a summary chip in the meta-test section) can reuse them.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { TestCase } from "@/lib/schemas";
import { cn } from "@/lib/utils";

import { CopyButton } from "./CopyButton";

export const TEST_CATEGORY_COLORS: Record<string, string> = {
  Functional: "bg-blue-100 text-blue-700 border-blue-200",
  Negative: "bg-amber-100 text-amber-800 border-amber-200",
  Validation: "bg-violet-100 text-violet-700 border-violet-200",
  Security: "bg-red-100 text-red-700 border-red-200",
  Privacy: "bg-pink-100 text-pink-700 border-pink-200",
  Audit: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const TEST_PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-blue-500 text-white",
  Low: "bg-zinc-400 text-white",
};

export interface TestCaseCardProps {
  testCase: TestCase;
  /** Optional: control the initial expanded state (default closed). */
  defaultExpanded?: boolean;
}

export function TestCaseCard({
  testCase,
  defaultExpanded = false,
}: TestCaseCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="rounded-lg border border-border bg-background p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header: ids + category + priority */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {testCase.id}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                TEST_CATEGORY_COLORS[testCase.category] ??
                  "border-zinc-200 bg-zinc-100 text-zinc-700",
              )}
            >
              {testCase.category}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                TEST_PRIORITY_COLORS[testCase.priority] ?? "bg-zinc-400 text-white",
              )}
            >
              {testCase.priority}
            </span>
          </div>
          <h3 className="text-sm font-medium leading-snug">
            {testCase.scenario}
          </h3>
        </div>
        <CopyButton
          getText={() => JSON.stringify(testCase, null, 2)}
          variant="icon"
        />
      </div>

      {/* Tag strip: clinical tags + OpenMRS entities + roles */}
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        {testCase.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded border border-border bg-background px-1.5 py-0.5 font-medium text-foreground/80"
          >
            #{tag}
          </span>
        ))}
        {testCase.openmrsRelevant.entities.slice(0, 6).map((e) => (
          <span
            key={e}
            className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
          >
            {e}
          </span>
        ))}
        {testCase.openmrsRelevant.roles.slice(0, 3).map((r) => (
          <span
            key={r}
            className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700"
          >
            {r}
          </span>
        ))}
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {testCase.steps.length} step{testCase.steps.length === 1 ? "" : "s"}
        {testCase.preconditions.length > 0 &&
          ` · ${testCase.preconditions.length} precondition${
            testCase.preconditions.length === 1 ? "" : "s"
          }`}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {testCase.preconditions.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preconditions
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {testCase.preconditions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Steps
            </div>
            <ol className="mt-1 space-y-2 text-xs">
              {testCase.steps.map((s) => (
                <li
                  key={s.step}
                  className="rounded border border-border bg-muted/30 p-2"
                >
                  <div className="font-medium">
                    {s.step}. {s.action}
                  </div>
                  <div className="text-muted-foreground">
                    Expected: {s.expected}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Expected result
            </div>
            <p className="mt-1 text-xs">{testCase.expectedResult}</p>
          </div>
          {testCase.traceabilityRef && (
            <p className="text-[11px] text-muted-foreground">
              Traceability:{" "}
              <span className="font-mono">{testCase.traceabilityRef}</span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
