import { test as base } from "@e2e-dev/web";
import { runAgent } from "../packages/agent/src/index";
import type { AgentRunEvent } from "../packages/shared/src/index";
import { buildApp } from "../apps/api/src/app";
import { loadEnv } from "../apps/api/src/env";
import { createAgentJobIntake } from "../apps/api/src/agent-job-intake";

// 仅替换外部 runtime/queue seam；HTTP、校验、SSE 与前端代码走生产实现。
export const test = base.extend<{ api: string }>({
  api: async (_fixtures, use) => {
    const sessions = new Set<string>();
    const app = buildApp({
      env: loadEnv({
        NODE_ENV: "test",
        CORS_ORIGIN: "http://localhost:13020",
        EVE_AGENT_HOST: "http://localhost:13010",
      }),
      checkExternal: false,
      agentJobIntake: createAgentJobIntake({
        redisUrl: "redis://localhost:16379",
        createQueue: () => ({
          name: "agent-jobs",
          add: async () => ({ id: "acceptance-job" }),
          close: async () => {},
        }),
      }),
      runAgent: (input, env, options) =>
        runAgent(input, env, {
          ...options,
          runEve: async (request, _config, callbacks) => {
            if (request.continuation && !sessions.has(request.continuation.token)) {
              throw new Error("Unknown continuation");
            }
            const token = request.continuation?.token ?? crypto.randomUUID();
            sessions.add(token);
            const confirmation = request.prompt === "生成报表";
            const confirmed = request.responses?.[0];
            if (
              confirmed &&
              (confirmed.kind !== "selected-option" ||
                confirmed.requestId !== "confirm-report" ||
                confirmed.optionId !== "yes")
            ) {
              throw new Error("Invalid confirmation response");
            }
            const output = confirmed ? "报表已生成。" : `**收到：${request.prompt}**`;
            const event: AgentRunEvent = confirmation
              ? {
                  kind: "input-requested",
                  requests: [
                    {
                      requestId: "confirm-report",
                      prompt: "是否生成报表？",
                      tool: "report",
                      display: "confirmation",
                      options: [{ id: "yes", label: "确认生成" }],
                    },
                  ],
                }
              : { kind: "done", result: output };
            callbacks?.onEvent?.(event);
            return {
              status: confirmation ? "waiting" : "completed",
              events: [event],
              output: confirmation ? "" : output,
              sessionId: token,
              continuation: { token },
            };
          },
        }),
    });
    try {
      await app.listen({ host: "127.0.0.1", port: 14020 });
      await use("http://127.0.0.1:14020");
    } finally {
      await app.close();
    }
  },
});
