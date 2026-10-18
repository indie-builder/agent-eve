# packages/agent-eve 协作指南

## 职责

`packages/agent-eve` 是 Eve HTTP client 与平台适配包，不再包含 Eve authored surface。可运行的 Eve 服务、模型 provider 和 Toolbox MCP connection 属于 `apps/runtime`（`@agent-template/runtime`）。

## 能力边界

- `src/index.ts` 放 Eve client 调用、config 解析、continuation、HITL response 和 stream event projection。
- `src/config.ts` 只解析模型名（`EVE_AGENT_MODEL` / `ANTHROPIC_MODEL`），通过 `./config` subpath 供 runtime authored surface 复用；client 状态不报告模型配置。
- `src/trust-policy.ts` 只保留 client 侧 loopback 判断和 service token 摘要比较，通过 `./trust-policy` subpath 供 runtime channel auth 复用；不要在这里定义 `AuthFn` 或复制 auth walk。
- `EVE_AGENT_HOST` 是 Eve 服务地址；未配置时 execution 返回 skipped。
- `EVE_AGENT_SERVICE_TOKEN` 是 API/Worker 到 Eve HTTP channel 的服务凭证；仅 loopback 本地开发可省略，任何非 loopback `EVE_AGENT_HOST` 必须配置，client 使用禁止重定向的请求发送 `x-agent-template-eve-token`。
- Eve `ClientSessionState` 只存在于 adapter 内部，通过 shared opaque `continuation.token` 往返；client 使用 `sessions.create()` / `sessions.attach()`。
- HITL option 必须通过 shared `responses` 转换为 Eve `InputResponse`，调用 `session.respond()`。
- Eve stream 事件使用 delta-only 契约：`message.appended` 只携带 `messageDelta`，adapter 必须自行累加到 `AgentRunEvent.text`。
- Eve stream 事件需要转换成 shared `AgentRunEvent`，至少覆盖 `message.completed`、`actions.requested`、`action.result` 和失败事件。
- 模型 provider（`@ai-sdk/anthropic`、`ai`）、`just-bash`、`agent/` 和 `evals/` 不进入本包。
- `eve` 依赖的 package spec 保持 `latest`，不要改成固定版本、`^x.y.z` 或 major range。
- 涉及 API 细节时必须读取当前安装版本的 `node_modules/eve/docs/README.md` 和相关文档。

## 不应该做

- 公共 Agent run 输入校验与应用入口留在 `@agent-template/agent`。
- API/Worker 通过 `@agent-template/agent` 使用 client；`apps/runtime` 仅通过 config/trust-policy subpath 复用共享解析。
- 不把 Kimi API Key 写入仓库。
- 不维护 Eve authored surface、MCP connection 或 channel auth。
- 不凭记忆直接写 Eve API；以官方文档、本地 Eve skill 和安装包 docs 为准。

## 验证

```bash
pnpm --filter @agent-template/agent-eve lint
pnpm --filter @agent-template/agent-eve typecheck
pnpm --filter @agent-template/agent-eve test
pnpm --filter @agent-template/agent-eve build
```
