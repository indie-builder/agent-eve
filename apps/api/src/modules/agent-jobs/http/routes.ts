import type { FastifyPluginAsync } from "fastify";
import { AgentJobPayloadSchema } from "@agent-template/shared";
import type { AgentJobIntake } from "../application/intake.js";

type AgentJobRoutesOptions = {
  intake: AgentJobIntake;
};

export const agentJobRoutes: FastifyPluginAsync<AgentJobRoutesOptions> = async (
  app,
  { intake },
) => {
  app.post("/agent/jobs", async (request, reply) => {
    const parsed = AgentJobPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "请求参数无效", issues: parsed.error.issues });
    }
    const result = await intake.enqueue(parsed.data);
    return reply.code(202).send(result);
  });
};
