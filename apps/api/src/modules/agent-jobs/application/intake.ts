import {
  agentJobName,
  AgentJobAcceptedSchema,
  AgentJobPayloadSchema,
  type AgentJobAccepted,
  type AgentJobName,
  type AgentJobPayload,
} from "@agent-template/shared";

export type AgentJobIntake = {
  enqueue(input: unknown): Promise<AgentJobAccepted>;
};

type AgentJobQueue = {
  name: string;
  add(name: AgentJobName, payload: AgentJobPayload): Promise<{ id?: string | undefined }>;
  close(): Promise<unknown>;
};

export function createAgentJobIntake(createQueue: () => AgentJobQueue): AgentJobIntake {
  return {
    async enqueue(input) {
      const payload = AgentJobPayloadSchema.parse(input);
      const queue = createQueue();

      try {
        const job = await queue.add(agentJobName, payload);
        return AgentJobAcceptedSchema.parse({ id: job.id, queue: queue.name });
      } finally {
        await queue.close();
      }
    },
  };
}
