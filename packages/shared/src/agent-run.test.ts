import { describe, expect, it } from "vitest";
import { AgentRunInputSchema, AgentRunResultSchema } from "./agent-run";

describe("AgentRunResultSchema", () => {
  it("accepts completed Agent runs with run events", () => {
    expect(
      AgentRunResultSchema.parse({
        configured: true,
        events: [{ kind: "done", result: "Done" }],
        output: "Done",
        promptLength: 9,
        runtime: "eve",
        status: "completed",
      }),
    ).toEqual({
      configured: true,
      events: [{ kind: "done", result: "Done" }],
      output: "Done",
      promptLength: 9,
      runtime: "eve",
      status: "completed",
    });
  });

  it("accepts a waiting Eve run with a durable session cursor", () => {
    expect(
      AgentRunResultSchema.parse({
        configured: true,
        events: [{ kind: "waiting" }],
        output: "请确认是否继续。",
        promptLength: 9,
        runtime: "eve",
        sessionId: "session-1",
        continuation: { token: "opaque-token" },
        status: "waiting",
      }),
    ).toMatchObject({
      runtime: "eve",
      status: "waiting",
      continuation: { token: "opaque-token" },
    });
  });

  it("accepts structured HITL responses with an opaque continuation", () => {
    expect(
      AgentRunInputSchema.parse({
        continuation: { token: "opaque-token" },
        responses: [
          {
            kind: "selected-option",
            requestId: "request-1",
            optionId: "approve",
          },
        ],
      }),
    ).toEqual({
      continuation: { token: "opaque-token" },
      responses: [
        {
          kind: "selected-option",
          requestId: "request-1",
          optionId: "approve",
        },
      ],
    });
    expect(() =>
      AgentRunInputSchema.parse({
        responses: [{ kind: "text", requestId: "request-1", text: "yes" }],
      }),
    ).toThrow("require a continuation");
  });

  it("accepts multi-select responses and rejects legacy response shapes", () => {
    expect(
      AgentRunInputSchema.parse({
        continuation: { token: "opaque-token" },
        responses: [
          {
            kind: "selected-options",
            requestId: "request-1",
            optionIds: ["a", "b"],
          },
        ],
      }),
    ).toMatchObject({
      responses: [
        {
          kind: "selected-options",
          requestId: "request-1",
          optionIds: ["a", "b"],
        },
      ],
    });

    expect(() =>
      AgentRunInputSchema.parse({
        continuation: { token: "opaque-token" },
        responses: [{ requestId: "request-1", optionId: "a" }],
      }),
    ).toThrow();
  });
});
