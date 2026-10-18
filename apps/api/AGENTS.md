# apps/api 协作指南

## 职责

`apps/api` 是 Fastify HTTP API，负责请求入口、健康检查、Chat SSE、任务入队和运行时依赖检查。

## 能力边界

- `src/bootstrap/server.ts` 负责监听与进程退出；`src/bootstrap/env.ts` 解析环境变量。
- `src/bootstrap/app.ts` 保留 `buildApp` 注入 interface，选择生产/disabled health adapter、绑定 Redis URL 的 queue factory，只装配 CORS 和三个 feature route module。
- `src/modules/agent-chat/http/routes.ts` 负责 Chat 输入校验、SSE headers、事件编码和错误收尾，直接调用注入的 `runAgent`，不增加透传 application。
- `src/modules/agent-jobs/http/routes.ts` 负责 HTTP 校验与 202 响应；`application/intake.ts` 通过 `AgentJobIntake.enqueue(input)` 封装校验、入队、acceptance metadata 校验和 finally close，只依赖无参数 `createQueue` factory。
- `src/modules/agent-jobs/infrastructure/bullmq.ts` 创建 BullMQ queue；route/application 不依赖 Redis URL 或 BullMQ。
- `src/modules/health/http/routes.ts` 注册健康检查；`application/get-health.ts` 只依赖 `HealthAdapters` 聚合状态，不 import infrastructure；`infrastructure/dependency-checks.ts` 持有 PostgreSQL/Redis ping、超时和 Redis disconnect。
- 每个 feature 通过 Fastify `register` 封装，不引入 DI 库或无意义 controller/service。
- 数据库访问通过 `@agent-template/db`。
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

## HTTP类型与校验

- 统一使用官方 `@fastify/type-provider-zod`；bootstrap注册validator/serializer，每个route module使用 `FastifyPluginAsyncZod`，从shared Zod schema推导请求与响应类型。
- 请求体在 `schema.body` 声明，普通JSON响应在 `schema.response` 声明；校验错误统一返回400，内部异常和响应契约错误保留500。应用公共入口仍校验非HTTP调用方输入。
- Chat SSE只声明输入schema，保持stream编码，不套普通JSON response serializer。业务schema继续放shared，不另建TypeBox/JSON Schema副本。
- Fastify相关改动使用项目已安装的 `fastify-best-practices`；具体Zod Provider API以当前官方包文档为准。

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
