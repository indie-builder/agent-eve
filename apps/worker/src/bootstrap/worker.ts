import { loadWorkerEnv } from "./env.js";
import {
  createAgentWorkerProcess,
  registerWorkerShutdown,
} from "../modules/agent-jobs/consumer.js";

const workerProcess = createAgentWorkerProcess({ env: loadWorkerEnv() });
registerWorkerShutdown(workerProcess);
