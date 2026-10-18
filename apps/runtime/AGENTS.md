# apps/runtime 协作指南

## 职责

`apps/runtime` 是独立部署的 Eve 服务，package 名 `@agent-template/runtime`。`agent/` 是 Eve filesystem-first authored surface，`evals/` 是模型行为回归用例，`src/` 放只属于运行进程的 provider 与 channel auth。

## 能力边界

- `agent/agent.ts` 用 `@agent-template/agent-eve/config` 的 `readEveAgentModel` 读取模型名，用 `src/provider.ts` 创建 Anthropic-compatible model 并读取 context window、compaction 和 session token limits。
- `agent/channels/eve.ts` 用 `src/trust-policy.ts` 组装 route auth；service token 摘要比较复用 `@agent-template/agent-eve/trust-policy`，不要在 runtime 复制 auth 规则。
- `EVE_AGENT_MODEL` / `ANTHROPIC_MODEL` 默认 `group/flash`；通过 Anthropic Messages 协议调用本地网关，base URL 默认 `http://127.0.0.1:3425/v1`，`EVE_MAX_OUTPUT_TOKENS` 默认 1024。模型配置只属于 runtime，client 状态不报告模型。
- 本地 Eve CLI 从 `apps/runtime/.env.local` 读取凭证；Compose 从根 `.env` 注入，容器访问宿主机网关用 `ANTHROPIC_DOCKER_BASE_URL`。
- `EVE_AGENT_SERVICE_TOKEN` 是 API/Worker 到 Eve HTTP channel 的服务凭证；production 不注册 `localDev()`。
- Toolbox MCP connection 在 `agent/connections/toolbox.ts`，从 `TOOLBOX_URL` 读 endpoint，allowlist 只能包含只读 Tool。
- `agent/instructions.md`、`agent/skills/`、`agent/tools/`、`agent/hooks/`、`agent/instrumentation/`、`agent/sandbox.ts` 按 Eve 语义增长。
- 业务 Skill 由 `pnpm --filter @agent-template/toolbox skills:generate` 生成，直接写入当前目录的 `agent/skills`。
- `agent/tools/web_search.ts` 等 disabled tool 是 本地 Anthropic 网关与最小权限基线，恢复前必须重新评估权限、审批和 sandbox egress。
- `sandbox.ts` 固定 `JustBashSandbox.environment({ autoInstall: false })`，避免隐式 Docker。
- `agent/agent.ts` 的 `experimental.workflow.world` 固定为 `@workflow/world-postgres`，`build.externalDependencies` 同步列出该包；package 依赖版本必须与 eve vendored 的 `@workflow/*` spec 兼容，不要用 local world 兜底。
- world 连接、并发和 pool 只走 `WORKFLOW_POSTGRES_*` 环境变量；`workflow:setup` 是独立的一次性迁移命令，不在 replica 启动路径里执行。
- `just-bash` 仍在 runtime 进程内执行，shared world 只共享 durable run/queue/stream 状态；不要据此假设 sandbox 可跨副本。

## 不应该做

- 不导入其他 workspace 包的源码相对路径；只使用 package exports。
- 不在这里放 HTTP client、continuation、event projection 或 HITL 转换，这些属于 `@agent-template/agent-eve`。
- 不把 API Key、服务 token 或数据库连接信息写入仓库。
- 不凭记忆写 Eve API；以 `node_modules/eve/docs/` 和 `.agents/skills/eve` 为准。

## 验证

```bash
pnpm --filter @agent-template/runtime lint
pnpm --filter @agent-template/runtime typecheck
pnpm --filter @agent-template/runtime test
pnpm --filter @agent-template/runtime build
pnpm --filter @agent-template/runtime info
pnpm --filter @agent-template/runtime eval:list
```

`eve eval` 会调用真实模型，不属于无凭证的静态质量门禁。
