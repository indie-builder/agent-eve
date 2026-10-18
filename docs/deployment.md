# 独立服务部署

项目采用 pnpm Workspace + Turborepo 管理一个仓库，前后端与后台执行分别部署。共享仓库和构建缓存不等于共享运行进程。

| 服务       | 目录         | 职责                                    | 主要负载                  | 扩容方式                            |
| ---------- | ------------ | --------------------------------------- | ------------------------- | ----------------------------------- |
| Web        | apps/web     | 页面、交互、调用 API                    | 页面请求与静态资源        | 独立副本 / CDN                      |
| API        | apps/api     | HTTP 校验、Chat SSE、job intake         | 请求数、SSE 连接数        | 无本地会话状态，独立副本            |
| Worker     | apps/worker  | BullMQ 消费、调用 Eve                   | 队列长度、运行时延        | 副本数 + WORKER_CONCURRENCY         |
| Runtime    | apps/runtime | Eve 模型执行、会话、HITL、MCP、Workflow | 模型并发、token、工具调用 | 独立副本，共享 PostgreSQL world     |
| Toolbox    | apps/toolbox | 受限 SQL Tool provider                  | 查询并发、连接池          | 独立副本，受数据库容量约束          |
| PostgreSQL | 独立基础设施 | 业务数据                                | 数据量、查询              | 按数据库方式管理                    |
| Redis      | 独立基础设施 | BullMQ 队列                             | job 数、队列操作          | AOF + noeviction；按 Redis 方式管理 |

调用关系：Web → API；Chat 由 API → Eve HTTP stream；后台 job 由 API → Redis/BullMQ → Worker → Eve；Eve → Toolbox → PostgreSQL。`packages/agent` 提供输入校验和公共 Agent run interface，`packages/agent-eve` 封装 HTTP client、事件投影与 opaque continuation，不在 API/Worker 进程执行模型。

## 镜像与启动

根 Dockerfile 提供 `web`、`api`、`worker`、`runtime` 四个独立 final target。Compose 为每个服务选择对应 target；Toolbox、PostgreSQL、Redis 使用各自官方镜像。构建阶段完成编译，生产容器直接启动产物，不在启动时安装依赖或运行 Eve build。

- Web：Next standalone，入口 `apps/web/server.js`。
- API：独立生产依赖与完整 `dist/`，入口 `dist/server.js`。
- Worker：独立生产依赖与完整 `dist/`，入口 `dist/worker.js`。
- Runtime：Eve/Nitro `.output/`，入口 `.output/server/index.mjs`。

构建 Web 时传入 `NEXT_PUBLIC_API_BASE_URL`，它会编译进浏览器代码并参与 Turbo 缓存；运行时修改同名变量不会重写浏览器产物。API 的 `CORS_ORIGIN` 应与公开 Web origin 一致。

Compose 是本地单机拓扑，固定的宿主机端口方便开发。生产部署使用容器内部端口及平台提供的负载均衡，分别配置 CPU/内存、健康检查、副本数和滚动策略，不直接照搬固定宿主机端口做多副本。

## 配置与凭证

- Web：只需要公开 API URL。
- API：数据库、Redis、Eve 服务 URL/token、CORS；不持有模型 API Key。
- Worker：Redis、Eve 服务 URL/token、并发；不持有数据库与模型凭证。
- Runtime：模型 API Key、provider URL、模型与 token 预算、Toolbox URL、服务 token、Workflow 状态配置。
- Toolbox：数据库连接凭证；业务数据库权限留在此服务。

`EVE_AGENT_SERVICE_TOKEN` 在 API/Worker 与 runtime 配置相同高熵值。production 禁用本地开发认证回退；缺少 token 时远程调用失败关闭。`ANTHROPIC_*` 是 Anthropic Messages provider 配置，属于 runtime，不代表启用了 Claude Agent SDK。

## 会话持久化与扩容

Eve 使用 `@workflow/world-postgres`，通过 `WORKFLOW_POSTGRES_URL` 连接 PostgreSQL。Workflow state、stream 和内部任务队列由该 world 管理；BullMQ 仍负责平台 Agent job，两个队列各自处理自己的职责。

API、Worker 和 runtime 可以作为独立部署单元配置副本数。Runtime 的副本共享同一 Workflow 数据库与 namespace，必须使用同一锁文件和同一 Eve 构建版本；升级时核实旧 session 的恢复条件。当前 just-bash sandbox 是进程内的，跨副本需要文件连续性时应配置共享/远程 sandbox 或会话亲和；当前 shell/文件工具默认关闭。上线前仍需验证跨副本 attach、stream 和故障恢复。

首次启动前执行 `pnpm --filter @agent-template/runtime workflow:setup`，使用 `WORKFLOW_POSTGRES_URL` 初始化 workflow 与 graphile_worker schemas。Compose 用独立 `workflow-setup` 一次性服务执行；runtime 等待迁移成功。生产平台将它作为独立 migration job，避免每个副本启动时同时迁移。`WORKFLOW_POSTGRES_WORKER_CONCURRENCY` 和 `WORKFLOW_POSTGRES_MAX_POOL_SIZE` 分别控制每副本 Workflow 并发与连接池容量。

反向代理对 Chat SSE 关闭响应缓冲，配置足够的读取超时。PostgreSQL world 在每个 runtime 内通过 loopback HTTP 调用 `/.well-known/workflow/`，`PORT` 必须等于实际监听端口；该 callback 保持内部可达，不向公网暴露。公开代理只需转发 `/eve/`。

## 队列与关闭

Worker 并发由 `WORKER_CONCURRENCY` 正整数控制。Agent 返回 failed/skipped 时 BullMQ job 失败，waiting 表示等待用户交互。默认不自动重试新建会话，避免在网络错误后重复执行模型任务。BullMQ 仍是 at-least-once：Worker 崩溃可能触发重投；有外部写入 Tool 时需在业务 Tool 实现幂等。

API 和 Worker 在 SIGTERM/SIGINT 时执行关闭流程。Compose 配置 init 和 150 秒退出宽限期；实际平台应让宽限期覆盖请求和 job 收尾。

## 本地验证与部署验收

默认本地验证：`pnpm db:generate`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm --filter @agent-template/runtime info` 和 `eval:list`。

实际容器部署还应验收目标平台的镜像构建、服务就绪、真实 Agent turn、SSE/HITL 续接、runtime 重启恢复；共享 world 多副本另测跨副本恢复。数据库迁移作为独立部署步骤执行，不在每个 API/Worker 副本启动时竞争执行。
