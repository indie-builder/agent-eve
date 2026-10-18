import { describe, expect, it } from "vitest";
import { createEveChannelAuth } from "./channel-auth.js";

describe("Eve channel trust policy", () => {
  it("rejects spoofed local hosts in production", async () => {
    const productionAuth = createEveChannelAuth({
      NODE_ENV: "production",
      EVE_AGENT_SERVICE_TOKEN: "service-token",
    });
    const spoofedLocalRequest = new Request("http://localhost/eve/v1/info");
    const authenticatedRequest = new Request("http://eve-agent/eve/v1/info", {
      headers: { "x-agent-template-eve-token": "service-token" },
    });

    expect(productionAuth).toHaveLength(2);
    await expect(Promise.resolve(productionAuth[0]?.(spoofedLocalRequest))).resolves.toBeNull();
    await expect(Promise.resolve(productionAuth[0]?.(authenticatedRequest))).resolves.toMatchObject(
      { principalType: "service" },
    );
    expect(createEveChannelAuth({ NODE_ENV: "development" })).toHaveLength(3);
  });
});
