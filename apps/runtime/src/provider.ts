import { createAnthropic } from "@ai-sdk/anthropic";
import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import { readEveAgentModel } from "@agent-template/agent-eve/config";

export const defaultEveModelContextWindowTokens = 128_000;
export const defaultEveMaxInputTokensPerSession = 1_000_000;
export const defaultEveMaxOutputTokensPerSession = 100_000;
export const defaultEveCompactionThreshold = 0.75;
export const defaultEveAnthropicBaseURL = "http://127.0.0.1:3425/v1";
export const defaultEveMaxOutputTokens = 1024;

export function readEveAnthropicBaseURL(
  input: Record<string, unknown>,
): string {
  if (
    typeof input.ANTHROPIC_BASE_URL !== "string" ||
    input.ANTHROPIC_BASE_URL.length === 0
  ) {
    return defaultEveAnthropicBaseURL;
  }

  return input.ANTHROPIC_BASE_URL.replace(/\/$/, "").endsWith("/v1")
    ? input.ANTHROPIC_BASE_URL.replace(/\/$/, "")
    : `${input.ANTHROPIC_BASE_URL.replace(/\/$/, "")}/v1`;
}

export function createEveAnthropicModel(
  input: Record<string, unknown>,
): LanguageModel {
  const baseURL = readEveAnthropicBaseURL(input);
  const authToken =
    typeof input.ANTHROPIC_API_KEY === "string" &&
    input.ANTHROPIC_API_KEY.length > 0
      ? input.ANTHROPIC_API_KEY
      : typeof input.ANTHROPIC_AUTH_TOKEN === "string" &&
          input.ANTHROPIC_AUTH_TOKEN.length > 0
        ? input.ANTHROPIC_AUTH_TOKEN
        : undefined;
  const anthropic = createAnthropic({
    ...(authToken ? { apiKey: authToken } : {}),
    baseURL,
    headers: { "anthropic-version": "2023-06-01" },
  });

  return wrapLanguageModel({
    model: anthropic(readEveAgentModel(input)),
    middleware: defaultSettingsMiddleware({
      settings: {
        maxOutputTokens: readPositiveInteger(
          input.EVE_MAX_OUTPUT_TOKENS,
          defaultEveMaxOutputTokens,
        ),
      },
    }),
  });
}

export function readEveAgentRuntimeLimits(input: Record<string, unknown>) {
  return {
    compactionThreshold: readRatio(
      input.EVE_COMPACTION_THRESHOLD,
      defaultEveCompactionThreshold,
    ),
    maxInputTokensPerSession: readPositiveInteger(
      input.EVE_MAX_INPUT_TOKENS_PER_SESSION,
      defaultEveMaxInputTokensPerSession,
    ),
    maxOutputTokensPerSession: readPositiveInteger(
      input.EVE_MAX_OUTPUT_TOKENS_PER_SESSION,
      defaultEveMaxOutputTokensPerSession,
    ),
    modelContextWindowTokens: readPositiveInteger(
      input.EVE_MODEL_CONTEXT_WINDOW_TOKENS,
      defaultEveModelContextWindowTokens,
    ),
  };
}

function readPositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readRatio(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1
    ? parsed
    : fallback;
}
