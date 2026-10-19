import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AgentRunInputSchema } from "./agent-run/contracts";

describe("Agent run input contract", () => {
  it("rejects runs without a prompt or input responses", () => {
    expect(() => AgentRunInputSchema.parse({})).toThrow("requires a prompt or input responses");
    expect(() => AgentRunInputSchema.parse({ prompt: "" })).toThrow(ZodError);
  });

  it("rejects input responses without an opaque continuation", () => {
    expect(() =>
      AgentRunInputSchema.parse({
        responses: [{ kind: "text", requestId: "request-1", text: "yes" }],
      }),
    ).toThrow("require a continuation");
  });

  it("rejects legacy input response shapes", () => {
    expect(() =>
      AgentRunInputSchema.parse({
        continuation: { token: "opaque-token" },
        responses: [{ requestId: "request-1", optionId: "a" }],
      }),
    ).toThrow(ZodError);
  });

  it("rejects multi-select input responses", () => {
    expect(() =>
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
    ).toThrow(ZodError);
  });
});
