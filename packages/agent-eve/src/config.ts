export const defaultEveAgentModel = "group/flash";

export function readEveAgentModel(input: Record<string, unknown>): string {
  return typeof input.EVE_AGENT_MODEL === "string" && input.EVE_AGENT_MODEL.length > 0
    ? input.EVE_AGENT_MODEL
    : typeof input.ANTHROPIC_MODEL === "string" && input.ANTHROPIC_MODEL.length > 0
      ? input.ANTHROPIC_MODEL
      : defaultEveAgentModel;
}
