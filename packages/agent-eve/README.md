# Eve production runtime

`agent/` 是 Eve filesystem-first authored surface，`src/` 只负责平台执行适配。当前生产基线包括：

- 精确的 Toolbox MCP allowlist，且只允许只读 Tool。
- 默认关闭 shell、文件读写、任意外网访问和 provider web search；内建 `agent` 委派工具保留，并受 session token 预算约束。
- sandbox 固定使用无真实二进制的纯 JS `just-bash`，避免本地或自托管启动时隐式选择 Docker；运行时自动安装已关闭。
- 显式的 session token 预算、75% context compaction 阈值和客户端超时/重连策略。
- Eve route 的 loopback 本地访问、Vercel OIDC，以及恒定时间校验的服务 token。
- `agent/instrumentation/` 下 metadata-only 的 OpenTelemetry trace policy（`recordInputs`/`recordOutputs` 均为 false），以及不包含业务数据的 session lifecycle audit hook。
- runtime-neutral opaque continuation、结构化 HITL response，以及连接授权、subagent、compaction 和 usage 事件到平台协议的转换。
- `evals/` 下的安全、会话连续性和业务工具回归用例。

## 服务认证

仅非 production 环境的 `localhost` 和 `127.0.0.1` 由 Eve 的 `localDev()` 策略处理。production 永不注册 `localDev()`，任何非 loopback 的 `EVE_AGENT_HOST` 都必须同时配置 `EVE_AGENT_SERVICE_TOKEN`；API/Worker 与 Eve Agent 进程必须使用同一个高熵值。未配置时 runtime 会 fail closed 并报告 `configured: false`。

## 运行配置

| 变量                                |    默认值 | 用途                                               |
| ----------------------------------- | --------: | -------------------------------------------------- |
| `EVE_AGENT_HOST`                    |         - | Eve HTTP API 地址；未配置时 execution 返回 skipped |
| `EVE_AGENT_MAX_RECONNECT_ATTEMPTS`  |       `5` | 单轮 stream 断线重连次数                           |
| `EVE_AGENT_REQUEST_TIMEOUT_MS`      |  `120000` | API/Worker 调用单轮 Eve 的总超时                   |
| `EVE_MODEL_CONTEXT_WINDOW_TOKENS`   |  `128000` | 未进入 Gateway catalog 的模型 context window       |
| `EVE_COMPACTION_THRESHOLD`          |    `0.75` | 触发 durable context compaction 的比例             |
| `EVE_MAX_INPUT_TOKENS_PER_SESSION`  | `1000000` | durable session 累计输入 token 上限                |
| `EVE_MAX_OUTPUT_TOKENS_PER_SESSION` |  `100000` | durable session 累计输出 token 上限                |

## 验证

```bash
pnpm --filter @agent-template/agent-eve lint
pnpm --filter @agent-template/agent-eve test
pnpm --filter @agent-template/agent-eve typecheck
pnpm --filter @agent-template/agent-eve eve:build
pnpm --filter @agent-template/agent-eve eve:info
pnpm --filter @agent-template/agent-eve eve:eval:list
```

`eve:eval` 会调用真实模型，其中 operations 用例还要求本地 Toolbox/PostgreSQL 已启动，因此不属于无凭证的静态质量门禁。

没有添加 schedule 或 declared subagent：模板当前没有明确的周期触发器，也没有需要独立身份/工具面的专业角色。按 Eve 最佳实践，这些能力应在真实产品需求出现后再加入。当前 `just-bash` 仅提供最小、无 Docker 的 framework workspace；恢复 shell/文件工具时，必须重新选择匹配部署环境的强隔离 sandbox 和最小 egress policy。
