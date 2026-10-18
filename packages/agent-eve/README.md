# Eve Agent client adapter

`packages/agent-eve` 是 API/Worker 使用的 Eve HTTP client 与平台适配包。可运行的 Eve 服务（authored surface、模型 provider、Toolbox MCP、evals）位于 `apps/runtime`，作为独立服务部署。

## 职责

- 解析 `EVE_AGENT_HOST`、service token、重连次数和请求超时。
- 通过官方 `eve/client` 创建或续接 session，并使用 opaque continuation 往返 `ClientSessionState`。
- 把 Eve stream 事件、结构化 HITL response、subagent、compaction 和 usage 转换为 shared `AgentRunEvent`。
- `src/client/run-agent.ts` 是 package 根入口，编排客户端执行，并显式再导出 `src/client/config.ts` 的连接配置解析、默认值和公共类型。
- `src/protocol/continuation.ts`、`input-responses.ts`、`turn-projection.ts` 负责协议转换；`src/client/run-agent.test.ts` 与 `src/protocol/protocol.test.ts` 保留执行与协议 contract。
- `src/security/trust-policy.ts` 通过 `./trust-policy` 导出 loopback 判断、token 摘要比较，供 runtime 复用。模型名解析、auth walk 与 provider 创建归 `apps/runtime`。

## 运行配置

| 变量                               |   默认值 | 用途                                     |
| ---------------------------------- | -------: | ---------------------------------------- |
| `EVE_AGENT_HOST`                   |        - | Eve 服务地址；未配置时 execution skipped |
| `EVE_AGENT_MAX_RECONNECT_ATTEMPTS` |      `5` | 单轮 stream 断线重连次数                 |
| `EVE_AGENT_REQUEST_TIMEOUT_MS`     | `120000` | API/Worker 调用单轮 Eve 的总超时         |
| `EVE_AGENT_SERVICE_TOKEN`          |        - | 非 loopback host 必需的服务 token        |

## 验证

```bash
pnpm --filter @agent-template/agent-eve lint
pnpm --filter @agent-template/agent-eve typecheck
pnpm --filter @agent-template/agent-eve test
pnpm --filter @agent-template/agent-eve build
```

服务端的 `build`、`info`、`eval:list` 见 `apps/runtime/README.md`。
