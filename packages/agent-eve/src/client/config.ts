import { z } from "zod";
import { isLoopbackEveHost } from "../security/trust-policy.js";

export const defaultEveAgentMaxReconnectAttempts = 5;
export const defaultEveAgentRequestTimeoutMs = 120_000;

export const EveAgentConfigSchema = z.object({
  host: z.string().url().optional(),
  maxReconnectAttempts: z.number().int().nonnegative().default(defaultEveAgentMaxReconnectAttempts),
  requestTimeoutMs: z.number().int().positive().default(defaultEveAgentRequestTimeoutMs),
  serviceToken: z.string().min(1).optional(),
});

export type EveAgentConfig = z.infer<typeof EveAgentConfigSchema>;

export type EveAgentRuntimeState = {
  configured: boolean;
  host?: string;
};

export function parseEveAgentConfig(input: Record<string, unknown>): EveAgentConfig {
  return EveAgentConfigSchema.parse({
    host: readNonEmptyString(input.EVE_AGENT_HOST),
    maxReconnectAttempts: readNumber(
      input.EVE_AGENT_MAX_RECONNECT_ATTEMPTS,
      defaultEveAgentMaxReconnectAttempts,
    ),
    requestTimeoutMs: readNumber(
      input.EVE_AGENT_REQUEST_TIMEOUT_MS,
      defaultEveAgentRequestTimeoutMs,
    ),
    serviceToken: readNonEmptyString(input.EVE_AGENT_SERVICE_TOKEN),
  });
}

export function getEveAgentRuntimeState(config: EveAgentConfig): EveAgentRuntimeState {
  return {
    configured: Boolean(config.host && (isLoopbackEveHost(config.host) || config.serviceToken)),
    ...(config.host ? { host: config.host } : {}),
  };
}

export function getEveAgentRuntimeStateFromEnv(
  input: Record<string, unknown>,
): EveAgentRuntimeState {
  return getEveAgentRuntimeState(parseEveAgentConfig(input));
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown, fallback: number) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return typeof value === "number" ? value : Number(value);
}
