import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./env.js";

describe("loadWorkerEnv", () => {
  it("exposes Eve Agent runtime env config after Worker env parsing", () => {
    expect(
      loadWorkerEnv({
        EVE_AGENT_HOST: "http://127.0.0.1:13010",
        REDIS_URL: "redis://localhost:16379"
      })
    ).toMatchObject({
      EVE_AGENT_HOST: "http://127.0.0.1:13010"
    });
  });

  it("defaults worker concurrency to 1 and requires a positive integer", () => {
    expect(loadWorkerEnv({})).toMatchObject({ WORKER_CONCURRENCY: 1 });
    expect(loadWorkerEnv({ WORKER_CONCURRENCY: "4" })).toMatchObject({
      WORKER_CONCURRENCY: 4
    });
    expect(() => loadWorkerEnv({ WORKER_CONCURRENCY: "0" })).toThrow();
    expect(() => loadWorkerEnv({ WORKER_CONCURRENCY: "1.5" })).toThrow();
  });
});
