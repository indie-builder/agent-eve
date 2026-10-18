import { z } from "zod";
import { AgentRunEventSchema } from "./agent-run-events";

export const AgentContinuationSchema = z.object({
  token: z.string().min(1),
});

export const AgentInputResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("selected-option"),
    requestId: z.string().min(1),
    optionId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("selected-options"),
    requestId: z.string().min(1),
    optionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("text"),
    requestId: z.string().min(1),
    text: z.string().min(1),
  }),
]);

export const AgentRunInputSchema = z
  .object({
    prompt: z.string().min(1).optional(),
    continuation: AgentContinuationSchema.optional(),
    responses: z.array(AgentInputResponseSchema).min(1).optional(),
  })
  .refine((input) => input.prompt || input.responses, {
    message: "An Agent run requires a prompt or input responses",
  })
  .refine((input) => !input.responses || input.continuation, {
    message: "Agent input responses require a continuation",
  });

export const AgentRunResultSchema = z.object({
  promptLength: z.number().int().nonnegative(),
  runtime: z.literal("eve"),
  configured: z.boolean(),
  status: z.enum(["skipped", "waiting", "completed", "failed"]),
  events: z.array(AgentRunEventSchema).optional(),
  output: z.string().optional(),
  reason: z.string().optional(),
  sessionId: z.string().optional(),
  continuation: AgentContinuationSchema.optional(),
});

export type AgentContinuation = z.infer<typeof AgentContinuationSchema>;
export type AgentInputResponse = z.infer<typeof AgentInputResponseSchema>;
export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;
export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;
