import { Client } from "eve/client";
import type {
  ClientSessionState,
  InputResponse,
  MessageStreamEvent,
  StreamReconnectPolicy,
} from "eve/client";
import type { AgentContinuation, AgentInputResponse, AgentRunEvent } from "@agent-template/shared";
import { decodeEveContinuation, encodeEveContinuation } from "../protocol/continuation.js";
import { projectEveStreamEvent, projectEveTurn } from "../protocol/turn-projection.js";
import { toEveInputResponses } from "../protocol/input-responses.js";
import { isLoopbackEveHost } from "../security/trust-policy.js";

import type { EveAgentConfig } from "./config.js";

export {
  defaultEveAgentMaxReconnectAttempts,
  defaultEveAgentRequestTimeoutMs,
  EveAgentConfigSchema,
  getEveAgentRuntimeState,
  getEveAgentRuntimeStateFromEnv,
  parseEveAgentConfig,
  type EveAgentConfig,
  type EveAgentRuntimeState,
} from "./config.js";

export type EveAgentRunInput = {
  prompt?: string | undefined;
  continuation?: AgentContinuation | undefined;
  responses?: AgentInputResponse[] | undefined;
};

export type EveAgentRunResult =
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "completed" | "waiting";
      events: AgentRunEvent[];
      output: string;
      sessionId: string;
      continuation?: AgentContinuation;
    }
  | {
      status: "failed";
      events: AgentRunEvent[];
      reason: string;
      sessionId?: string;
      continuation?: AgentContinuation;
    };

type EveMessageResponse = AsyncIterable<MessageStreamEvent> & {
  readonly sessionId: string;
};

type EveTurnOptions = {
  signal?: AbortSignal;
  streamReconnectPolicy?: StreamReconnectPolicy;
};

type EveClientSession = {
  readonly state: ClientSessionState;
  send(message: string, options?: EveTurnOptions): Promise<EveMessageResponse>;
  respond(
    responses: readonly InputResponse[],
    options?: EveTurnOptions,
  ): Promise<EveMessageResponse>;
};

type EveClient = {
  readonly sessions: {
    attach(sessionId: string, options?: { streamIndex?: number }): EveClientSession;
    create(input: {
      message: string;
      signal?: AbortSignal;
      streamReconnectPolicy?: StreamReconnectPolicy;
    }): Promise<{ session: EveClientSession; response: EveMessageResponse }>;
  };
};

function readEveTurnOptions(config: EveAgentConfig): EveTurnOptions {
  return {
    streamReconnectPolicy: {
      streamOpenReconnectPolicy: {
        maxAttempts: Math.max(config.maxReconnectAttempts, 1),
      },
      streamIdleReconnectPolicy: {
        maxAttempts: config.maxReconnectAttempts,
      },
    },
  };
}

export async function runEveAgent(
  input: EveAgentRunInput,
  config: EveAgentConfig,
  options: {
    createClient?: (host: string, config: EveAgentConfig) => EveClient;
    onEvent?: (event: AgentRunEvent) => void;
  } = {},
): Promise<EveAgentRunResult> {
  if (!config.host) {
    return { status: "skipped", reason: "EVE_AGENT_HOST is not configured" };
  }

  if (!isLoopbackEveHost(config.host) && !config.serviceToken) {
    return {
      status: "skipped",
      reason: "EVE_AGENT_SERVICE_TOKEN is required for a non-loopback Eve Agent host",
    };
  }

  let initialState: ClientSessionState | undefined;
  try {
    initialState = decodeEveContinuation(input.continuation);
  } catch (caught) {
    return createFailedResult(formatCaughtError(caught), options.onEvent);
  }

  if (!initialState && !input.prompt) {
    return createFailedResult(
      "An Eve Agent run requires a prompt or input responses",
      options.onEvent,
    );
  }

  const client = (options.createClient ?? createEveClient)(config.host, config);
  const events: AgentRunEvent[] = [];
  const rawEvents: MessageStreamEvent[] = [];
  const projectionState = { messageText: "" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let session: EveClientSession | undefined;
  let response: EveMessageResponse | undefined;

  try {
    const inputResponses = input.responses ? toEveInputResponses(input.responses) : undefined;
    const turnOptions = {
      ...readEveTurnOptions(config),
      signal: controller.signal,
    };

    if (initialState) {
      session = client.sessions.attach(initialState.sessionId, {
        streamIndex: initialState.streamIndex,
      });
      response = inputResponses
        ? await session.respond(inputResponses, turnOptions)
        : await session.send(input.prompt ?? "", turnOptions);
    } else {
      const created = await client.sessions.create({
        message: input.prompt ?? "",
        signal: controller.signal,
        ...readEveTurnOptions(config),
      });
      session = created.session;
      response = created.response;
    }

    for await (const rawEvent of response) {
      rawEvents.push(rawEvent);
      for (const event of projectEveStreamEvent(rawEvent, projectionState)) {
        emitEvent(events, event, options.onEvent);
      }
    }
  } catch (caught) {
    const reason = formatCaughtError(caught);
    emitErrorOnce(events, reason, options.onEvent);
    const continuation = session ? encodeEveContinuation(session.state) : undefined;

    return {
      status: "failed",
      events,
      reason,
      ...(response ? { sessionId: response.sessionId } : {}),
      ...(continuation ? { continuation } : {}),
    };
  } finally {
    clearTimeout(timeout);
  }

  const projected = projectEveTurn(rawEvents);
  const continuation = encodeEveContinuation(session.state);

  if (!projected) {
    const reason = "Eve Agent stream ended without a session boundary";
    emitErrorOnce(events, reason, options.onEvent);
    return {
      status: "failed",
      events,
      reason,
      sessionId: session.state.sessionId,
      ...(continuation ? { continuation } : {}),
    };
  }

  if (projected.status === "failed") {
    emitErrorOnce(events, projected.reason, options.onEvent);
    return {
      status: "failed",
      events,
      reason: projected.reason,
      sessionId: session.state.sessionId,
      ...(continuation ? { continuation } : {}),
    };
  }

  if (projected.output) {
    emitEvent(events, { kind: "done", result: projected.output }, options.onEvent);
  }

  return {
    status: projected.status,
    events,
    output: projected.output,
    sessionId: session.state.sessionId,
    ...(continuation ? { continuation } : {}),
  };
}

function createEveClient(host: string, config: EveAgentConfig): EveClient {
  return new Client({
    host,
    redirect: "error",
    ...(config.serviceToken
      ? {
          headers: {
            "x-agent-template-eve-token": config.serviceToken,
          },
        }
      : {}),
  }) as EveClient;
}

function createFailedResult(
  reason: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
): EveAgentRunResult {
  const event = { kind: "error", message: reason } satisfies AgentRunEvent;
  onEvent?.(event);
  return { status: "failed", events: [event], reason };
}

function emitEvent(
  events: AgentRunEvent[],
  event: AgentRunEvent,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
) {
  events.push(event);
  onEvent?.(event);
}

function emitErrorOnce(
  events: AgentRunEvent[],
  message: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
) {
  if (!events.some((event) => event.kind === "error" && event.message === message)) {
    emitEvent(events, { kind: "error", message }, onEvent);
  }
}

function formatCaughtError(caught: unknown) {
  if (caught instanceof Error && caught.name === "AbortError") {
    return "Eve Agent request timed out";
  }

  return caught instanceof Error ? caught.message : "Eve Agent request failed";
}
