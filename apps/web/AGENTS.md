# apps/web 协作指南

## 职责

`apps/web` 是 Next.js 前端应用，负责用户界面、页面组合、浏览器端交互和调用 API 的展示逻辑。

## 能力边界

- 使用 App Router，页面入口在 `app/`。
- 共享 UI 组件从 `@agent-template/ui` 引入。
- 共享类型和响应 schema 从 `@agent-template/shared` 引入。
- API base URL 使用 `NEXT_PUBLIC_API_BASE_URL`，默认 `http://localhost:14000`。

## 不应该做

- 不在这里实现通用 Button、cn、schema 或服务端队列逻辑。
- 不直接连接 PostgreSQL、Redis 或 BullMQ。
- 不把业务常量散落在页面里；可复用内容放到 `src/lib/` 或共享 package。

## UI 规则

- 用户可见文案默认中文。
- shadcn/ui 相关改动优先参考 `.claude/skills/shadcn`。
- React/Next.js 性能相关改动优先参考 `.claude/skills/vercel-react-best-practices`。
- 复杂视觉和体验优化优先参考 `impeccable:impeccable`。
- 前端 Agent 体验可参考 `https://github.com/shadcn-labs/agentcn` 的 Agent preview、运行事件和 artifact tabs；不要从这里导入 Eve/Flue recipe 或后端 runtime 逻辑。
- Web 只展示 API Chat SSE 返回的 Agent run event 和最终文本，不代理 MCP tool 或 resource 请求。
- Web 只持有 opaque Agent continuation；不要解析或构造具体 runtime 的 session state。HITL单选与文本回答通过shared input response提交；无options时必须提供题目关联的文本输入。只有响应实际携带continuation时才允许续聊，终态不构造token。

## 测试归属

- 用户交互与可见结果统一通过根目录 `tests/agent-console.e2e.ts` 验收，运行 `pnpm test:e2e`；不再重复写happy path组件/客户端mock测试。
- 本目录仅保留SSE协议异常与分块解码等浏览器流程难以稳定覆盖的检查；通用测试策略遵循根AGENTS.md。

## 验证

```bash
pnpm --filter @agent-template/web lint
pnpm --filter @agent-template/web test
pnpm --filter @agent-template/web typecheck
pnpm --filter @agent-template/web build
```
