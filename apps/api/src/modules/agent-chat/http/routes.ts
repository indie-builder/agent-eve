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

    void (async () => {
      try {
        const result = await runAgent(request.body, env, {
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
        stream.end();
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
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}
