import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { HealthStatusSchema } from "@agent-template/shared";
import { getHealth, type HealthAdapters } from "../application/get-health.js";

type HealthRoutesOptions = {
  env: Record<string, unknown>;
  adapters: HealthAdapters;
};

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (
  app,
  { env, adapters },
) => {
  app.get("/health", { schema: { response: { 200: HealthStatusSchema } } }, async () =>
    getHealth(env, adapters),
  );
};
