/**
 * LLM model catalog for the six-stage agent pipeline.
 * Shared by the API route (validation + routing) and dashboard (selector).
 */

export type LlmProvider = "openai" | "groq";
export type LlmTier = "paid" | "free";

export interface LlmModelDefinition {
  /** Stable id sent in API requests and stored in history. */
  id: string;
  label: string;
  description: string;
  provider: LlmProvider;
  /** Model id passed to the provider's chat completions API. */
  apiModelId: string;
  tier: LlmTier;
  recommended?: boolean;
}

export const LLM_MODELS: readonly LlmModelDefinition[] = [
  // ---- OpenAI (paid) ----------------------------------------------------
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Best Quality",
    provider: "openai",
    apiModelId: "gpt-4o",
    tier: "paid",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Fast & Cheap — Recommended",
    provider: "openai",
    apiModelId: "gpt-4o-mini",
    tier: "paid",
    recommended: true,
  },
  {
    id: "gpt-3.5-turbo",
    label: "GPT-3.5 Turbo",
    description: "Very Fast",
    provider: "openai",
    apiModelId: "gpt-3.5-turbo",
    tier: "paid",
  },
  // ---- Groq (free tier — https://console.groq.com) ----------------------
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "Free — Best quality",
    provider: "groq",
    apiModelId: "llama-3.3-70b-versatile",
    tier: "free",
    recommended: true,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Free — Fastest",
    provider: "groq",
    apiModelId: "llama-3.1-8b-instant",
    tier: "free",
  },
  {
    id: "llama-3.1-70b-versatile",
    label: "Llama 3.1 70B",
    description: "Free — Balanced",
    provider: "groq",
    apiModelId: "llama-3.1-70b-versatile",
    tier: "free",
  },
  {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Free — Lightweight",
    provider: "groq",
    apiModelId: "gemma2-9b-it",
    tier: "free",
  },
] as const;

export type LlmModelId = (typeof LLM_MODELS)[number]["id"];

export const ALLOWED_LLM_MODEL_IDS = LLM_MODELS.map((m) => m.id) as [
  LlmModelId,
  ...LlmModelId[],
];

/** Default when the client omits `model` in the request body. */
export const DEFAULT_LLM_MODEL: LlmModelId = "gpt-4o-mini";

export const LLM_MODEL_GROUPS = [
  {
    label: "OpenAI — Paid",
    tier: "paid" as const,
    models: LLM_MODELS.filter((m) => m.tier === "paid"),
  },
  {
    label: "Groq — Free tier",
    tier: "free" as const,
    models: LLM_MODELS.filter((m) => m.tier === "free"),
  },
] as const;

const MODEL_BY_ID = new Map<string, LlmModelDefinition>(
  LLM_MODELS.map((m) => [m.id, m]),
);

export function getModelDefinition(modelId: string): LlmModelDefinition {
  const def = MODEL_BY_ID.get(modelId);
  if (!def) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return def;
}

export function getProviderLabel(provider: LlmProvider): string {
  return provider === "groq" ? "Groq" : "OpenAI";
}
