import { z } from "zod";

export const AgentArtifactSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  content: z.string(),
});

export const AgentInputRequestSchema = z.object({
  requestId: z.string(),
  prompt: z.string(),
  tool: z.string(),
  display: z.enum(["confirmation", "select", "text"]).optional(),
  allowFreeform: z.boolean().optional(),
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string().optional(),
        style: z.enum(["danger", "default", "primary"]).optional(),
      }),
    )
    .optional(),
});

export const AgentRunEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tool-call"),
    tool: z.string(),
    input: z.string(),
  }),
  z.object({
    kind: z.literal("tool-result"),
    tool: z.string(),
    status: z.enum(["completed", "failed", "rejected"]).optional(),
    error: z.string().optional(),
  }),
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("done"), result: z.string() }),
  z.object({ kind: z.literal("error"), message: z.string() }),
  z.object({
    kind: z.literal("input-requested"),
    requests: z.array(AgentInputRequestSchema),
  }),
  z.object({
    kind: z.literal("authorization"),
    connection: z.string(),
    status: z.enum(["required", "authorized", "declined", "failed", "timed-out"]),
    description: z.string().optional(),
    url: z.string().url().optional(),
    userCode: z.string().optional(),
    instructions: z.string().optional(),
  }),
  z.object({
    kind: z.literal("subagent"),
    name: z.string(),
    status: z.enum(["started", "completed", "failed", "stopped"]),
    sessionId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("compaction"),
    status: z.enum(["requested", "completed"]),
    inputTokens: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("usage"),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    cacheReadTokens: z.number().int().nonnegative().optional(),
    cacheWriteTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }),
  z.object({ kind: z.literal("waiting") }),
  z.object({
    kind: z.literal("artifacts"),
    tabs: z.array(AgentArtifactSchema),
  }),
  z.object({ kind: z.literal("unknown"), text: z.string() }),
]);

export type AgentArtifact = z.infer<typeof AgentArtifactSchema>;
export type AgentInputRequest = z.infer<typeof AgentInputRequestSchema>;
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;
