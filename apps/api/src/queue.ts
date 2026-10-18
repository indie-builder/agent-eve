import { Queue } from "bullmq";
import IORedis from "ioredis";
import { agentQueueName, type AgentJobPayload } from "@agent-template/shared";
import { createBullMqConnectionOptions } from "@agent-template/shared/node";

export function createRedisPingConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    connectTimeout: 500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: null,
  });
}

export function createAgentQueue(redisUrl: string) {
  return new Queue<AgentJobPayload>(agentQueueName, {
    connection: createBullMqConnectionOptions(redisUrl),
    // Agent jobs create Eve sessions; retrying a failed job could duplicate a session.
    defaultJobOptions: { attempts: 1 },
  });
}
