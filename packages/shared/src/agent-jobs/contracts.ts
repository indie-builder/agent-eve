import { z } from "zod";

export const agentJobName = "agent.run";
export const agentQueueName = "agent-jobs";

export const AgentJobNameSchema = z.literal(agentJobName);

export const AgentJobPayloadSchema = z.object({
  prompt: z.string().min(1),
  requestedAt: z.string().datetime(),
});

export const AgentJobAcceptedSchema = z.object({
  id: z.string().optional(),
  queue: z.string().min(1),
});

export type AgentJobName = z.infer<typeof AgentJobNameSchema>;
export type AgentJobPayload = z.infer<typeof AgentJobPayloadSchema>;
export type AgentJobAccepted = z.infer<typeof AgentJobAcceptedSchema>;
