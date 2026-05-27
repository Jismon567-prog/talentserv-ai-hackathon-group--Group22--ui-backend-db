"use client";

/**
 * SelfTestsPanel — meta-testing view for the AI agent itself.
 * Used on the dashboard (compact) and the dedicated /dashboard/agent-tests page.
 */

import { ChevronDown, ChevronRight, TestTube2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AGENT_SELF_TESTS,
  AGENT_SELF_TEST_CATEGORY_COLORS,
  type AgentSelfTest,
} from "@/lib/agent-self-tests";
import { cn } from "@/lib/utils";

export interface SelfTestsPanelProps {
  /** Show all tests expanded (dedicated page) vs collapsible summary (dashboard). */
  variant?: "compact" | "full";
  /** Optional subset; defaults to all AGENT_SELF_TESTS. */
  tests?: AgentSelfTest[];
}

export function SelfTestsPanel({
  variant = "compact",
  tests = AGENT_SELF_TESTS,
}: SelfTestsPanelProps) {
  const [open, setOpen] = useState(variant === "full");

  if (variant === "full") {
    return (
      <div className="space-y-6">
        <header className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <TestTube2 className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Agent QA — Meta Testing</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                These {tests.length} test cases document how we validate the
                OpenMRS AI Healthcare Test Automation Agent itself — input
                validation, auth, synthetic-data safety, schema enforcement,
                retry behaviour, and export integrity. They mirror the same
                Given / When / Then structure the agent produces for clinical
                workflows.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {(
              [
                "Validation",
                "Privacy",
                "Security",
                "Functional",
                "Safety",
                "Audit",
              ] as const
            ).map((cat) => {
              const count = tests.filter((t) => t.category === cat).length;
              if (count === 0) return null;
              return (
                <span
                  key={cat}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-medium",
                    AGENT_SELF_TEST_CATEGORY_COLORS[cat],
                  )}
                >
                  {cat}: {count}
                </span>
              );
            })}
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((t) => (
            <SelfTestCard key={t.id} test={t} defaultExpanded />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <TestTube2 className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-medium">
            How we test the agent itself{" "}
            <span className="ml-1 text-muted-foreground">
              ({tests.length} meta-tests)
            </span>
          </h2>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <p className="mb-4 text-xs text-muted-foreground">
            Quality gates for the pipeline — auth, schema validation, synthetic
            data safety, and export integrity.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {tests.slice(0, 4).map((t) => (
              <SelfTestCard key={t.id} test={t} />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/dashboard/agent-tests"
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              View all {tests.length} agent QA test cases →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function SelfTestCard({
  test,
  defaultExpanded = false,
}: {
  test: AgentSelfTest;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {test.id}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            AGENT_SELF_TEST_CATEGORY_COLORS[test.category],
          )}
        >
          {test.category}
        </span>
        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {test.priority}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-medium leading-snug">{test.scenario}</h3>

      {!defaultExpanded && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Details
        </button>
      )}

      {(expanded || defaultExpanded) && (
        <dl className="mt-2 space-y-1 text-xs">
          <Field term="Given" desc={test.given} />
          <Field term="When" desc={test.when} />
          <Field term="Then" desc={test.then} />
        </dl>
      )}

      {(expanded || defaultExpanded) && (
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Evidence: {test.evidence}
        </p>
      )}
    </article>
  );
}

function Field({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-semibold text-muted-foreground">{term}:</dt>
      <dd className="min-w-0">{desc}</dd>
    </div>
  );
}
