# packages/shared 协作指南

## 职责

`packages/shared` 提供跨 Web、API、Worker 共享的 Zod schema、TypeScript 类型和常量。

## 能力边界

- `src/index.ts` 保留浏览器可用公共入口；`src/node.ts` 保留 Node 公共入口，不为内部文件新增 barrel。
- `src/health/contracts.ts` 放健康检查响应 schema。
- `src/agent-jobs/contracts.ts` 放 BullMQ job name、queue name、Agent job payload schema 和 Agent job accepted metadata schema。
- `src/agent-run/contracts.ts` 放 Agent run input/result schema；`src/agent-run/events.ts` 放 event protocol 和 artifact schema；result 的 `runtime` 固定为 `eve`。
- 多轮状态只暴露 opaque Agent continuation，不暴露具体 runtime 的 session/cursor 字段；HITL 使用通用 input response schema。
- `src/queue/connection-options.ts` 放 Redis URL 到 BullMQ connection options 的纯解析，由 `src/node.ts` 导出。
- `src/contracts.test.ts` 保留跨能力契约检查。
- 导出的类型应由 schema 推导，避免 schema 和 type 分叉。

## 不应该做

- 不引入 React、Fastify、Prisma、BullMQ 运行实例或 Node-only 副作用。
- 不读取环境变量。
- 不放业务流程实现。
- 不新增 queue runtime module；等第三个 queue consumer 或可替换 adapter 需求出现再抽。

## 验证

```bash
pnpm --filter @agent-template/shared lint
pnpm --filter @agent-template/shared test
pnpm --filter @agent-template/shared typecheck
pnpm --filter @agent-template/shared build
```
