# packages/agent 协作指南

## 职责

`packages/agent` 是 Agent runtime 公共边界，直接委派 Eve runtime，并执行 Agent run 的公共 contract。

## 能力边界

- `AgentRuntimeEnvSchema` / `parseAgentRuntimeEnv` 统一维护 Eve HTTP client 连接环境变量。
- `getAgentRuntimeStateFromEnv` 返回固定 runtime `eve`、连接配置状态。
- package 根入口直接指向 `src/run/agent-run.ts`；同目录 `agent-run.test.ts` 验证公共 contract。
- `runAgent` 是 Chat SSE 和 Worker 共同调用的 Agent run execution seam，负责 run input validation、Eve dispatch 和 execution result assembly。
- 具体实现委派给 `@agent-template/agent-eve`。
- runtime adapter 已产生的 Agent run event 通过 `AgentRunResult.events` 透出；这里不新增持久化。
- shared continuation 保持 runtime-neutral opaque token；Eve adapter 负责解析自己的 session cursor。结构化 input response 原样交给 Eve。
- `runAgent` 接受 `runEve` 注入，测试用它替换 runtime 调用。

## 不应该做

- 不在这里处理 HTTP 请求。
- 不在这里处理 BullMQ job 生命周期。
- 不把具体业务 prompt 或产品逻辑写进公共 agent package。
- 不从 request payload 或 job payload 选择或覆盖 runtime；`runtime` 固定为 `eve`。
- 不要求本地开发必须配置 `ANTHROPIC_API_KEY` 或 `EVE_AGENT_HOST`；未配置 host 时 Eve 返回 `status: "skipped"`。
- 不把未配置 runtime 伪装成已执行成功。
- 不把 Toolbox server 当成 Agent runtime；它是 Eve 连接的外部 Tool provider。

## 验证

```bash
pnpm --filter @agent-template/agent lint
pnpm --filter @agent-template/agent test
pnpm --filter @agent-template/agent typecheck
pnpm --filter @agent-template/agent build
```
