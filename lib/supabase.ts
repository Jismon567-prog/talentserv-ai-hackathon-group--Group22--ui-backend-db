/**
 * Supabase server client
 * ----------------------
 * Used from API routes only. Writes use the service-role key so we can
 * associate rows with Clerk `userId` without Supabase Auth.
 *
 * IMPORTANT: Use the **service_role** secret from Supabase → Project Settings
 * → API. Do NOT use the anon/public key — it is subject to RLS and will fail
 * with "new row violates row-level security policy".
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAdmin = SupabaseClient;

/** True when both URL and service-role key are configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Warn if the JWT role claim is `anon` (wrong key pasted into service role env). */
function assertServiceRoleKey(key: string): void {
  try {
    const segment = key.split(".")[1];
    if (!segment) return;
    const payload = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    ) as { role?: string };
    if (payload.role === "anon") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is the anon/public key. In Supabase → Project Settings → API, copy the service_role secret (not the anon key) into .env.local.",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw err;
    }
    // Non-JWT or unparsable — skip validation.
  }
}

/**
 * Admin client for trusted server-side reads/writes.
 * Throws if env vars are missing — callers should use `isSupabaseConfigured()`
 * for graceful degradation.
 */
export function getSupabaseAdmin(): SupabaseAdmin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run supabase/schema.sql.",
    );
  }

  assertServiceRoleKey(serviceRoleKey);

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
