import { EventEmitter, once } from "node:events";
import { createServer, type Socket } from "node:net";
import { setTimeout } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import type { AgentRunResult } from "@agent-template/agent";
import type { AgentJobPayload } from "@agent-template/shared";
import { loadWorkerEnv } from "../../bootstrap/env.js";
import { createAgentWorkerProcess, registerWorkerShutdown } from "./consumer.js";

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
  // 本地连接故障无法由成功旅程覆盖，使用真实 Worker 验证持续重试、错误日志与关闭。
  it("keeps retrying unavailable Redis and can close before becoming ready", async () => {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("缺少本地测试端口");
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    const logger = {
      info: vi.fn<(data: unknown, message: string) => void>(),
      error: vi.fn<(data: unknown, message: string) => void>(),
    };
    const workerProcess = createAgentWorkerProcess({
      env: loadWorkerEnv({ REDIS_URL: `redis://127.0.0.1:${address.port}` }),
      logger,
    });
    try {
      // BullMQ has regular and blocking connections; both must survive the first failed attempt.
      await expect
        .poll(() => logger.error.mock.calls.length, { timeout: 4_000 })
        .toBeGreaterThanOrEqual(4);
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.objectContaining({ code: "ECONNREFUSED" }) },
        "agent worker connection failed",
      );
    } finally {
      await workerProcess.close();
    }
  });

  // 成功旅程无法稳定制造双连接握手竞态；仅替换 Redis wire，保留真实 BullMQ 的取任务和关闭流程。
  it("waits for an active job when only the blocking connection is still initializing", async () => {
    const sockets = new Set<Socket>();
    let blockingHandshake = false;
    let started = false;
    let released = false;
    let finishTask = () => {};
    const task = new Promise<AgentRunResult>((resolve) => {
      finishTask = () => resolve(completedResult);
    });
    const bulk = (value: string) => `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    let unblock = () => {};
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
      let pending = "";
      let heldReplies: string | undefined;
      socket.on("data", (data) => {
        pending += data.toString("latin1");
        while (pending.length) {
          const header = /^\*(\d+)\r\n/.exec(pending);
          if (!header) return;
          let offset = header[0].length;
          const args: string[] = [];
          for (let index = 0; index < Number(header[1]); index += 1) {
            const lengthHeader = /^\$(\d+)\r\n/.exec(pending.slice(offset));
            if (!lengthHeader) return;
            offset += lengthHeader[0].length;
            const length = Number(lengthHeader[1]);
            if (pending.length < offset + length + 2) return;
            args.push(pending.slice(offset, offset + length));
            offset += length + 2;
          }
          pending = pending.slice(offset);
          const command = args[0]?.toLowerCase();
          let reply = "+OK\r\n";
          if (command === "hello") {
            reply = "-ERR unknown command 'HELLO'\r\n";
          } else if (command === "client" && args[1]?.toLowerCase() === "setname") {
            // BullMQ names only its dedicated blocking connection.
            if (!released) {
              heldReplies = "";
              unblock = () => {
                released = true;
                socket.write(heldReplies ?? "");
                heldReplies = undefined;
              };
              blockingHandshake = true;
            }
          } else if (command === "info") {
            reply = bulk("redis_version:7.0.8\r\nloading:0\r\nmaxmemory_policy:noeviction\r\n");
          } else if (command === "eval" || command === "evalsha") {
            // Installed BullMQ scripts use 11 / 14 / 9 keys for active / finished / stalled.
            if (args[2] === "11") {
              const fields = ["name", "agent.run", "data", JSON.stringify(payload), "opts", "{}"];
              reply = `*4\r\n*${fields.length}\r\n${fields.map(bulk).join("")}${bulk("job-1")}:0\r\n:0\r\n`;
            } else {
              reply = args[2] === "14" ? ":0\r\n" : "*0\r\n";
            }
          } else if (command === "quit") {
            socket.end(reply);
            continue;
          }
          if (heldReplies === undefined) socket.write(reply);
          else heldReplies += reply;
        }
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("缺少本地测试端口");
    const logger = {
      info: vi.fn<(data: unknown, message: string) => void>(),
      error: vi.fn<(data: unknown, message: string) => void>(),
    };
    const workerProcess = createAgentWorkerProcess({
      env: loadWorkerEnv({ REDIS_URL: `redis://127.0.0.1:${address.port}` }),
      logger,
      processJob(received) {
        expect(received).toEqual(payload);
        started = true;
        return task;
      },
    });
    let closing: Promise<void> | undefined;
    try {
      await expect.poll(() => started && blockingHandshake).toBe(true);
      closing = workerProcess.close();
      expect(await Promise.race([closing.then(() => "closed"), setTimeout(50, "waiting")])).toBe(
        "waiting",
      );
      // BullMQ's graceful disconnect awaits the blocking handshake before draining the main loop.
      unblock();
      expect(await Promise.race([closing.then(() => "closed"), setTimeout(50, "waiting")])).toBe(
        "waiting",
      );
      finishTask();
      await closing;
      expect(logger.info).toHaveBeenCalledWith({ jobId: "job-1" }, "agent job completed");
      expect(logger.error).not.toHaveBeenCalled();
      await expect.poll(() => sockets.size).toBe(0);
    } finally {
      finishTask();
      unblock();
      await (closing ?? workerProcess.close());
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("defaults worker concurrency to 1 and requires a positive integer", () => {
    expect(loadWorkerEnv({})).toMatchObject({ WORKER_CONCURRENCY: 1 });
    expect(loadWorkerEnv({ WORKER_CONCURRENCY: "4" })).toMatchObject({ WORKER_CONCURRENCY: 4 });
    expect(() => loadWorkerEnv({ WORKER_CONCURRENCY: "0" })).toThrow(ZodError);
    expect(() => loadWorkerEnv({ WORKER_CONCURRENCY: "1.5" })).toThrow(ZodError);
  });

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
