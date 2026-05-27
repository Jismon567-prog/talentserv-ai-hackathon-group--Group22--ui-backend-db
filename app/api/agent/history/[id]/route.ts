/**
 * GET /api/agent/history/[id]
 * ---------------------------
 * Loads a single persisted generation for the signed-in Clerk user.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  generationRecordToAgentOutput,
  getGenerationById,
} from "@/lib/history";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SUPABASE_NOT_CONFIGURED",
          message: "History storage is not configured.",
        },
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;

  try {
    const record = await getGenerationById(userId, id);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Generation not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      record,
      data: generationRecordToAgentOutput(record),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load generation.";
    return NextResponse.json(
      { ok: false, error: { code: "HISTORY_LOAD_FAILED", message } },
      { status: 500 },
    );
  }
}
