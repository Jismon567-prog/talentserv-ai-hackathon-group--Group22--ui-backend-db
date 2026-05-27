/**
 * Multi-provider LLM client factory (OpenAI + Groq).
 * Both use the OpenAI SDK with different base URLs / API keys.
 */

import OpenAI from "openai";

import {
  getModelDefinition,
  type LlmModelId,
  type LlmProvider,
} from "./llm-models";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface ResolvedLlm {
  client: OpenAI;
  /** Provider API model id (e.g. gpt-4o-mini, llama-3.3-70b-versatile). */
  apiModel: string;
  provider: LlmProvider;
  modelId: LlmModelId;
}

export function createLlmClient(
  provider: LlmProvider,
  timeoutMs: number,
): OpenAI {
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Get a free key at https://console.groq.com and add it to .env.local.",
      );
    }
    return new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
      timeout: timeoutMs,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local and restart `next dev`.",
    );
  }
  return new OpenAI({
    apiKey,
    timeout: timeoutMs,
  });
}

/** Resolve dashboard model id → client + provider API model name. */
export function resolveLlm(
  modelId: LlmModelId,
  timeoutMs: number,
): ResolvedLlm {
  const def = getModelDefinition(modelId);
  return {
    client: createLlmClient(def.provider, timeoutMs),
    apiModel: def.apiModelId,
    provider: def.provider,
    modelId: modelId as LlmModelId,
  };
}
