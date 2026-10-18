import IORedis from "ioredis";
import type { DependencyState } from "@agent-template/shared";
import type { HealthAdapters } from "../application/get-health.js";

async function checkDatabase(): Promise<DependencyState> {
  try {
    const { prisma } = await import("@agent-template/db");
    await withTimeout(prisma.$queryRaw`SELECT 1`, 800, "PostgreSQL check timed out");
    return { status: "ok", message: "PostgreSQL reachable" };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim() ? error.message : "PostgreSQL check failed";

    return {
      status: "error",
      message,
    };
  }
}

async function checkRedis(redisUrl: string): Promise<DependencyState> {
  const redis = new IORedis(redisUrl, {
    connectTimeout: 500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: null,
  });
  redis.on("error", () => {
    // Health checks report Redis errors in the response instead of emitting noisy client errors.
  });

  try {
    await withTimeout(
      redis.connect().then(() => redis.ping()),
      800,
      "Redis check timed out",
    );
    return { status: "ok", message: "Redis reachable" };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim() ? error.message : "Redis check failed";

    return {
      status: "error",
      message,
    };
  } finally {
    redis.disconnect();
  }
}

export function createDisabledHealthAdapters(): HealthAdapters {
  return {
    database: async () => ({
      status: "skipped",
      message: "external checks disabled",
    }),
    redis: async () => ({
      status: "skipped",
      message: "external checks disabled",
    }),
    now: () => new Date().toISOString(),
  };
}

export function createHealthAdapters(redisUrl: string): HealthAdapters {
  return {
    database: checkDatabase,
    redis: () => checkRedis(redisUrl),
    now: () => new Date().toISOString(),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
