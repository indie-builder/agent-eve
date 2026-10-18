import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { AgentJobAcceptedSchema, AgentJobPayloadSchema } from "@agent-template/shared";
import type { AgentJobIntake } from "../application/intake.js";

type AgentJobRoutesOptions = {
  intake: AgentJobIntake;
};

export const agentJobRoutes: FastifyPluginAsyncZod<AgentJobRoutesOptions> = async (
  app,
  { intake },
) => {
  app.post(
    "/agent/jobs",
    {
      schema: {
        body: AgentJobPayloadSchema,
        response: { 202: AgentJobAcceptedSchema },
      },
    },
    async (request, reply) => {
      const result = await intake.enqueue(request.body);
      return reply.code(202).send(result);
    },
  );
};
