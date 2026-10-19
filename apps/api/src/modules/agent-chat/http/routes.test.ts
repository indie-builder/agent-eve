import { request } from "node:http";
import type { PassThrough } from "node:stream";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "@fastify/type-provider-zod";
import { runAgent } from "@agent-template/agent";
import { describe, expect, it, vi } from "vitest";
import { agentChatRoutes } from "./routes.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Socket closure and runtime resource release cannot be observed by the browser happy-path journey.
describe("Chat stream resource lifecycle", () => {
  it("aborts runtime transport when a real HTTP SSE client disconnects", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const stopped = deferred();
    let runtimeSignal: AbortSignal | undefined;
    let stream: PassThrough | undefined;
    let closeListener: (() => void) | undefined;
    let writes: ReturnType<typeof vi.spyOn> | undefined;
    app.addHook("onSend", async (_request, _reply, payload) => {
      stream = payload as PassThrough;
      closeListener = stream.listeners("close")[0] as (() => void) | undefined;
      writes = vi.spyOn(stream, "write");
      return payload;
    });
    await app.register(agentChatRoutes, {
      env: { EVE_AGENT_HOST: "http://127.0.0.1:13010" },
      runAgent: (input, env, options) =>
        runAgent(input, env, {
          ...options,
          runEve: async (_input, _config, execution) => {
            runtimeSignal = execution?.signal;
            expect(runtimeSignal).toBeDefined();
            const aborted = deferred();
            const onAbort = () => aborted.resolve();
            runtimeSignal!.addEventListener("abort", onAbort, { once: true });
            execution?.onEvent?.({ kind: "text", text: "Working" });
            try {
              await aborted.promise;
              writes?.mockClear();
              execution?.onEvent?.({ kind: "text", text: "Late event" });
              return { status: "failed", events: [], reason: "Transport detached" };
            } finally {
              runtimeSignal!.removeEventListener("abort", onAbort);
              stopped.resolve();
            }
          },
        }),
    });
    const origin = await app.listen({ port: 0, host: "127.0.0.1" });
    const disconnected = deferred();
    const client = request(`${origin}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    client.on("error", disconnected.reject);
    client.on("response", (response) => {
      expect(response.headers["content-type"]).toContain("text/event-stream");
      response.once("data", () => {
        response.destroy();
        disconnected.resolve();
      });
    });
    client.end(JSON.stringify({ prompt: "Run" }));
    try {
      await disconnected.promise;
      await stopped.promise;
      // Let the route assemble its result and run finally after the fake runtime settles.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(runtimeSignal?.aborted).toBe(true);
      expect(stream?.destroyed).toBe(true);
      expect(writes).not.toHaveBeenCalled();
      expect(closeListener).toBeDefined();
      expect(stream?.listeners("close")).not.toContain(closeListener);
    } finally {
      client.destroy();
      await app.close();
    }
  });

  it("cleans close listeners without cancelling a normally ended response", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    let signal: AbortSignal | undefined;
    let stream: PassThrough | undefined;
    let closeListener: (() => void) | undefined;
    app.addHook("onSend", async (_request, _reply, payload) => {
      stream = payload as PassThrough;
      closeListener = stream.listeners("close")[0] as (() => void) | undefined;
      return payload;
    });
    await app.register(agentChatRoutes, {
      env: {},
      runAgent: async (_input, _env, options) => {
        signal = options?.signal;
        await new Promise<void>((resolve) => setImmediate(resolve));
        return { runtime: "eve", configured: false, promptLength: 3, status: "skipped" };
      },
    });
    const origin = await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const response = await fetch(`${origin}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Run" }),
      });
      await response.text();
      expect(signal?.aborted).toBe(false);
      expect(stream?.writableEnded).toBe(true);
      expect(closeListener).toBeDefined();
      expect(stream?.listeners("close")).not.toContain(closeListener);
    } finally {
      await app.close();
    }
  });
});
