import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { MessageStreamEvent } from "eve/client";
import {
  defaultEveAgentMaxReconnectAttempts,
  defaultEveAgentModel,
  eveAgentDirectory,
  getEveAgentRuntimeStateFromEnv,
  parseEveAgentConfig,
  readEveAnthropicBaseURL,
  readEveAgentModel,
  runEveAgent,
} from "./index.js";
import { encodeEveContinuation } from "./eve-continuation.js";

const meta = { at: "2026-10-18T00:00:00.000Z", id: "evt_1" };

function streamEvent<TType extends MessageStreamEvent["type"]>(
  event: Omit<Extract<MessageStreamEvent, { type: TType }>, "meta">,
): MessageStreamEvent {
  return { ...event, meta } as MessageStreamEvent;
}

function responseOf(
  sessionId: string,
  events: MessageStreamEvent[],
): AsyncIterable<MessageStreamEvent> & { sessionId: string } {
  return {
    sessionId,
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
  };
}

describe("Eve Agent runtime", () => {
  it("points at the package-local authored surface", () => {
    const state = getEveAgentRuntimeStateFromEnv({});

    expect(state.configured).toBe(false);
    expect(state.authoredSurface).toBe(eveAgentDirectory);
  });

  it("is configured when the Eve Agent host is set", () => {
    const config = parseEveAgentConfig({
      EVE_AGENT_HOST: "http://127.0.0.1:13000",
      EVE_AGENT_SERVICE_TOKEN: "service-token",
    });
    const state = getEveAgentRuntimeStateFromEnv({
      EVE_AGENT_HOST: "http://127.0.0.1:13000",
    });

    expect(config.serviceToken).toBe("service-token");
    expect(state.configured).toBe(true);
    expect(state.host).toBe("http://127.0.0.1:13000");
  });

  it("requires service authentication for non-loopback Eve hosts", async () => {
    expect(
      getEveAgentRuntimeStateFromEnv({
        EVE_AGENT_HOST: "http://eve-agent:13010",
      }).configured,
    ).toBe(false);

    await expect(
      runEveAgent(
        { prompt: "Summarize this template" },
        parseEveAgentConfig({ EVE_AGENT_HOST: "http://eve-agent:13010" }),
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason:
        "EVE_AGENT_SERVICE_TOKEN is required for a non-loopback Eve Agent host",
    });
  });

  it("depends on the latest official eve package", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.eve).toBe("latest");
  });

  it("loads the authored surface through eve defineAgent", async () => {
    const agent = (await import("../agent/agent")).default as {
      model?: { modelId?: string };
    };

    expect(agent.model?.modelId).toBe(defaultEveAgentModel);
  });

  it("owns Toolbox as an Eve MCP connection", async () => {
    const { default: toolbox, eveToolboxToolNames } =
      await import("../agent/connections/toolbox");
    const connection = toolbox as {
      description?: string;
      tools?: { allow?: readonly string[] };
      url?: string;
    };

    expect(connection.url).toBe("http://localhost:15000/mcp");
    expect(connection.description).toContain("MCP Toolbox read models");
    expect(connection.tools?.allow).toEqual([...eveToolboxToolNames]);
  });

  it("defines the Eve channel route auth in the authored surface", async () => {
    const channel = (await import("../agent/channels/eve")).default as {
      routes?: readonly unknown[];
    };

    expect(Array.isArray(channel.routes)).toBe(true);
  });

  it("authors production limits, a local-safe sandbox, hooks, and privacy-safe telemetry", async () => {
    const agent = (await import("../agent/agent")).default as {
      compaction?: { thresholdPercent?: number };
      limits?: {
        maxInputTokensPerSession?: number;
        maxOutputTokensPerSession?: number;
      };
    };
    const sandbox = (await import("../agent/sandbox")).default;
    const sandboxEnvironment = (await import("../agent/sandbox")).environment;
    const otel = (await import("../agent/instrumentation/otel")).default;
    const hook = (await import("../agent/hooks/runtime-audit")).default as {
      events?: Record<string, unknown>;
    };

    expect(agent.compaction?.thresholdPercent).toBe(0.75);
    expect(agent.limits).toMatchObject({
      maxInputTokensPerSession: 1_000_000,
      maxOutputTokensPerSession: 100_000,
    });
    expect(sandboxEnvironment.provider).toBe("just-bash");
    expect(sandbox).toBeTypeOf("function");
    expect(
      otel.options.tracePolicy?.({
        agentName: "agent-template-eve",
        audience: "private",
        channel: { kind: "http" },
        environment: "production",
        principalType: "service",
      }),
    ).toEqual({
      emit: true,
      recordInputs: false,
      recordOutputs: false,
    });
    expect(hook.events).toHaveProperty("session.failed");
  });

  it("disables Eve provider-managed web search for Kimi compatibility", async () => {
    const webSearch = (await import("../agent/tools/web_search")).default as {
      kind?: string;
    };

    expect(webSearch.kind).toBe("eve:disabled-tool");
  });

  it.each(["bash", "read_file", "web_fetch", "web_search", "write_file"])(
    "disables the production-incompatible default tool %s",
    async (tool) => {
      const definition = (await import(`../agent/tools/${tool}.ts`))
        .default as {
        kind?: string;
      };

      expect(definition.kind).toBe("eve:disabled-tool");
    },
  );

  it("uses one model source for runtime state and authored surface", () => {
    const env = { ANTHROPIC_MODEL: "kimi-custom" };

    expect(getEveAgentRuntimeStateFromEnv(env).model).toBe(
      readEveAgentModel(env),
    );
  });

  it("normalizes Anthropic-compatible base URL for the AI SDK provider", () => {
    expect(
      readEveAnthropicBaseURL({
        ANTHROPIC_BASE_URL: "https://api.kimi.com/coding/",
      }),
    ).toBe("https://api.kimi.com/coding/v1");
    expect(
      readEveAnthropicBaseURL({
        ANTHROPIC_BASE_URL: "https://api.kimi.com/coding/v1",
      }),
    ).toBe("https://api.kimi.com/coding/v1");
  });

  it("parses Eve client resilience settings", () => {
    expect(
      parseEveAgentConfig({
        EVE_AGENT_MAX_RECONNECT_ATTEMPTS: "7",
        EVE_AGENT_REQUEST_TIMEOUT_MS: "45000",
      }),
    ).toMatchObject({
      maxReconnectAttempts: 7,
      requestTimeoutMs: 45_000,
    });
    expect(parseEveAgentConfig({}).maxReconnectAttempts).toBe(
      defaultEveAgentMaxReconnectAttempts,
    );
  });

  it("skips execution until an Eve Agent host is configured", async () => {
    await expect(
      runEveAgent(
        { prompt: "Summarize this template" },
        parseEveAgentConfig({}),
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason: "EVE_AGENT_HOST is not configured",
    });
  });

  it("runs through the Eve client when configured", async () => {
    const events: unknown[] = [];
    const continuation = encodeEveContinuation({
      sessionId: "eve-session-1",
      streamIndex: 6,
    });
    const streamed = [
      streamEvent({
        data: {
          actions: [
            {
              callId: "call-1",
              input: { limit: 1 },
              kind: "tool-call",
              toolName: "toolbox__list-agent-runs",
            },
          ],
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "actions.requested",
      }),
      streamEvent({
        data: {
          result: {
            callId: "call-1",
            kind: "tool-result",
            output: [{ runId: "run-1" }],
            toolName: "toolbox__list-agent-runs",
          },
          sequence: 2,
          status: "completed",
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "action.result",
      }),
      streamEvent({
        data: {
          messageDelta: "Do",
          sequence: 3,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.appended",
      }),
      streamEvent({
        data: {
          finishReason: "stop",
          message: "Done",
          sequence: 4,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.completed",
      }),
      streamEvent({ type: "session.completed" }),
    ];

    await expect(
      runEveAgent(
        { prompt: "Summarize this template" },
        parseEveAgentConfig({ EVE_AGENT_HOST: "http://127.0.0.1:13010" }),
        {
          createClient: () => ({
            sessions: {
              create: async () => ({
                session: {
                  state: { sessionId: "eve-session-1", streamIndex: 6 },
                  send: async () => responseOf("eve-session-1", streamed),
                  respond: async () => responseOf("eve-session-1", streamed),
                },
                response: responseOf("eve-session-1", streamed),
              }),
              attach: () => {
                throw new Error("unexpected attach");
              },
            },
          }),
          onEvent(event) {
            events.push(event);
          },
        },
      ),
    ).resolves.toEqual({
      status: "completed",
      events: [
        {
          kind: "tool-call",
          tool: "toolbox__list-agent-runs",
          input: '{"limit":1}',
        },
        {
          kind: "tool-result",
          tool: "toolbox__list-agent-runs",
          status: "completed",
        },
        { kind: "text", text: "Do" },
        { kind: "text", text: "Done" },
        { kind: "done", result: "Done" },
      ],
      output: "Done",
      sessionId: "eve-session-1",
      continuation,
    });
    expect(events).toEqual([
      {
        kind: "tool-call",
        tool: "toolbox__list-agent-runs",
        input: '{"limit":1}',
      },
      {
        kind: "tool-result",
        tool: "toolbox__list-agent-runs",
        status: "completed",
      },
      { kind: "text", text: "Do" },
      { kind: "text", text: "Done" },
      { kind: "done", result: "Done" },
    ]);
  });

  it("preserves a waiting Eve session and surfaces HITL requests", async () => {
    const priorSession = {
      sessionId: "eve-session-1",
      streamIndex: 4,
    };
    const nextSession = {
      sessionId: "eve-session-1",
      streamIndex: 9,
    };
    const streamed = [
      streamEvent({
        type: "input.requested",
        data: {
          requests: [
            {
              requestId: "request-1",
              kind: "tool-approval",
              prompt: "是否批准查询？",
              display: "confirmation",
              action: {
                callId: "call-1",
                input: {},
                kind: "tool-call",
                toolName: "toolbox__list-agent-runs",
              },
              options: [
                { id: "approve", label: "批准" },
                { id: "deny", label: "拒绝" },
              ],
            },
          ],
          sequence: 2,
          stepIndex: 0,
          turnId: "turn-2",
        },
      }),
      streamEvent({
        type: "session.waiting",
        data: { continuationToken: "", wait: "next-user-message" },
      }),
    ];

    await expect(
      runEveAgent(
        {
          continuation: encodeEveContinuation(priorSession),
          responses: [
            {
              kind: "selected-option",
              requestId: "request-0",
              optionId: "approve",
            },
          ],
        },
        parseEveAgentConfig({ EVE_AGENT_HOST: "http://127.0.0.1:13010" }),
        {
          createClient: () => ({
            sessions: {
              create: () => {
                throw new Error("unexpected create");
              },
              attach: (sessionId, options) => {
                expect(sessionId).toBe("eve-session-1");
                expect(options).toEqual({ streamIndex: 4 });

                return {
                  state: nextSession,
                  async send() {
                    throw new Error("unexpected send");
                  },
                  async respond(responses) {
                    expect(responses).toEqual([
                      { requestId: "request-0", optionId: "approve" },
                    ]);
                    return responseOf("eve-session-1", streamed);
                  },
                };
              },
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      status: "waiting",
      continuation: encodeEveContinuation(nextSession),
      events: [
        {
          kind: "input-requested",
          requests: [
            {
              requestId: "request-1",
              tool: "toolbox__list-agent-runs",
            },
          ],
        },
        { kind: "waiting" },
      ],
    });
  });
});
