# apps/api 协作指南

## 职责

`apps/api` 是 Fastify HTTP API，负责请求入口、健康检查、Chat SSE、任务入队和运行时依赖检查。

## 能力边界

- HTTP 路由和 Fastify app 装配放在这里。
- 数据库访问通过 `@agent-template/db`。
- Agent job intake 通过 `AgentJobIntake.enqueue(input)` 暴露给 route；BullMQ queue lifecycle 留在 `src/agent-job-intake.ts`。
- Agent Chat 通过 `POST /agent/chat` 启动 Agent run，并用 SSE 返回 Agent run event 和最终结果。
- 任务队列使用 BullMQ，并通过 `@agent-template/shared` 的队列名和 payload schema 保持类型一致。
- 日志使用 `@agent-template/logger`。
- Agent run 和 Agent runtime 状态通过 `@agent-template/agent` 读取，不在 API 内直接调用 Eve。
- 不提供 MCP server registry、tool discovery、tool call 或 resource proxy route；MCP 属于 Eve runtime。

## 不应该做

- 不在 API 内处理耗时 queued Agent job；queued job 只负责校验请求并入队。
- 不在 API 内定义共享 schema；schema 放 `packages/shared`。
- 不在 API 内创建独立 logger 抽象；logger 规则放 `packages/logger`。
- 不让 Fastify route 直接知道 Redis URL、BullMQ `Queue.add` 或 queue close 细节。
- 不从 request payload 选择或覆盖 Agent runtime；runtime 固定为 `eve`。

## 健康检查

`GET /health` 必须快速返回。PostgreSQL 或 Redis 不可用时应返回 `degraded`，不能让请求长时间挂起。

## 测试归属

- HTTP契约和Chat用户流程统一放根 `tests/`，使用e2e真实HTTP请求验收，不在inject与e2e重复维护成功路径。
- 本目录仅保留health故障聚合、queue资源释放等必要底层检查。非法请求返回400；runtime执行中失败通过SSE error表达。

## 验证

```bash
pnpm --filter @agent-template/api lint
pnpm --filter @agent-template/api test
pnpm --filter @agent-template/api typecheck
pnpm --filter @agent-template/api build
```
