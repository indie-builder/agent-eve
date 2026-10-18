# apps/worker 协作指南

## 职责

`apps/worker` 是 BullMQ 后台任务进程，负责消费 `agent-jobs` 队列并执行后台任务处理逻辑。

## 能力边界

- Worker 进程入口在 `src/bootstrap/worker.ts`，环境变量解析在 `src/bootstrap/env.ts`。
- `src/modules/agent-jobs/consumer.ts` 保留 `createAgentWorkerProcess` interface，负责 BullMQ Worker 装配、event wiring、shutdown，并委派到 `runAgent`；对应底层检查在 `consumer.test.ts`，不另抽 queue package。
- Worker 并发由 `WORKER_CONCURRENCY` 控制（正整数，默认 1），按副本独立扩容。
- 队列名、任务名和 payload schema 来自 `@agent-template/shared`。
- Agent run 公共入口来自 `@agent-template/agent`。
- 日志使用 `@agent-template/logger`。

## 任务语义

- `failed` 和 `skipped` 的 Agent run 必须抛错，让 BullMQ 记为 failed；`waiting` 是可交互恢复的暂停，保留为 completed。
- 队列不自动重试失败任务（`attempts: 1`），避免重复新建 Eve 会话。投递语义为 at-least-once：Worker 在任务完成确认前退出时，任务会被重新投递。
- `SIGTERM` / `SIGINT` 触发一次 graceful close，等待进行中的任务结束后退出。

## 不应该做

- 不暴露 HTTP API。
- 不直接定义共享任务 payload schema。
- 不把不可测试的逻辑全部写在 `src/bootstrap/worker.ts`；进程入口与 consumer module 分开。
- 不把 BullMQ event name 泄漏到 runtime 测试；测试通过回调 interface 验证 completed/failed 行为。
- Worker process 直接委派给 `@agent-template/agent` 的 `runAgent` Agent run execution seam。
- 不直接依赖 `@agent-template/agent-eve`；通过 `@agent-template/agent` 的 `runAgent` 调用 Eve。

## 验证

```bash
pnpm --filter @agent-template/worker lint
pnpm --filter @agent-template/worker test
pnpm --filter @agent-template/worker typecheck
pnpm --filter @agent-template/worker build
```
