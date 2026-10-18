# packages/agent-eve 协作指南

## 职责

`packages/agent-eve` 是基于官方 `vercel/eve` npm 包的 Eve filesystem-first runtime，`agent/` 是该 runtime 的 authored surface。

## 能力边界

- `src/` 放运行时加载、状态和执行边界。
- `agent/agent.ts` 使用 `eve` 导出的 `defineAgent` 放 runtime config。
- `EVE_AGENT_MODEL` 由 `src/config.ts` 统一读取，runtime state 和 `agent/agent.ts` 必须同源。
- `EVE_AGENT_HOST` 是 Eve execution adapter 连接官方 Eve HTTP API 的运行配置；未配置时 execution 返回 skipped。
- `EVE_AGENT_SERVICE_TOKEN` 是 API/Worker 到 Eve HTTP channel 的服务凭证；仅 loopback 本地开发可省略，任何非 loopback `EVE_AGENT_HOST` 必须配置，client 使用禁止重定向的请求发送 `x-agent-template-eve-token`，Eve channel 以恒定时间摘要比较校验。
- Docker Compose 提供 `eve-agent` 服务，默认监听 `13010`，API/Worker 通过 `EVE_AGENT_HOST` 连接它。
- Kimi Code 通过 `@ai-sdk/anthropic` 的 Anthropic-compatible provider 接入 Eve authored surface。
- Eve 默认使用 `ANTHROPIC_BASE_URL=https://api.kimi.com/coding/`、`ANTHROPIC_MODEL=kimi-for-coding`、`ANTHROPIC_API_KEY`。
- Kimi 模型不是 Eve/AI Gateway catalog 内置模型，`agent/agent.ts` 必须显式设置 `modelContextWindowTokens` 和 `compaction.modelContextWindowTokens`，避免 Eve 编译期查不到 context window metadata。
- `agent/instructions.md` 放基础 system prompt。
- `agent/channels/eve.ts` 放 Eve HTTP route auth；不要删除 API service auth，否则 `@agent-template/agent-eve` client 会被 Eve session route 拒绝。
- `agent/tools/web_search.ts` 禁用 Eve provider-managed `web_search`；Kimi Anthropic-compatible stream 会返回缺少 `id` 的 server tool block，启用后会触发 Eve/AI SDK 类型校验失败。
- 生产 surface 默认关闭 `bash`、`read_file`、`write_file`、`web_fetch` 和 `web_search`；`glob`、`grep`、`sleep`、`ask_question` 是 opt-in 工具，未 auth 时无需 disable 文件。需要恢复能力时必须先定义最小权限、审批和 sandbox egress 策略。Eve 0.80 起 `agent/tools/agent.ts` 可用 `disableTool()` 关闭内建 `agent`，但会同时失去 `ctx.agent()` 的 workflow 调用入口，默认保留并靠 session token 预算收口。
- 当前 sandbox 使用 `JustBashSandbox.environment({ autoInstall: false })` 并通过 `defineSandbox(() => environment.open())` 绑定，避免 Eve `DefaultSandbox` 在本地或自托管环境隐式启动 Docker；如恢复 shell/文件能力，必须重新评估并切换为具有明确 egress policy 的强隔离 backend。
- `agent/instrumentation/` 目录替代旧的 `agent/instrumentation.ts`：`otel.ts` 声明进程级 metadata-only trace policy，`runtime-context.ts` 只注入 channel/principal 类型；不再使用 `recordInputs`/`recordOutputs` 或 `events["step.started"]` 旧字段。
- Eve `ClientSessionState` 只存在于 runtime adapter 内部，通过 shared opaque `continuation.token` 往返；client 使用 `sessions.create()` / `sessions.attach()`，`session.waiting` 和 `turn.waiting(on: "input")` 都映射为 `waiting`，不能误报为 completed 或丢弃 continuation。HITL option 必须通过 shared `responses` 转换为 Eve `InputResponse`，调用 `session.respond()`，不要要求用户依赖文本 heuristic。
- Eve stream 事件使用 delta-only 契约：`message.appended` 只携带 `messageDelta`，adapter 必须自行累加到 `AgentRunEvent.text`；`message.completed` 提供权威文本。
- production Eve channel 不注册 `localDev()`，避免伪造 Host 绕过 service token；仅 development/test 可使用 local fallback。
- instrumentation 不记录模型输入输出正文；hook 日志只记录 session lifecycle、channel、错误码和授权结果，不记录 prompt、tool input/output 或凭证。
- `agent/tools`、`agent/skills`、`agent/channels`、`agent/hooks`、`agent/instrumentation`、`agent/sandbox`、`agent/subagents` 按 Eve 语义增长。
- 电商业务 Skill 以 Toolbox 官方 `skills-generate` 产物为来源，通过 `pnpm --filter @agent-template/toolbox skills:generate` 同步到 Eve 与 Claude authored surface。
- 运行时 Skill 只安装适配后的 `SKILL.md`，并调用 `toolbox__<tool>` connection tools；不要把官方生成的数据库直连脚本复制进 Agent skill 目录。
- Toolbox 能力通过 `agent/connections/toolbox.ts` 的 Eve MCP connection 接入；该文件维护 endpoint 和 `tools.allow`，不要恢复一组 authored tool 转发器。
- Eve stream 事件需要转换成 shared `AgentRunEvent`，至少覆盖 `message.completed`、`actions.requested`、`action.result` 和失败事件，保证 API Chat SSE 与前端 timeline 可用。
- `eve` 依赖的 package spec 保持 `latest`，不要改成固定版本、`^x.y.z` 或 major range；该框架迭代快，按用户要求跟随 npm latest tag。
- 开发 Eve runtime、authored surface 或相关测试前，先使用 `.codex/skills/eve`。
- 涉及 API 细节时必须读取当前安装版本的 `node_modules/eve/docs/README.md` 和相关文档。

## 不应该做

- 不实现 runtime selector；selector 留在 `@agent-template/agent`。
- 不让 `apps/*` 直接依赖这个包。
- 不把 Claude SDK 逻辑写进这里。
- 不把 Kimi API Key 写入仓库。
- 不把 PostgreSQL 连接信息或 Toolbox `tools.yaml` 复制进 Eve runtime package；数据库权限留在 `apps/toolbox`。
- 不在 Eve runtime 外再抽 MCP client lifecycle 或平台 registry；连接生命周期由 Eve connection runtime 管理。
- 不凭记忆直接写 Eve API；以官方文档、本地 Eve skill 和安装包 docs 为准。

## 官方参考

- Eve introduction: `https://eve.dev/docs/introduction`
- vercel/eve: `https://github.com/vercel/eve`
- MCP protocol introduction: `https://modelcontextprotocol.io/docs/getting-started/intro`
- Kimi Code docs: `https://www.kimi.com/code/docs/`

## 验证

```bash
pnpm --filter @agent-template/agent-eve lint
pnpm --filter @agent-template/agent-eve test
pnpm --filter @agent-template/agent-eve typecheck
pnpm --filter @agent-template/agent-eve build
pnpm --filter @agent-template/agent-eve eve:info
pnpm --filter @agent-template/agent-eve eve:eval:list
```
