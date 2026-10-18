import { describe, expect, it } from "vitest";
import type { MessageStreamEvent } from "eve/client";
import {
  defaultEveAgentMaxReconnectAttempts,
  getEveAgentRuntimeStateFromEnv,
  parseEveAgentConfig,
  runEveAgent,
} from "./index.js";
import { readEveAgentModel } from "./config.js";
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
  it("is unconfigured without an Eve Agent host", () => {
    const state = getEveAgentRuntimeStateFromEnv({});

    expect(state.configured).toBe(false);
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

  it("parses model configuration for the runtime service", () => {
    expect(readEveAgentModel({ ANTHROPIC_MODEL: "kimi-custom" })).toBe(
      "kimi-custom",
    );
    expect(readEveAgentModel({ EVE_AGENT_MODEL: "eve-custom" })).toBe(
      "eve-custom",
    );
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
