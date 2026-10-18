import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { runAgent } from "@agent-template/agent";
import { createLoggerOptions } from "@agent-template/logger";
import { agentChatRoutes } from "../modules/agent-chat/http/routes.js";
import {
  createAgentJobIntake,
  type AgentJobIntake,
} from "../modules/agent-jobs/application/intake.js";
import { agentJobRoutes } from "../modules/agent-jobs/http/routes.js";
import { createAgentQueue } from "../modules/agent-jobs/infrastructure/bullmq.js";
import { healthRoutes } from "../modules/health/http/routes.js";
import {
  createHealthAdapters,
  createDisabledHealthAdapters,
} from "../modules/health/infrastructure/dependency-checks.js";
import { loadEnv, type Env } from "./env.js";

export type BuildAppOptions = {
  env?: Env;
  checkExternal?: boolean;
  agentJobIntake?: AgentJobIntake;
  runAgent?: typeof runAgent;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const checkExternal = options.checkExternal ?? env.NODE_ENV !== "test";
  const agentJobIntake =
    options.agentJobIntake ?? createAgentJobIntake(() => createAgentQueue(env.REDIS_URL));
  const app = Fastify({ logger: createLoggerOptions({ service: "api" }) });

  void app.register(cors, { origin: env.CORS_ORIGIN });
  void app.register(healthRoutes, {
    env,
    adapters: checkExternal ? createHealthAdapters(env.REDIS_URL) : createDisabledHealthAdapters(),
  });
  void app.register(agentJobRoutes, { intake: agentJobIntake });
  void app.register(agentChatRoutes, { env, runAgent: options.runAgent ?? runAgent });

  return app;
}
