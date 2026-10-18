import { defineAgent, type AgentDefinition } from "eve";
import {
  createEveAnthropicModel,
  readEveAgentRuntimeLimits,
} from "../src/provider";

const limits = readEveAgentRuntimeLimits(process.env);

const agent: AgentDefinition = defineAgent({
  model: createEveAnthropicModel(process.env),
  modelContextWindowTokens: limits.modelContextWindowTokens,
  compaction: {
    modelContextWindowTokens: limits.modelContextWindowTokens,
    thresholdPercent: limits.compactionThreshold,
  },
  limits: {
    maxInputTokensPerSession: limits.maxInputTokensPerSession,
    maxOutputTokensPerSession: limits.maxOutputTokensPerSession,
  },
  experimental: {
    workflow: {
      world: "@workflow/world-postgres",
    },
  },
  build: {
    externalDependencies: ["@workflow/world-postgres"],
  },
});

export default agent;
