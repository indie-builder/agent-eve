import { getAgentRuntimeStateFromEnv } from "@agent-template/agent";
import {
  createHealthStatus,
  agentQueueName,
  type DependencyState,
  type HealthStatus,
} from "@agent-template/shared";

export type HealthAdapters = {
  database(): Promise<DependencyState>;
  redis(): Promise<DependencyState>;
  now(): string;
};

export async function getHealth(
  env: Record<string, unknown>,
  adapters: HealthAdapters,
): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([adapters.database(), adapters.redis()]);
  const status = database.status === "error" || redis.status === "error" ? "degraded" : "ok";

  return createHealthStatus({
    service: "api",
    status,
    timestamp: adapters.now(),
    database,
    redis,
    queue: {
      name: agentQueueName,
      status: redis.status === "error" ? "unavailable" : "ready",
    },
    agent: getAgentRuntimeStateFromEnv(env),
  });
}
