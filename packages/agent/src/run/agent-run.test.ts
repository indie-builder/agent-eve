import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { runAgent } from "./agent-run.js";

describe("Agent runtime seam", () => {
  it("runs an Agent run through the Eve runtime seam", async () => {
    const events: unknown[] = [];

    await expect(
      runAgent(
        {
          prompt: "Summarize this template",
        },
        {
          EVE_AGENT_HOST: "http://127.0.0.1:13000",
        },
        {
          runEve: async (_input, _config, options) => {
            options?.onEvent?.({ kind: "text", text: "Working" });

            return {
              status: "completed",
              events: [
                { kind: "text", text: "Working" },
                { kind: "done", result: "Done" },
              ],
              output: "Done",
              sessionId: "eve-session-1",
            };
          },
          onEvent(event) {
            events.push(event);
          },
        },
      ),
    ).resolves.toEqual({
      promptLength: 23,
      runtime: "eve",
      configured: true,
      status: "completed",
      events: [
        { kind: "text", text: "Working" },
        { kind: "done", result: "Done" },
      ],
      output: "Done",
      sessionId: "eve-session-1",
    });

    expect(events).toEqual([{ kind: "text", text: "Working" }]);
  });

  it("rejects invalid Agent run input at the Agent runtime seam", async () => {
    await expect(runAgent({ prompt: "" }, {})).rejects.toThrow(ZodError);
  });

  it("passes opaque continuation and input responses to Eve", async () => {
    const continuation = { token: "opaque-token" };
    const responses = [
      {
        kind: "selected-option" as const,
        requestId: "request-1",
        optionId: "approve",
      },
    ];

    await expect(
      runAgent(
        {
          continuation,
          responses,
        },
        { EVE_AGENT_HOST: "http://127.0.0.1:13000" },
        {
          runEve: async (input) => {
            expect(input).toEqual({ continuation, responses });
            return {
              status: "waiting",
              events: [{ kind: "waiting" }],
              output: "",
              sessionId: "eve-session-1",
              continuation,
            };
          },
        },
      ),
    ).resolves.toMatchObject({
      continuation,
      runtime: "eve",
      status: "waiting",
    });
  });
});
