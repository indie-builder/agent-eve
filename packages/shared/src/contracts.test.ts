import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AgentRunInputSchema } from "./agent-run";
import { createBullMqConnectionOptions } from "./queue.js";

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
});

describe("BullMQ connection parsing", () => {
  it("parses Redis URLs for BullMQ", () => {
    expect(createBullMqConnectionOptions("redis://user:pass@localhost:16379/2")).toEqual({
      host: "localhost",
      port: 16379,
      username: "user",
      password: "pass",
      db: 2,
      maxRetriesPerRequest: null,
    });
  });

  it("rejects non-numeric Redis database indexes", () => {
    expect(() => createBullMqConnectionOptions("redis://localhost/not-a-number")).toThrow(
      "Redis URL database index must be a non-negative integer",
    );
  });
});
