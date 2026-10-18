import { describe, expect, it } from "vitest";
import { AgentRunEventSchema } from "./agent-run-events";

describe("AgentRunEventSchema", () => {
  it("accepts the shared Agent run event protocol", () => {
    expect(
      AgentRunEventSchema.parse({
        kind: "tool-call",
        tool: "search",
        input: '{"q":"agentcn"}',
      }),
    ).toEqual({
      kind: "tool-call",
      tool: "search",
      input: '{"q":"agentcn"}',
    });
    expect(AgentRunEventSchema.parse({ kind: "tool-result", tool: "search" })).toEqual({
      kind: "tool-result",
      tool: "search",
    });
    expect(AgentRunEventSchema.parse({ kind: "text", text: "hello" })).toEqual({
      kind: "text",
      text: "hello",
    });
    expect(AgentRunEventSchema.parse({ kind: "done", result: "ok" })).toEqual({
      kind: "done",
      result: "ok",
    });
  });

  it("accepts error, artifact, and unknown events", () => {
    const artifacts = AgentRunEventSchema.parse({
      kind: "artifacts",
      tabs: [{ id: "summary", label: "Summary", hint: "md", content: "# Done" }],
    });

    expect(AgentRunEventSchema.parse({ kind: "error", message: "failed" })).toEqual({
      kind: "error",
      message: "failed",
    });
    expect(artifacts).toEqual({
      kind: "artifacts",
      tabs: [{ id: "summary", label: "Summary", hint: "md", content: "# Done" }],
    });
    expect(AgentRunEventSchema.parse({ kind: "unknown", text: "raw event" })).toEqual({
      kind: "unknown",
      text: "raw event",
    });
  });

  it("accepts Eve interactive and lifecycle events", () => {
    expect(
      AgentRunEventSchema.parse({
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
      }),
    ).toMatchObject({ kind: "input-requested" });
    expect(
      AgentRunEventSchema.parse({
        kind: "authorization",
        connection: "toolbox",
        status: "required",
        url: "https://example.com/authorize",
      }),
    ).toMatchObject({ kind: "authorization", status: "required" });
    expect(
      AgentRunEventSchema.parse({
        kind: "usage",
        inputTokens: 120,
        outputTokens: 24,
      }),
    ).toEqual({ kind: "usage", inputTokens: 120, outputTokens: 24 });
  });
});
