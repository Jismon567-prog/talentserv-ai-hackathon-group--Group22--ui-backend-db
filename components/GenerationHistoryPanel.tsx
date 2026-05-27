"use client";

/**
 * GenerationHistoryPanel
 * ----------------------
 * Lists past agent runs from Supabase and lets the user reload one into
 * the main result view.
 */

import { Clock, History, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AgentOutput } from "@/lib/schemas";
import type { GenerationSummary } from "@/lib/history";
import { cn } from "@/lib/utils";

interface HistoryListResponse {
  ok: true;
  configured: boolean;
  items: GenerationSummary[];
}

interface HistoryDetailResponse {
  ok: true;
  data: AgentOutput;
}

interface HistoryErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

export interface GenerationHistoryPanelProps {
  /** Called when the user selects a past run to view. */
  onLoad: (output: AgentOutput, requirement: string) => void;
  /** Bump to refetch (e.g. after a new successful generation). */
  refreshKey?: number;
  /** Compact sidebar vs full-page history tab. */
  variant?: "sidebar" | "full";
  className?: string;
}

export function GenerationHistoryPanel({
  onLoad,
  refreshKey = 0,
  variant = "full",
  className,
}: GenerationHistoryPanelProps) {
  const [items, setItems] = useState<GenerationSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/history");
      const json = (await res.json()) as
        | HistoryListResponse
        | HistoryErrorResponse;

      if (!json.ok) {
        setError(json.error.message);
        setItems([]);
        return;
      }

      setConfigured(json.configured);
      setItems(json.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList, refreshKey]);

  async function handleSelect(item: GenerationSummary) {
    setLoadingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/agent/history/${item.id}`);
      const json = (await res.json()) as
        | HistoryDetailResponse
        | HistoryErrorResponse;

      if (!json.ok) {
        setError(json.error.message);
        return;
      }

      setActiveId(item.id);
      onLoad(json.data, item.requirement);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load generation.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  const isSidebar = variant === "sidebar";

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-background shadow-sm",
        isSidebar && "flex min-h-0 flex-col",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-medium">
            {isSidebar ? "Recent" : "Generation history"}
          </h2>
          {!loading && (
            <span className="text-xs text-muted-foreground">({items.length})</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchList()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="Refresh history"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div
        className={cn(
          "p-3",
          isSidebar && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        ) : !configured ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            History storage is not configured. Add Supabase env vars and run{" "}
            <code className="rounded bg-muted px-1">supabase/schema.sql</code>.
          </p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No saved generations yet. Run the agent to create your first entry.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isActive = activeId === item.id;
              const isLoading = loadingId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleSelect(item)}
                    disabled={isLoading}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "border-blue-300 bg-blue-50"
                        : "border-border bg-muted/20 hover:border-blue-200 hover:bg-blue-50/50",
                      isLoading && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-xs font-medium leading-snug">
                        {item.requirement}
                      </p>
                      {isLoading && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatWhen(item.createdAt)}
                      </span>
                      {item.model && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                          {item.model}
                        </span>
                      )}
                      <span>
                        {item.testCaseCount} test
                        {item.testCaseCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </div>
    </section>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
