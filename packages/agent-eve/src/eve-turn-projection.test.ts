import { describe, expect, it } from "vitest";
import type { MessageStreamEvent } from "eve/client";
import { projectEveStreamEvent, projectEveTurn } from "./eve-turn-projection.js";

const meta = { at: "2026-10-18T00:00:00.000Z", id: "evt_1" };

function streamEvent<TType extends MessageStreamEvent["type"]>(
  event: Omit<Extract<MessageStreamEvent, { type: TType }>, "meta">,
): MessageStreamEvent {
  return { ...event, meta } as MessageStreamEvent;
}

describe("Eve turn projection", () => {
  it("keeps waiting as a successful turn boundary and prefers structured output", () => {
    const events: MessageStreamEvent[] = [
      streamEvent({
        type: "message.completed",
        data: {
          finishReason: "stop",
          message: "fallback",
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
      }),
      streamEvent({
        type: "result.completed",
        data: {
          result: { answer: 42 },
          sequence: 2,
          stepIndex: 0,
          turnId: "turn-1",
        },
      }),
      streamEvent({
        type: "session.waiting",
        data: { continuationToken: "", wait: "next-user-message" },
      }),
    ];

    expect(projectEveTurn(events)).toEqual({
      status: "waiting",
      output: '{"answer":42}',
    });
  });

  it("treats a human-input pause as a waiting boundary", () => {
    const events: MessageStreamEvent[] = [
      streamEvent({
        type: "turn.waiting",
        data: { on: "input", sequence: 1, turnId: "turn-1" },
      }),
    ];

    expect(projectEveTurn(events)).toEqual({ status: "waiting", output: "" });
  });

  it("gives a terminal session failure precedence over prior boundaries", () => {
    const events: MessageStreamEvent[] = [
      streamEvent({
        type: "session.waiting",
        data: { continuationToken: "", wait: "next-user-message" },
      }),
      streamEvent({
        type: "session.failed",
        data: {
          code: "SESSION_FAILED",
          message: "failed",
          sessionId: "session-1",
        },
      }),
    ];

    expect(projectEveTurn(events)).toEqual({
      status: "failed",
      reason: "failed",
    });
  });

  it("reports a failed turn even when the session accepts another message", () => {
    const events: MessageStreamEvent[] = [
      streamEvent({
        type: "message.completed",
        data: {
          finishReason: "tool-calls",
          message: "Partial response",
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
      }),
      streamEvent({
        type: "turn.failed",
        data: {
          code: "PROVIDER_ERROR",
          message: "Provider request failed",
          terminal: false,
          sequence: 2,
          turnId: "turn-1",
        },
      }),
      streamEvent({
        type: "session.waiting",
        data: { continuationToken: "", wait: "next-user-message" },
      }),
    ];

    expect(projectEveTurn(events)).toEqual({
      status: "failed",
      reason: "Provider request failed",
    });
  });

  it("accumulates incremental message deltas into cumulative text", () => {
    const state = { messageText: "" };
    const first = streamEvent({
      type: "message.appended",
      data: {
        messageDelta: "Do",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn-1",
      },
    });
    const second = streamEvent({
      type: "message.appended",
      data: {
        messageDelta: "ne",
        sequence: 2,
        stepIndex: 0,
        turnId: "turn-1",
      },
    });

    expect(projectEveStreamEvent(first, state)).toEqual([{ kind: "text", text: "Do" }]);
    expect(projectEveStreamEvent(second, state)).toEqual([{ kind: "text", text: "Done" }]);
  });

  it("projects typed HITL requests without leaking tool input", () => {
    const event = streamEvent({
      type: "input.requested",
      data: {
        requests: [
          {
            requestId: "request-1",
            kind: "tool-approval",
            prompt: "是否批准？",
            display: "confirmation",
            action: {
              callId: "call-1",
              input: { secret: "not-projected" },
              kind: "tool-call",
              toolName: "toolbox__list-agent-runs",
            },
            options: [
              { id: "approve", label: "批准", style: "primary" },
              { id: "deny", label: "拒绝", style: "danger" },
            ],
          },
        ],
        sequence: 1,
        stepIndex: 0,
        turnId: "turn-1",
      },
    });

    expect(projectEveStreamEvent(event, { messageText: "" })).toEqual([
      {
        kind: "input-requested",
        requests: [
          {
            requestId: "request-1",
            prompt: "是否批准？",
            tool: "toolbox__list-agent-runs",
            display: "confirmation",
            options: [
              { id: "approve", label: "批准", style: "primary" },
              { id: "deny", label: "拒绝", style: "danger" },
            ],
          },
        ],
      },
    ]);
  });
});
