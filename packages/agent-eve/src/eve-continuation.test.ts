import { describe, expect, it } from "vitest";
import { decodeEveContinuation, encodeEveContinuation } from "./eve-continuation.js";

describe("Eve continuation adapter", () => {
  it("round-trips the Eve client session cursor behind an opaque Agent token", () => {
    const state = {
      sessionId: "session-1",
      streamIndex: 12,
    };
    const continuation = encodeEveContinuation(state);

    expect(continuation?.token).toMatch(/^eve:v1:/);
    expect(continuation).not.toHaveProperty("sessionId");
    expect(decodeEveContinuation(continuation)).toEqual(state);
  });

  it("rejects malformed continuation tokens", () => {
    expect(() => decodeEveContinuation({ token: "another-runtime:token" })).toThrow(
      "Invalid Eve Agent continuation",
    );
  });
});
