"use client";

/**
 * CodeBlock
 * ---------
 * Dark, line-numbered code panel with a header that shows the title +
 * language pill and a Copy button. Used for the Stage 5 automation
 * skeleton (Playwright UI + REST API examples) but is intentionally
 * generic so the meta-test view can reuse it for short examples too.
 */

import { Code2 } from "lucide-react";
import { useMemo } from "react";

import { CopyButton } from "./CopyButton";

export interface CodeBlockProps {
  /** File or block title (e.g. "Playwright — UI test"). */
  title: string;
  /** Language label shown as a pill; also helps future syntax highlighting. */
  language: string;
  /** The code itself. Will be split on newlines for line numbering. */
  code: string;
  /** Optional list of Test Case ids this block implements. */
  implementsList?: string[];
  /** Hard cap on the visible area before the block scrolls. */
  maxHeightClass?: string;
}

export function CodeBlock({
  title,
  language,
  code,
  implementsList,
  maxHeightClass = "max-h-[28rem]",
}: CodeBlockProps) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-zinc-400" />
          <span className="truncate font-mono">{title}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">
            {language}
          </span>
        </div>
        <CopyButton
          label="Copy"
          getText={() => code}
          variant="ghost"
          tone="dark"
        />
      </div>

      {implementsList && implementsList.length > 0 && (
        <div className="border-b border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-400">
          implements:{" "}
          {implementsList.map((id) => (
            <span
              key={id}
              className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono"
            >
              {id}
            </span>
          ))}
        </div>
      )}

      <div className={`${maxHeightClass} overflow-auto`}>
        <pre className="grid grid-cols-[auto_1fr] gap-x-4 px-3 py-3 text-xs leading-relaxed">
          <div className="select-none text-right text-zinc-600">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <code className="whitespace-pre font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}
