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

源码内部组织见 [后端模块与目录分层](backend-architecture.md)。`bootstrap`负责启动装配，能力module组织HTTP、应用流程和外部adapter；这不改变下述部署入口和独立扩缩容方式。

## 镜像与启动

根 Dockerfile 提供 `web`、`api`、`worker`、`runtime` 四个独立 final target。Compose 为每个服务选择对应 target；Toolbox、PostgreSQL、Redis 使用各自官方镜像。构建阶段完成编译，生产容器直接启动产物，不在启动时安装依赖或运行 Eve build。

- Web：Next standalone，入口 `apps/web/server.js`。
- API：独立生产依赖与完整 `dist/`，入口 `dist/server.js`。
- Worker：独立生产依赖与完整 `dist/`，入口 `dist/worker.js`。
- Runtime：Eve/Nitro `.output/` 与 `.eve/sandbox-cache/just-bash/templates/`，入口 `.output/server/index.mjs`。

Runtime 的工作目录固定为 `/app`，两份产物分别放在 `/app/.output/` 和 `/app/.eve/sandbox-cache/just-bash/templates/`。Eve 0.80.1 的 build 预先生成 just-bash 文件系统模板，生产 provider 根据 bundle 内的 `templateKey` 从当前工作目录的 `.eve/sandbox-cache/` 打开模板；缺失时会失败，不会自动重建。Skill 内容包含在模板中，通过 sandbox 的 `$HOME/.agents/skills/` 读取，即使 shell/文件 Tool 默认关闭也必须部署模板。Turbo build outputs 同时缓存 `.output/` 和模板目录；不要部署开发 session 目录。镜像将 `.eve/` 归属设为 `node` 用户，确保 provider 能在模板旁创建运行时 session 目录。

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

API 和 Worker 在 SIGTERM/SIGINT 时执行关闭流程。Compose 配置 init 和 150 秒退出宽限期；实际平台应让宽限期覆盖请求和 job 收尾。Worker仅在主连接尚未初始化、无法开始任务时force close；blocking连接初始化不能证明没有活跃任务。BullMQ在主连接ready、blocking握手永久无响应时仍可能阻塞graceful close，需由退出宽限期兜底并后续单独治理，不能以force关闭活跃任务掩盖此边界。

## 本地验证与部署验收

默认本地验证：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm --filter @agent-template/runtime run info` 和 `eval:list`。`pnpm typecheck` 与 `pnpm build` 通过 Turbo 任务图先执行 DB 的 `db:generate`，或从缓存恢复 `generated/`，不要求预先手工生成，也不访问数据库。`generated/**` 只归 `@agent-template/db#db:generate` 任务所有，DB build 只缓存 `dist/**`；schema、Prisma 配置和锁定依赖参与生成任务的缓存键。Docker API build 复用同一任务图。

只检查 DB 时使用 `pnpm exec turbo run typecheck --filter=@agent-template/db`（build 同理）。`pnpm --filter @agent-template/db typecheck` 直接运行 TypeScript，绕过 Turbo 前置任务；使用该底层入口前需显式执行 `pnpm db:generate`。Web typecheck 先运行 `next typegen`，再用 `tsconfig.typecheck.json` 排除旧 `.next/dev/**` validator，因此 clean checkout 无需预先执行 Next build，路由改名也不受上一次 dev 类型污染；主tsconfig保留Next开发模式的类型发现。

Turbo build/typecheck 的 inputs 包含根 `tsconfig.base.json`、`tsconfig.build.json`；Toolbox test 的 inputs 还包含 runtime MCP allowlist 和 `agent/skills/**`，这些文件变更会使相关缓存失效。Toolbox test 不依赖 runtime test，避免反向耦合任务图。

模板部署可在本地隔离目录验证：复制 `.output/` 与模板目录，切换工作目录后，使用已安装 Eve 的 just-bash provider `start(context, undefined, artifact)` 打开 bundle 记录的 artifact，并通过 `sandbox.run()` 读取 `$HOME/.agents/skills/<skill>/SKILL.md`、对比 authored Skill 内容；只检查文件存在不足以证明模板可用。该检查无需 Docker、模型或 Workflow 数据库，只覆盖本地 provider 与部署产物布局。Eve bundled 文档见 `apps/runtime/node_modules/eve/docs/sandbox/index.mdx`、`sandbox/just-bash.mdx`；0.80.1 的模板路径实现位于该 package 的 `dist/src/execution/sandbox/bindings/just-bash.js` 和 `local-provider-utils.js`。

实际容器部署还应验收目标平台的镜像构建、服务就绪、真实 Agent turn、SSE/HITL 续接、runtime 重启恢复；共享 world 多副本另测跨副本恢复。数据库迁移作为独立部署步骤执行，不在每个 API/Worker 副本启动时竞争执行。
