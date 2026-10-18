# packages/ui 协作指南

## 职责

`packages/ui` 提供共享 React UI 组件和样式工具，当前包含 shadcn/ui 风格的 `Button` 和 `cn`。

## 能力边界

- 只放跨页面、跨应用复用的 UI primitives。
- 组件应保持无业务语义，不依赖 API、数据库、队列或环境变量。
- 样式优先使用 Tailwind utility 和语义化组件变体。

## 不应该做

- 不放页面级布局。
- 不放业务文案。
- 不依赖 `apps/web`。

## 设计规则

- shadcn/ui 组件和组合模式参考 `.claude/skills/shadcn`。
- UI 性能规则参考 `.claude/skills/vercel-react-best-practices`。
- 高阶视觉打磨参考 `impeccable:impeccable`。

## 验证

```bash
pnpm --filter @agent-template/ui lint
pnpm --filter @agent-template/ui test
pnpm --filter @agent-template/ui typecheck
pnpm --filter @agent-template/ui build
```
