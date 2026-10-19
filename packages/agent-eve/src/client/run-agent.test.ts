import { getEventListeners } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientError, type MessageStreamEvent } from "eve/client";
import { getEveAgentRuntimeStateFromEnv, parseEveAgentConfig, runEveAgent } from "./run-agent.js";
import { encodeEveContinuation } from "../protocol/continuation.js";

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

type EveClientFactory = NonNullable<NonNullable<Parameters<typeof runEveAgent>[2]>["createClient"]>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sessionState = { sessionId: "eve-session-1", streamIndex: 6 };
const config = parseEveAgentConfig({
  EVE_AGENT_HOST: "http://127.0.0.1:13010",
  EVE_AGENT_REQUEST_TIMEOUT_MS: 100,
});

function clientWithTurn(
  turn: (signal?: AbortSignal) => Promise<ReturnType<typeof responseOf>>,
): EveClientFactory {
  return () => {
    const session = {
      state: sessionState,
      send: async (_message: string, options?: { signal?: AbortSignal }) => turn(options?.signal),
      respond: async (_responses: unknown, options?: { signal?: AbortSignal }) =>
        turn(options?.signal),
    };
    return {
      sessions: {
        attach: () => session,
        create: async (options) => ({ session, response: await turn(options.signal) }),
      },
    };
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Eve Agent lifecycle and cancellation", () => {
  it.each(["session_not_active", "temporarily_unavailable"])(
    "续接POST被拒绝时仅清除不可恢复的 %s token",
    async (code) => {
      const result = await runEveAgent(
        { prompt: "继续", continuation: encodeEveContinuation(sessionState) },
        config,
        {
          createClient: clientWithTurn(async () => {
            throw new ClientError(
              code === "session_not_active" ? 409 : 503,
              JSON.stringify({ code, error: "Request rejected" }),
            );
          }),
        },
      );
      expect(result.status).toBe("failed");
      expect("continuation" in result).toBe(code !== "session_not_active");
    },
  );

  it.each([
    {
      name: "completed session",
      event: streamEvent({ type: "session.completed" }),
      resumable: false,
    },
    {
      name: "failed session",
      event: streamEvent({
        type: "session.failed",
        data: { code: "FAILED", message: "Session failed", sessionId: sessionState.sessionId },
      }),
      resumable: false,
    },
    {
      name: "waiting session",
      event: streamEvent({
        type: "session.waiting",
        data: { continuationToken: "", wait: "next-user-message" },
      }),
      resumable: true,
    },
    {
      name: "human input pause",
      event: streamEvent({
        type: "turn.waiting",
        data: { on: "input", sequence: 1, turnId: "turn-1" },
      }),
      resumable: true,
    },
    ...[false, true].map((terminal) => ({
      name: `${terminal ? "terminal" : "recoverable"} turn failure`,
      event: streamEvent({
        type: "turn.failed",
        data: { code: "FAILED", message: "Turn failed", terminal, sequence: 1, turnId: "turn-1" },
      }),
      resumable: !terminal,
    })),
  ])("only exposes a usable continuation for $name", async ({ event, resumable }) => {
    const result = await runEveAgent({ prompt: "Run" }, config, {
      createClient: clientWithTurn(async () => responseOf(sessionState.sessionId, [event])),
    });
    expect("continuation" in result).toBe(resumable);
    expect("continuation" in result ? result.continuation : undefined).toEqual(
      resumable ? encodeEveContinuation(sessionState) : undefined,
    );
  });

  it.each(["create", "send", "respond"] as const)(
    "propagates cancellation through %s and releases the iterator, listener and timeout",
    async (method) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const started = deferred<void>();
      let transportSignal: AbortSignal | undefined;
      let released = false;
      const resultPromise = runEveAgent(
        method === "create"
          ? { prompt: "Run" }
          : {
              continuation: encodeEveContinuation(sessionState),
              ...(method === "send"
                ? { prompt: "Continue" }
                : { responses: [{ kind: "text", requestId: "request-1", text: "Yes" }] }),
            },
        config,
        {
          signal: controller.signal,
          createClient: clientWithTurn(async (signal) => {
            transportSignal = signal;
            return {
              sessionId: sessionState.sessionId,
              async *[Symbol.asyncIterator]() {
                const aborted = () => stop.reject(new Error("private transport error"));
                const stop = deferred<never>();
                signal!.addEventListener("abort", aborted, { once: true });
                started.resolve();
                try {
                  await stop.promise;
                  yield streamEvent({ type: "session.completed" });
                } finally {
                  signal!.removeEventListener("abort", aborted);
                  released = true;
                }
              },
            };
          }),
        },
      );
      await started.promise;
      expect(transportSignal?.aborted).toBe(false);
      controller.abort(new Error("secret cancellation reason"));
      const result = await resultPromise;
      expect(result).toMatchObject({ status: "failed", reason: "Eve Agent request cancelled" });
      expect(result).toHaveProperty("continuation", encodeEveContinuation(sessionState));
      expect(transportSignal?.aborted).toBe(true);
      expect(released).toBe(true);
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
      expect(getEventListeners(transportSignal!, "abort")).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(JSON.stringify(result)).not.toContain("secret");
      expect(JSON.stringify(result)).not.toContain("private");
    },
  );

  it.each(["POST", "stream"])("bounds the %s wait with a distinct timeout", async (stage) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const started = deferred<void>();
    let transportSignal: AbortSignal | undefined;
    const waitForAbort = (signal: AbortSignal) => {
      const stop = deferred<never>();
      signal.addEventListener("abort", () => stop.reject(new Error("private timeout reason")), {
        once: true,
      });
      started.resolve();
      return stop.promise;
    };
    const pending = runEveAgent({ prompt: "Run" }, config, {
      signal: controller.signal,
      createClient: clientWithTurn(async (signal) => {
        transportSignal = signal;
        if (stage === "POST") return waitForAbort(signal!);
        return {
          sessionId: sessionState.sessionId,
          async *[Symbol.asyncIterator]() {
            await waitForAbort(signal!);
            yield streamEvent({ type: "session.completed" });
          },
        };
      }),
    });
    await started.promise;
    await vi.advanceTimersByTimeAsync(config.requestTimeoutMs);
    expect(await pending).toMatchObject({
      status: "failed",
      reason: "Eve Agent request timed out",
    });
    expect(transportSignal?.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does no client work for an already aborted signal and hides its reason", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort("secret");
    const createClient = vi.fn<EveClientFactory>();
    const result = await runEveAgent({ prompt: "Run" }, config, {
      signal: controller.signal,
      createClient,
    });
    expect(result).toMatchObject({ status: "failed", reason: "Eve Agent request cancelled" });
    expect(createClient).not.toHaveBeenCalled();
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("detects cancellation when an aborted transport ends silently", async () => {
    const controller = new AbortController();
    const result = await runEveAgent({ prompt: "Run" }, config, {
      signal: controller.signal,
      createClient: clientWithTurn(async () => ({
        sessionId: sessionState.sessionId,
        async *[Symbol.asyncIterator]() {
          yield streamEvent({ type: "session.completed" });
          controller.abort("secret");
        },
      })),
    });
    expect(result).toMatchObject({ status: "failed", reason: "Eve Agent request cancelled" });
    expect(result).not.toHaveProperty("continuation");
  });

  it("cleans up after success without later aborting the completed transport", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let transportSignal: AbortSignal | undefined;
    const result = await runEveAgent({ prompt: "Run" }, config, {
      signal: controller.signal,
      createClient: clientWithTurn(async (signal) => {
        transportSignal = signal;
        return responseOf(sessionState.sessionId, [streamEvent({ type: "session.completed" })]);
      }),
    });
    expect(result.status).toBe("completed");
    controller.abort("secret");
    await vi.advanceTimersByTimeAsync(config.requestTimeoutMs);
    expect(transportSignal?.aborted).toBe(false);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Eve Agent runtime", () => {
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
      reason: "EVE_AGENT_SERVICE_TOKEN is required for a non-loopback Eve Agent host",
    });
  });

  it("skips execution until an Eve Agent host is configured", async () => {
    await expect(
      runEveAgent({ prompt: "Summarize this template" }, parseEveAgentConfig({})),
    ).resolves.toEqual({
      status: "skipped",
      reason: "EVE_AGENT_HOST is not configured",
    });
  });

  it("runs through the Eve client when configured", async () => {
    const events: unknown[] = [];
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
                    expect(responses).toEqual([{ requestId: "request-0", optionId: "approve" }]);
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
