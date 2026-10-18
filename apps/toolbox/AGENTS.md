# apps/toolbox 协作指南

## 职责

`apps/toolbox` 是 MCP Toolbox for Databases 的本地配置目录，负责定义 Agent 可加载的数据库工具。

## 能力边界

- Toolbox server 是独立 Tool provider，不属于 Cloud 或 Eve Agent runtime。
- `tools.yaml` 只定义 source、tool 和 group；`src/` 只放从这些声明生成 runtime Skill 的 authoring CLI，不放业务运行时代码。
- 生产 Agent 只使用 Claude/Eve runtime allowlist 显式允许的自定义 Tool，不使用 prebuilt generic tools。
- 新增或删除 Tool 时同步更新 `packages/agent-claude/agent/.claude/settings.json` 和 `packages/agent-eve/agent/connections/toolbox.ts`。
- 跨 runtime 的 Skill 生成只由本 module 负责；Claude/Eve runtime 只持有各自生成产物。
- 数据库连接信息通过环境变量注入，不能把密码写死在 `tools.yaml`。

## 不应该做

- 不在这里实现 API route、Worker process 或 Agent runtime selector。
- 不暴露任意 SQL 执行工具给生产 Agent。
- 不使用 templateParameters 替代普通参数，除非有白名单和明确 ADR。
- 不直接读取 `.env`；由 Docker Compose 或部署平台注入环境变量。

## 官方参考

- MCP protocol introduction: `https://modelcontextprotocol.io/docs/getting-started/intro`
- MCP Toolbox for Databases: `https://github.com/googleapis/mcp-toolbox`
- 官方文档: `https://mcp-toolbox.dev/`
- PostgreSQL source: `https://mcp-toolbox.dev/integrations/postgres/source/`
- Toolsets: `https://mcp-toolbox.dev/documentation/configuration/toolsets/`

## 验证

```bash
pnpm --filter @agent-template/toolbox skills:generate
pnpm --filter @agent-template/toolbox lint
pnpm --filter @agent-template/toolbox typecheck
pnpm --filter @agent-template/toolbox test
docker compose config
docker compose up -d postgres toolbox
pnpm db:migrate
pnpm db:seed
```
