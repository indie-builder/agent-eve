import { Queue } from "bullmq";
import { createLogger } from "@agent-template/logger";
import { agentQueueName, type AgentJobPayload } from "@agent-template/shared";
import { createBullMqConnectionOptions } from "@agent-template/shared/node";

const logger = createLogger({ service: "api" });

export function createAgentQueue(redisUrl: string) {
  const queue = new Queue<AgentJobPayload>(agentQueueName, {
    connection: {
      ...createBullMqConnectionOptions(redisUrl),
      enableOfflineQueue: false,
      // Do not poll a loading Redis indefinitely before BullMQ can fail the request.
      enableReadyCheck: false,
      retryStrategy: () => null,
      connectTimeout: 1_000,
      // TCP connectTimeout ends before Redis handshake and command responses.
      socketTimeout: 1_000,
    },
    // Agent jobs create Eve sessions; retrying a failed job could duplicate a session.
    defaultJobOptions: { attempts: 1 },
  });
  queue.on("error", (error) => {
    logger.error({ err: error }, "agent queue connection failed");
  });

  return queue;
}
