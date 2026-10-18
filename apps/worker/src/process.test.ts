import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { AgentRunResult } from "@agent-template/agent";
import type { AgentJobPayload } from "@agent-template/shared";
import { loadWorkerEnv } from "./env.js";
import { createAgentWorkerProcess, registerWorkerShutdown } from "./process.js";

type AgentJob = { id?: string; name: string; data: AgentJobPayload };

const payload: AgentJobPayload = {
  prompt: "Summarize this template",
  requestedAt: "2026-06-26T00:00:00.000Z",
};

const completedResult: AgentRunResult = {
  promptLength: 23,
  runtime: "eve",
  configured: true,
  status: "completed",
  output: "Done",
};

function createHarness(result: AgentRunResult) {
  const logs: unknown[] = [];
  const state: {
    processJob?: (job: AgentJob) => Promise<AgentRunResult>;
    onCompleted?: (job: AgentJob) => void;
    onFailed?: (job: AgentJob | undefined, error: Error) => void;
    concurrency?: number;
    closed: boolean;
  } = { closed: false };

  const workerProcess = createAgentWorkerProcess({
    env: loadWorkerEnv({
      REDIS_URL: "redis://localhost:16379",
      WORKER_CONCURRENCY: "3",
    }),
    logger: {
      info(data, message) {
        logs.push(["info", data, message]);
      },
      error(data, message) {
        logs.push(["error", data, message]);
      },
    },
    createWorker({ processJob, concurrency, onCompleted, onFailed }) {
      state.processJob = processJob;
      state.onCompleted = onCompleted;
      state.onFailed = onFailed;
      state.concurrency = concurrency;

      return {
        async close() {
          state.closed = true;
        },
      };
    },
    async processJob() {
      return result;
    },
  });

  return { workerProcess, logs, state };
}

describe("createAgentWorkerProcess", () => {
  it("assembles worker processing, events, concurrency, and shutdown behind one interface", async () => {
    const { workerProcess, logs, state } = createHarness(completedResult);

    await expect(
      state.processJob?.({ id: "job-1", name: "agent.run", data: payload }),
    ).resolves.toEqual(completedResult);
    state.onCompleted?.({ id: "job-1", name: "agent.run", data: payload });
    state.onFailed?.(undefined, new Error("boom"));
    await workerProcess.close();

    expect(state.concurrency).toBe(3);
    expect(state.closed).toBe(true);
    expect(logs[0]).toEqual([
      "info",
      { jobId: "job-1", jobName: "agent.run" },
      "processing agent job",
    ]);
    expect(logs[1]).toEqual(["info", { jobId: "job-1" }, "agent job completed"]);
    expect(logs[2]).toEqual([
      "error",
      { jobId: undefined, error: expect.any(Error) },
      "agent job failed",
    ]);
  });

  it("throws failed and skipped Agent runs so BullMQ does not mark them completed", async () => {
    const failed: AgentRunResult = {
      ...completedResult,
      status: "failed",
      reason: "Eve transport exploded",
    };
    const skipped: AgentRunResult = {
      ...completedResult,
      configured: false,
      status: "skipped",
      reason: "EVE_AGENT_HOST is not configured",
    };

    for (const result of [failed, skipped]) {
      const { state } = createHarness(result);

      await expect(
        state.processJob?.({ id: "job-1", name: "agent.run", data: payload }),
      ).rejects.toThrow(result.reason);
    }
  });

  it("keeps waiting Agent runs as completed jobs because they can be resumed", async () => {
    const waiting: AgentRunResult = {
      ...completedResult,
      status: "waiting",
      output: "请确认是否继续。",
      continuation: { token: "opaque-token" },
    };
    const { state } = createHarness(waiting);

    await expect(
      state.processJob?.({ id: "job-1", name: "agent.run", data: payload }),
    ).resolves.toEqual(waiting);
  });
});

describe("registerWorkerShutdown", () => {
  it("closes the worker once on SIGTERM or SIGINT", () => {
    const signals = new EventEmitter() as unknown as NodeJS.Process;
    let closes = 0;
    registerWorkerShutdown(
      {
        async close() {
          closes += 1;
        },
      },
      signals,
    );

    signals.emit("SIGTERM");
    signals.emit("SIGINT");

    expect(closes).toBe(1);
  });
});
