import { afterEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import {
  createEveAnthropicModel,
  readEveAnthropicBaseURL,
} from "./provider.js";

afterEach(() => vi.unstubAllGlobals());

describe("Anthropic Messages provider", () => {
  it.each([
    [undefined, "http://127.0.0.1:3425/v1"],
    ["http://127.0.0.1:3425", "http://127.0.0.1:3425/v1"],
    ["http://127.0.0.1:3425/v1/", "http://127.0.0.1:3425/v1"],
  ])("normalizes base URL %s", (baseURL, expected) => {
    expect(readEveAnthropicBaseURL({ ANTHROPIC_BASE_URL: baseURL })).toBe(
      expected,
    );
  });

  it.each([undefined, "2048"])(
    "sends the configured Messages request with token limit %s",
    async (limit) => {
      let requestURL: string | undefined;
      let requestHeaders: Headers | undefined;
      let requestBody: Record<string, unknown> | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          requestURL = String(url);
          requestHeaders = new Headers(init?.headers);
          requestBody = JSON.parse(String(init?.body));
          return Response.json({
            id: "msg-test",
            type: "message",
            role: "assistant",
            model: "group/flash",
            content: [{ type: "text", text: "hello" }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        }),
      );

      const result = await generateText({
        model: createEveAnthropicModel({
          ANTHROPIC_API_KEY: "test-token",
          EVE_MAX_OUTPUT_TOKENS: limit,
        }),
        messages: [{ role: "user", content: "hi" }],
        maxRetries: 0,
      });

      expect(result.text).toBe("hello");
      expect(requestURL).toBe("http://127.0.0.1:3425/v1/messages");
      expect(requestHeaders?.get("x-api-key")).toBe("test-token");
      expect(requestHeaders?.get("anthropic-version")).toBe("2023-06-01");
      expect(requestHeaders?.get("content-type")).toBe("application/json");
      expect(requestBody).toMatchObject({
        model: "group/flash",
        max_tokens: limit ? 2048 : 1024,
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      });
    },
  );
});
