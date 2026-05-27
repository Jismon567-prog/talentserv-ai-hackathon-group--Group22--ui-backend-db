"use client";

/**
 * CopyButton
 * ----------
 * Small button that writes a string to the clipboard and shows a 1.8s
 * "Copied!" confirmation. Used by every artifact view in the dashboard.
 *
 * Variants:
 *   - default : bordered button with an icon + optional label
 *   - ghost   : flat, no border (for placement inside toolbars / headers)
 *   - icon    : compact, icon-only (for inline placement on cards)
 *
 * Tone "dark" gives correct contrast against zinc-950 code-block headers.
 */

import { CheckCircle2, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  /** Lazy text producer — called only when the user clicks Copy. */
  getText: () => string;
  /** Optional label override; default is "Copy"/"Copied!". */
  label?: string;
  variant?: "default" | "ghost" | "icon";
  tone?: "light" | "dark";
  /** Extra Tailwind classes for callers that need spacing tweaks. */
  className?: string;
}

export function CopyButton({
  getText,
  label,
  variant = "default",
  tone = "light",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending "reset copied" timer on unmount so we don't (a) call
  // setCopied on a no-longer-mounted component and (b) keep the timer's
  // closure alive in the timer queue after the user navigates away. The
  // empty dep array ensures the cleanup runs exactly once, on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        // Drop the handle so the ref doesn't keep a stale id around once the
        // timer has fired naturally.
        timer.current = null;
      }, 1800);
    } catch {
      // Clipboard API can fail in non-secure contexts; silently ignore.
    }
  }

  const base =
    variant === "icon"
      ? "inline-flex h-7 w-7 items-center justify-center rounded-md"
      : "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium";

  const colors =
    tone === "dark"
      ? "border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
      : variant === "ghost"
        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
        : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(base, colors, className)}
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <CheckCircle2
          className={cn(
            "h-3.5 w-3.5",
            tone === "dark" ? "text-emerald-400" : "text-emerald-600",
          )}
        />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {variant !== "icon" && (label ?? (copied ? "Copied!" : "Copy"))}
    </button>
  );
}
