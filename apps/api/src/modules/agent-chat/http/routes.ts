import { PassThrough } from "node:stream";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { runAgent, AgentRunResult } from "@agent-template/agent";
import { AgentRunInputSchema, type AgentRunEvent } from "@agent-template/shared";

type AgentChatRoutesOptions = {
  env: Record<string, unknown>;
  runAgent: typeof runAgent;
};

export const agentChatRoutes: FastifyPluginAsyncZod<AgentChatRoutesOptions> = async (
  app,
  { env, runAgent },
) => {
  app.post("/agent/chat", { schema: { body: AgentRunInputSchema } }, async (request, reply) => {
    const stream = new PassThrough();
    const controller = new AbortController();
    const onClose = () => {
      if (!stream.writableEnded) {
        // Abort detaches the local Eve transport; the durable turn may keep running.
        controller.abort();
        stream.destroy();
      }
    };
    stream.once("close", onClose);
    reply.raw.once("close", onClose);

    void (async () => {
      try {
        const result = await runAgent(request.body, env, {
          signal: controller.signal,
          onEvent(event) {
            writeSseEvent(stream, "agent-event", event);
          },
        });

        writeSseEvent(stream, "result", result);
      } catch (caught) {
        writeSseEvent(stream, "error", {
          message: caught instanceof Error ? caught.message : "Agent chat failed",
        });
      } finally {
        stream.off("close", onClose);
        reply.raw.off("close", onClose);
        if (!stream.destroyed) stream.end();
      }
    })();

    return reply
      .header("Cache-Control", "no-cache, no-transform")
      .header("Connection", "keep-alive")
      .header("Content-Type", "text/event-stream; charset=utf-8")
      .header("X-Accel-Buffering", "no")
      .send(stream);
  });
};

function writeSseEvent(
  stream: PassThrough,
  event: string,
  data: AgentRunEvent | AgentRunResult | { message: string },
) {
  if (stream.destroyed || stream.writableEnded) return;
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
