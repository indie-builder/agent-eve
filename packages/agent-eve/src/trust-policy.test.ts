import { describe, expect, it } from "vitest";
import { isLoopbackEveHost, matchesServiceToken } from "./trust-policy.js";

describe("Eve client trust policy", () => {
  it("rejects spoofed service tokens", () => {
    expect(matchesServiceToken("service-token", "service-token")).toBe(true);
    expect(matchesServiceToken("wrong-token", "service-token")).toBe(false);
    expect(matchesServiceToken(null, "service-token")).toBe(false);
  });

  it("recognizes loopback Eve hosts", () => {
    expect(isLoopbackEveHost("http://127.0.0.1:13010")).toBe(true);
    expect(isLoopbackEveHost("http://localhost:13010")).toBe(true);
    expect(isLoopbackEveHost("http://eve-agent:13010")).toBe(false);
  });
});
