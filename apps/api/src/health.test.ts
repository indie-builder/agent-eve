import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";
import { getHealth } from "./health.js";

describe("GET /health", () => {
  it("returns health status without external services in tests", async () => {
    const app = buildApp({
      env: loadEnv({ NODE_ENV: "test" }),
      checkExternal: false,
    });

    const response = await app.inject({ method: "GET", url: "/health" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.service).toBe("api");
    expect(body.status).toBe("ok");
    expect(body.database.status).toBe("skipped");
    expect(body.redis.status).toBe("skipped");
    expect(body.agent.runtime).toBe("eve");
    expect(body.agent.configured).toBe(false);
    expect(body).not.toHaveProperty("toolbox");
  });
});

describe("POST /agent/jobs", () => {
  it("accepts Agent jobs through the app-level intake interface", async () => {
    const calls: unknown[] = [];
    const app = buildApp({
      env: loadEnv({ NODE_ENV: "test" }),
      agentJobIntake: {
        async enqueue(input) {
          calls.push(input);
          return { id: "job-1", queue: "agent-jobs" };
        },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/agent/jobs",
      payload: {
        prompt: "Summarize this template",
        requestedAt: "2026-06-26T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ id: "job-1", queue: "agent-jobs" });
    expect(calls).toEqual([
      {
        prompt: "Summarize this template",
        requestedAt: "2026-06-26T00:00:00.000Z",
      },
    ]);
  });
});

describe("POST /agent/chat", () => {
  it("streams Agent events and the final result", async () => {
    const app = buildApp({
      env: loadEnv({ NODE_ENV: "test" }),
      async runAgent(input, _env, options) {
        options?.onEvent?.({ kind: "text", text: "Working" });

        return {
          configured: true,
          events: [
            { kind: "text", text: "Working" },
            { kind: "done", result: "Done" },
          ],
          output: "Done",
          promptLength: (input as { prompt: string }).prompt.length,
          runtime: "eve",
          status: "completed",
        };
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/agent/chat",
      payload: {
        prompt: "Run agent",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain('event: agent-event\ndata: {"kind":"text","text":"Working"}');
    expect(response.body).toContain('event: result\ndata: {"configured":true');
  });

  it("passes an opaque Agent continuation through the Chat boundary", async () => {
    const inputs: unknown[] = [];
    const continuation = { token: "opaque-token" };
    const app = buildApp({
      env: loadEnv({ NODE_ENV: "test" }),
      async runAgent(input) {
        inputs.push(input);
        return {
          configured: true,
          events: [{ kind: "waiting" }],
          output: "可以继续。",
          promptLength: 2,
          runtime: "eve",
          continuation,
          sessionId: "session-1",
          status: "waiting",
        };
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/agent/chat",
      payload: { prompt: "继续", continuation },
    });

    expect(response.statusCode).toBe(200);
    expect(inputs).toEqual([{ prompt: "继续", continuation }]);
    expect(response.body).toContain('"status":"waiting"');
    expect(response.body).toContain('"token":"opaque-token"');
  });
});

describe("removed platform MCP surface", () => {
  it("does not expose MCP management routes from the API", async () => {
    const app = buildApp({ env: loadEnv({ NODE_ENV: "test" }) });

    await expect(app.inject({ method: "GET", url: "/mcp/servers" })).resolves.toMatchObject({
      statusCode: 404,
    });
    await expect(
      app.inject({
        method: "GET",
        url: "/mcp/apps/resource?uri=ui%3A%2F%2Fagent-template%2Fagent-runs",
      }),
    ).resolves.toMatchObject({ statusCode: 404 });
  });
});

describe("getHealth", () => {
  it("aggregates adapter results through the Health interface", async () => {
    const status = await getHealth(loadEnv({ NODE_ENV: "test" }), {
      checkExternal: true,
      adapters: {
        database: async () => ({
          status: "ok",
          message: "PostgreSQL reachable",
        }),
        redis: async () => ({
          status: "error",
          message: "Redis refused connection",
        }),
        now: () => "2026-06-26T00:00:00.000Z",
      },
    });

    expect(status.status).toBe("degraded");
    expect(status.timestamp).toBe("2026-06-26T00:00:00.000Z");
    expect(status.queue.status).toBe("unavailable");
    expect(status.redis.message).toBe("Redis refused connection");
    expect(status.agent.runtime).toBe("eve");
  });

  it("keeps Eve Agent runtime env config available after API env parsing", async () => {
    const status = await getHealth(
      loadEnv({
        NODE_ENV: "test",
        EVE_AGENT_HOST: "http://127.0.0.1:13000",
      }),
      {
        checkExternal: false,
      },
    );

    expect(status.agent.runtime).toBe("eve");
    expect(status.agent.configured).toBe(true);
  });

  it("reports an unconfigured Eve Agent runtime without an Eve Agent host", async () => {
    const status = await getHealth(
      loadEnv({
        NODE_ENV: "test",
      }),
      {
        checkExternal: false,
      },
    );

    expect(status.agent.runtime).toBe("eve");
    expect(status.agent.configured).toBe(false);
  });
});
