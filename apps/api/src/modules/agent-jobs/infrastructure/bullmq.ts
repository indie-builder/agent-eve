import { Queue } from "bullmq";
import { agentQueueName, type AgentJobPayload } from "@agent-template/shared";
import { createBullMqConnectionOptions } from "@agent-template/shared/node";

export function createAgentQueue(redisUrl: string) {
  return new Queue<AgentJobPayload>(agentQueueName, {
    connection: createBullMqConnectionOptions(redisUrl),
    // Agent jobs create Eve sessions; retrying a failed job could duplicate a session.
    defaultJobOptions: { attempts: 1 },
  });
}
