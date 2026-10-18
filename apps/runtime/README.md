# Eve runtime service

`@agent-template/runtime` 是独立部署的 Eve 服务。`agent/` 是 filesystem-first authored surface，`src/` 只放 provider 和 channel auth，`evals/` 是模型回归用例。

## 服务边界

- API/Worker 通过 `EVE_AGENT_HOST` 调用该服务，并使用 `EVE_AGENT_SERVICE_TOKEN` 认证；非 loopback host 缺少 token 时 client fail closed。
- 服务使用标准 `eve build` 构建，产物在 `.output/`，由 `node .output/server/index.mjs` 启动。
- 模型 provider 使用 Anthropic-compatible endpoint；模型名、base URL 和 session limits 由 runtime 环境变量配置。
- Toolbox 通过 `agent/connections/toolbox.ts` 的 MCP connection 接入，只允许只读工具。
- sandbox 固定为无真实二进制、关闭自动安装的 `just-bash`；默认禁用 shell、文件读写、任意外网访问和 provider web search。
- durable session 使用 `@workflow/world-postgres`（spec 8，与 eve 0.80.1 vendored 的 `@workflow/core` 5.2.0 line 对齐）。所有 replica 共享同一个 PostgreSQL world，运行状态、队列和 stream 不再落在进程本地 `.eve/`；多个 replica 必须连接同一数据库，否则 run 无法跨副本恢复。
- `workflow:setup`（package bin `bootstrap`）只执行一次 schema 迁移；不要在每次 replica 启动时重复执行，由部署编排的独立迁移 service 负责。

## 运行配置

| 变量                                   |                   默认值 | 用途                                               |
| -------------------------------------- | -----------------------: | -------------------------------------------------- |
| `EVE_AGENT_MODEL` / `ANTHROPIC_MODEL`  |        `kimi-for-coding` | authored surface 模型名                            |
| `ANTHROPIC_BASE_URL`                   |                        - | Anthropic-compatible endpoint                      |
| `ANTHROPIC_API_KEY`                    |                        - | provider 凭证                                      |
| `EVE_AGENT_SERVICE_TOKEN`              |                        - | API/Worker 到 Eve channel 的服务 token             |
| `TOOLBOX_URL`                          | `http://localhost:15000` | Toolbox endpoint                                   |
| `EVE_MODEL_CONTEXT_WINDOW_TOKENS`      |                 `128000` | 未进入 Gateway catalog 的 context window           |
| `EVE_COMPACTION_THRESHOLD`             |                   `0.75` | durable context compaction 比例                    |
| `EVE_MAX_INPUT_TOKENS_PER_SESSION`     |                `1000000` | durable session 累计输入 token 上限                |
| `EVE_MAX_OUTPUT_TOKENS_PER_SESSION`    |                 `100000` | durable session 累计输出 token 上限                |
| `WORKFLOW_POSTGRES_URL`                |           `DATABASE_URL` | Workflow world PostgreSQL 连接串；生产必须显式设置 |
| `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` |                     `50` | 每副本并发 step 执行数                             |
| `WORKFLOW_POSTGRES_MAX_POOL_SIZE`      |                     `10` | world 内部 `pg.Pool` 上限                          |
| `PORT`                                 |                  `13010` | Eve 监听端口；world 用同一端口回调 loopback        |

不要设置 `WORKFLOW_POSTGRES_APPLICATION_MANAGED_SHUTDOWN`、`WORKFLOW_POSTGRES_INVOKE` 或 `WORKFLOW_LOCAL_BASE_URL`：Eve 自己管理进程生命周期，queue 直接回调 loopback `PORT`。

```bash
# 每个部署环境执行一次，由独立迁移 service 承担
WORKFLOW_POSTGRES_URL=postgresql://... pnpm --filter @agent-template/runtime workflow:setup
```

`just-bash` sandbox 仍然在 runtime 进程内执行，没有独立 sandbox 副本；shared world 只解决 durable run/queue/stream 的跨副本共享，不改变 shell 执行位置。

客户端侧的 `EVE_AGENT_MAX_RECONNECT_ATTEMPTS` 和 `EVE_AGENT_REQUEST_TIMEOUT_MS` 属于 `@agent-template/agent-eve`。

## 验证

```bash
pnpm --filter @agent-template/runtime lint
pnpm --filter @agent-template/runtime typecheck
pnpm --filter @agent-template/runtime test
pnpm --filter @agent-template/runtime build
pnpm --filter @agent-template/runtime info
pnpm --filter @agent-template/runtime eval:list
```

`eve eval` 会调用真实模型，operations 用例还要求本地 Toolbox/PostgreSQL 已启动，因此不属于无凭证的静态质量门禁。
