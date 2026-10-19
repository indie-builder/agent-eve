import { Worker } from "bullmq";
import { runAgent, type AgentRunResult } from "@agent-template/agent";
import { createLogger } from "@agent-template/logger";
import { agentQueueName, type AgentJobPayload } from "@agent-template/shared";
import { createBullMqConnectionOptions } from "@agent-template/shared/node";
import type { WorkerEnv } from "../../bootstrap/env.js";

type ProcessLogger = {
  info(data: unknown, message: string): void;
  error(data: unknown, message: string): void;
};

type AgentJob = {
  id?: string;
  name: string;
  data: AgentJobPayload;
};

type AgentWorker = {
  close(): Promise<void>;
};

type CreateWorkerOptions = {
  env: WorkerEnv;
  logger: ProcessLogger;
  concurrency: number;
  processJob(job: AgentJob): Promise<AgentRunResult>;
  onCompleted(job: AgentJob): void;
  onFailed(job: AgentJob | undefined, error: Error): void;
};

export type AgentWorkerProcess = {
  close(): Promise<void>;
};

export type CreateAgentWorkerProcessOptions = {
  env: WorkerEnv;
  logger?: ProcessLogger;
  createWorker?: (options: CreateWorkerOptions) => AgentWorker;
  processJob?: (payload: AgentJobPayload, env: WorkerEnv) => Promise<AgentRunResult>;
};

function createBullMqWorker(options: CreateWorkerOptions): AgentWorker {
  const worker = new Worker<AgentJobPayload>(agentQueueName, options.processJob, {
    connection: {
      ...createBullMqConnectionOptions(options.env.REDIS_URL),
      maxRetriesPerRequest: null,
    },
    concurrency: options.concurrency,
  });

  worker.on("completed", options.onCompleted);
  worker.on("failed", options.onFailed);
  worker.on("error", (error) => {
    options.logger.error({ err: error }, "agent worker connection failed");
  });

  return {
    close() {
      // Only main connection initialization rules out active jobs; blocking may still be handshaking.
      return worker.close(worker.getBackend().connection.status === "initializing");
    },
  };
}

function createAgentJobError(result: AgentRunResult): Error {
  const reason =
    result.reason ??
    (result.status === "skipped"
      ? "Agent job skipped because the Eve Agent runtime is not configured"
      : "Agent job failed");

  return new Error(reason);
}

export function createAgentWorkerProcess(
  options: CreateAgentWorkerProcessOptions,
): AgentWorkerProcess {
  const logger = options.logger ?? createLogger({ service: "worker" });
  const processJob =
    options.processJob ??
    ((payload, env) => {
      return runAgent(payload, env);
    });
  const worker = (options.createWorker ?? createBullMqWorker)({
    env: options.env,
    logger,
    concurrency: options.env.WORKER_CONCURRENCY,
    async processJob(job) {
      logger.info({ jobId: job.id, jobName: job.name }, "processing agent job");
      const result = await processJob(job.data, options.env);

      // failed/skipped must reach BullMQ as a failed job; waiting is a resumable HITL pause, not an error.
      if (result.status === "failed" || result.status === "skipped") {
        throw createAgentJobError(result);
      }

      return result;
    },
    onCompleted(job) {
      logger.info({ jobId: job.id }, "agent job completed");
    },
    onFailed(job, error) {
      logger.error({ jobId: job?.id, error }, "agent job failed");
    },
  });

  return {
    close() {
      return worker.close();
    },
  };
}

export function registerWorkerShutdown(
  workerProcess: AgentWorkerProcess,
  signalTarget: NodeJS.Process = process,
): void {
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= workerProcess.close();
    return closing;
  };

  signalTarget.on("SIGTERM", close);
  signalTarget.on("SIGINT", close);
}
