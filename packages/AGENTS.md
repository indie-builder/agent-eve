# packages 协作指南

`packages/` 下放跨应用复用能力。每个 package 应该有清晰单一职责，并通过 package export 暴露稳定入口。

## 模块职责

- `ui`: React UI 组件和样式工具。
- `shared`: Zod schema、共享类型和常量。
- `db`: Prisma schema、Prisma Client 和数据库配置。
- `logger`: Pino logger 统一配置。
- `agent`: Eve Agent run 的输入校验、环境配置和公共入口。
- `agent-eve`: Eve HTTP client adapter、事件投影与 continuation 编解码；可运行 authored surface 位于 `apps/runtime`。

## 开发规则

- package 之间可以依赖，但要避免环形依赖。
- 共享类型优先从 `packages/shared` 导出。
- 应用专属运行逻辑不要放 package。
- package export 保持小而稳定，避免暴露内部文件路径。
- `apps/*` 只通过 `@agent-template/agent` 使用 Agent runtime，不直接依赖 `agent-eve`。

## 验证

```bash
pnpm --filter @agent-template/shared test
pnpm --filter @agent-template/ui typecheck
pnpm typecheck
```
