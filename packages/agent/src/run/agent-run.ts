import { z } from "zod";
import {
  getEveAgentRuntimeStateFromEnv,
  parseEveAgentConfig,
  runEveAgent,
} from "@agent-template/agent-eve";
import {
  AgentRunInputSchema,
  type AgentRunEvent,
  type AgentRunResult,
} from "@agent-template/shared";

export type { AgentRunResult };

export const AgentRuntimeEnvSchema = z.object({
  EVE_AGENT_HOST: z.string().optional(),
  EVE_AGENT_MAX_RECONNECT_ATTEMPTS: z.coerce.number().int().nonnegative().optional(),
  EVE_AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  EVE_AGENT_SERVICE_TOKEN: z.string().optional(),
});

export type AgentRuntimeEnv = z.infer<typeof AgentRuntimeEnvSchema>;

export type AgentRuntimeState = {
  runtime: "eve";
  configured: boolean;
};

export type RunAgentOptions = {
  runEve?: typeof runEveAgent;
  onEvent?: (event: AgentRunEvent) => void;
  signal?: AbortSignal;
};

export function parseAgentRuntimeEnv(input: Record<string, unknown>): AgentRuntimeEnv {
  return AgentRuntimeEnvSchema.parse(input);
}

export function getAgentRuntimeStateFromEnv(input: Record<string, unknown>): AgentRuntimeState {
  return {
    runtime: "eve",
    ...getEveAgentRuntimeStateFromEnv(parseAgentRuntimeEnv(input)),
  };
}

export async function runAgent(
  input: unknown,
  env: Record<string, unknown>,
  options: RunAgentOptions = {},
): Promise<AgentRunResult> {
  const parsed = AgentRunInputSchema.parse(input);
  const runtimeEnv = parseAgentRuntimeEnv(env);
  const agentState = getAgentRuntimeStateFromEnv(runtimeEnv);

  const run = await (options.runEve ?? runEveAgent)(parsed, parseEveAgentConfig(runtimeEnv), {
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  return {
    promptLength: parsed.prompt?.length ?? 0,
    runtime: agentState.runtime,
    configured: agentState.configured,
    status: run.status,
    ...("events" in run ? { events: [...run.events] } : {}),
    ...("output" in run ? { output: run.output } : {}),
    ...("reason" in run ? { reason: run.reason } : {}),
    ...("sessionId" in run ? { sessionId: run.sessionId } : {}),
    ...("continuation" in run ? { continuation: run.continuation } : {}),
  };
}
