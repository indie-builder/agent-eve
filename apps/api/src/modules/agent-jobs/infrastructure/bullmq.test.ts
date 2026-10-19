import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { createAgentJobIntake } from "../application/intake.js";
import { createAgentQueue } from "./bullmq.js";

// 只隔离本地 Redis wire 故障；真实 BullMQ/ioredis 和 intake 覆盖初次等待及 finally close。
async function createRedisFaultServer(
  mode: "refused" | "handshake" | "disconnect" | "unresponsive" | "loading",
) {
  const sockets = new Set<Socket>();
  let commands = 0;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    if (mode === "handshake") {
      socket.resume();
      return;
    }

    let pending = "";
    socket.on("data", (data) => {
      pending += data.toString("latin1");
      while (pending.length) {
        const header = /^\*(\d+)\r\n/.exec(pending);
        if (!header) return;
        let offset = header[0].length;
        const args: string[] = [];
        for (let index = 0; index < Number(header[1]); index += 1) {
          const bulk = /^\$(\d+)\r\n/.exec(pending.slice(offset));
          if (!bulk) return;
          offset += bulk[0].length;
          const length = Number(bulk[1]);
          if (pending.length < offset + length + 2) return;
          args.push(pending.slice(offset, offset + length));
          offset += length + 2;
        }
        pending = pending.slice(offset);
        const command = args[0]?.toLowerCase();
        if (command === "hello") {
          socket.write("-ERR unknown command 'HELLO'\r\n");
        } else if (command === "info") {
          const info = `redis_version:7.0.8\r\nloading:${mode === "loading" ? 1 : 0}\r\nmaxmemory_policy:noeviction\r\n`;
          socket.write(`$${info.length}\r\n${info}\r\n`);
        } else if (command === "eval" || command === "evalsha") {
          commands += 1;
          if (mode === "disconnect") socket.destroy();
          if (mode === "loading") socket.write("-LOADING Redis is loading the dataset\r\n");
        } else if (command === "quit") {
          socket.end("+OK\r\n");
        } else {
          socket.write(command === "hset" ? ":1\r\n" : "+OK\r\n");
        }
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("缺少本地测试端口");
  if (mode === "refused") {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  return {
    url: `redis://127.0.0.1:${address.port}`,
    sockets,
    get commands() {
      return commands;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  };
}

describe("BullMQ producer failure contract", () => {
  it.each(["refused", "handshake", "disconnect", "unresponsive", "loading"] as const)(
    "%s：有限等待后拒绝入队并释放生产连接",
    async (mode) => {
      const server = await createRedisFaultServer(mode);
      const queue = createAgentQueue(server.url);
      const errors: Error[] = [];
      queue.on("error", (error) => errors.push(error));
      try {
        if (mode === "disconnect" || mode === "unresponsive") {
          await queue.waitUntilReady();
        }
        const intake = createAgentJobIntake(() => queue);
        const started = performance.now();
        await expect(
          intake.enqueue({
            prompt: "运行",
            requestedAt: "2026-06-26T00:00:00.000Z",
          }),
        ).rejects.toThrow(/ECONNREFUSED|Socket timeout|Connection is closed|LOADING/i);
        expect(performance.now() - started).toBeLessThan(3_000);
        expect(queue.getBackend().connection.status).toBe("closed");
        expect(server.commands).toBe(mode === "refused" || mode === "handshake" ? 0 : 1);
        expect(errors.length > 0).toBe(
          mode === "refused" || mode === "handshake" || mode === "unresponsive",
        );
        await expect.poll(() => server.sockets.size).toBe(0);
      } finally {
        await queue.close();
        await server.close();
      }
    },
    5_000,
  );
});
