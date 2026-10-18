import type { FastifyPluginAsync } from "fastify";
import { getHealth, type HealthAdapters } from "../application/get-health.js";

type HealthRoutesOptions = {
  env: Record<string, unknown>;
  adapters: HealthAdapters;
};

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  { env, adapters },
) => {
  app.get("/health", async () => getHealth(env, adapters));
};
