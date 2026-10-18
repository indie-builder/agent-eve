import { defineAgent, type AgentDefinition } from "eve";
import {
  createEveAnthropicModel,
  readEveAgentRuntimeLimits,
} from "../src/config";

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
});

export default agent;
