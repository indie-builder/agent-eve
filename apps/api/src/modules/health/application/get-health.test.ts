import { expect, it } from "vitest";
import { loadEnv } from "../../../bootstrap/env.js";
import { getHealth } from "./get-health.js";
import { buildApp } from "../../../bootstrap/app.js";

// 故意破坏服务配置，防止内部校验错误被HTTP层误判为客户端400。
it("服务配置无效时保留服务端500错误", async () => {
  const app = buildApp({
    env: loadEnv({ NODE_ENV: "test", EVE_AGENT_HOST: "invalid-host" }),
    checkExternal: false,
  });
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(500);
  } finally {
    await app.close();
  }
});

it("依赖故障聚合为 degraded 并阻止队列就绪", async () => {
  const status = await getHealth(loadEnv({ NODE_ENV: "test" }), {
    database: async () => ({ status: "ok", message: "PostgreSQL reachable" }),
    redis: async () => ({ status: "error", message: "Redis refused connection" }),
    now: () => "2026-06-26T00:00:00.000Z",
  });
  expect(status.status).toBe("degraded");
  expect(status.timestamp).toBe("2026-06-26T00:00:00.000Z");
  expect(status.queue.status).toBe("unavailable");
  expect(status.redis.message).toBe("Redis refused connection");
});
