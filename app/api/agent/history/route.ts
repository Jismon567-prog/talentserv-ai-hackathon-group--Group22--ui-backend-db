/**
 * GET /api/agent/history
 * ----------------------
 * Returns recent generation summaries for the signed-in Clerk user.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { listGenerations } from "@/lib/history";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      items: [] as const,
    });
  }

  try {
    const items = await listGenerations(userId);
    return NextResponse.json({ ok: true, configured: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load history.";
    return NextResponse.json(
      { ok: false, error: { code: "HISTORY_LOAD_FAILED", message } },
      { status: 500 },
    );
  }
}
