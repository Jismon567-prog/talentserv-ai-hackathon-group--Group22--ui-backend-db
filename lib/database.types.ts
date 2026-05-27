/**
 * Supabase database types for the `generations` history table.
 */

/** JSON-compatible value stored in Supabase jsonb columns. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface GenerationRow {
  id: string;
  user_id: string;
  requirement: string;
  model: string | null;
  test_cases: Json;
  synthetic_data: Json;
  automation_skeleton: Json;
  coverage: Json | null;
  safety: Json | null;
  created_at: string;
}

export interface GenerationInsert {
  user_id: string;
  requirement: string;
  model?: string | null;
  test_cases: Json;
  synthetic_data: Json;
  automation_skeleton: Json;
  coverage?: Json | null;
  safety?: Json | null;
}
