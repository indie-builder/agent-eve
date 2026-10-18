# Agent Template

一个基于 pnpm Workspace 和 Turborepo 的 TypeScript 7 项目模板，包含 Next.js 前端、Fastify API、BullMQ Worker、Prisma/PostgreSQL、Redis、MCP Toolbox、Eve、Zod、Pino 和 Vitest。

## 技术栈

- 前端：pnpm + TypeScript 7 + Next.js + React + Tailwind CSS + shadcn/ui + Vitest
- 后端：TypeScript 7 + Fastify + Prisma + PostgreSQL + Redis + BullMQ + MCP Toolbox + Eve + Zod + Pino + Vitest
- 工程化：pnpm Workspace + Turborepo + Oxlint + Oxfmt + tsdown / Rolldown
- 浏览器回归：TesterArmy e2e + Chromium（Web engine 基于 Playwright）

开发环境使用 Node.js 26.12.0（`.nvmrc`）和 `package.json` 声明的 pnpm 版本。使用 nvm 时先运行 `nvm install && nvm use`。依赖跟进最新稳定版，manifest 使用无大版本上限的 `>=x.y.z`；大版本升级直接迁移代码，不保留旧版双轨实现。锁文件固定本次验证版本，部署使用 `pnpm install --frozen-lockfile`。pnpm 的 packageManager、Node 的 .nvmrc 和镜像标签记录可复现版本，后续按最新稳定发布主动更新。

## TypeScript 7

项目统一使用最新稳定 `typescript` 原生编译器。各 workspace 的类型检查与直接 `tsc` 构建均使用 TypeScript 7；Next.js 16.4 默认走 CLI 类型检查，因此已移除 TS6 兼容包和双编译器 alias。

```bash
pnpm exec tsc --version
pnpm typecheck
```

## 快速开始

基础服务使用 PostgreSQL 18.6、Redis 8.10.2 和 MCP Toolbox 1.14.0。已有 PostgreSQL 17 数据的环境先按 [PostgreSQL 18 升级说明](docs/upgrade-postgres18.md) 导出和恢复；新配置使用独立卷，旧卷保留。

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

默认服务：

- Web: http://localhost:13000
- Eve Agent: http://localhost:13010
- API: http://localhost:14000
- Health: http://localhost:14000/health
- PostgreSQL: localhost:15432
- Redis: localhost:16379
- MCP Toolbox: http://localhost:15000

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## 浏览器测试

```bash
pnpm exec e2e-web install chromium
pnpm test
```

`pnpm test` 是统一入口，执行精简底层契约检查和 TesterArmy e2e Web/API 验收。e2e 自动启动独立 Next.js（13020）和生产 Fastify app（14020），成功路径走真实 HTTP/SSE，仅在外部 runtime/queue seam 注入确定性测试 adapter；无需模型密钥、数据库或 Docker。核心验收共6条，报告与失败 trace 写入被忽略的 `.e2e/`。

只跑验收使用 `pnpm test:e2e`。对已启动的真实 Web/API/Eve 环境设置 `E2E_LIVE_WEB_URL` 和 `E2E_LIVE_API_URL` 后运行 `pnpm test:live`，缺少环境会失败；该入口调用真实模型，不纳入默认回归。测试规则见根目录 `AGENTS.md`。

详细运行方式、官方技能与现有测试迁移评估见 [测试与迁移评估](docs/testing.md)。

## 目录结构

```text
apps/
  web/       Next.js + React + Tailwind CSS
  api/       Fastify HTTP API
  worker/    BullMQ 后台任务进程
  runtime/   Eve HTTP 服务 + agent authored surface
  toolbox/   MCP Toolbox tools.yaml + Skill authoring CLI
packages/
  ui/            shadcn/ui 风格共享组件
  db/            Prisma schema 和 Prisma Client
  logger/        Pino logger 封装
  agent/         Agent runtime 公共边界
  agent-eve/     Eve HTTP client adapter
  shared/        共享 Zod schema 和 TypeScript 类型
```

`apps/toolbox/tools.yaml` 定义生产 Agent 可加载的数据库工具。默认 group 是 `agent_template_read_model`：保留 `TemplateEvent` 的只读运行观测，同时提供合成电商的日销售、渠道、商品排行、订单详情和履约异常查询。`pnpm db:seed` 会写入 96 个脱敏客户、24 个商品和 600 个确定性订单；完整的参数、索引和 MCP 验证命令见 [apps/toolbox/README.md](apps/toolbox/README.md)。prebuilt generic tools 仅用于开发期探索，不作为生产 Agent 默认能力。

Eve 在 `apps/runtime/agent/connections/toolbox.ts` 维护 MCP connection 和 allowlist，从 `TOOLBOX_URL` 读取 endpoint。稳定指令位于 `agent/instructions.md`，业务 Skill 位于 `agent/skills/`；API 和 Web 不维护 MCP registry 或代理 tool/resource 请求。

Eve 通过 Anthropic Messages 协议接入本地 AI 服务：

```bash
ANTHROPIC_API_KEY=<your-api-key>
ANTHROPIC_BASE_URL=http://127.0.0.1:3425/v1
ANTHROPIC_MODEL=group/flash
EVE_AGENT_MODEL=group/flash
EVE_MAX_OUTPUT_TOKENS=1024
EVE_AGENT_HOST=http://localhost:13010
EVE_AGENT_SERVICE_TOKEN=
```

本地运行 Eve 时，将 AI 配置放入 `apps/runtime/.env.local`；Eve CLI 从自己的应用目录读取环境文件。根 `.env` 用于 Compose 和 API/Worker，密钥不提交。默认请求为 `POST /v1/messages`，使用 `x-api-key`、`anthropic-version: 2023-06-01` 和 JSON 请求体；单次输出上限由 `EVE_MAX_OUTPUT_TOKENS` 控制。

Compose 通过 `ANTHROPIC_DOCKER_BASE_URL` 访问宿主机服务，默认 `http://host.docker.internal:3425/v1`，不要在容器内使用 `127.0.0.1` 指向宿主机。Linux 宿主机的代理需监听容器可达地址。

项目只使用 Eve，不再配置 runtime selector。API/Worker 不依赖模型 API Key；`/health` 显示 Eve client 连接配置状态，模型凭证由独立 runtime 持有。

Eve 使用 opaque continuation 支持多轮续接和结构化 HITL，并把 Tool、subagent、compaction 和 token usage 转换为统一运行事件。Eve 非 loopback 的 `EVE_AGENT_HOST`（包括 Docker Compose 中的 `http://runtime:13010`）必须为 API/Worker 和 Eve Agent 配置同一个高熵 `EVE_AGENT_SERVICE_TOKEN`；production 不启用 `localDev()` Host fallback，缺少凭证时会 fail closed。Eve 说明见 [packages/agent-eve/README.md](packages/agent-eve/README.md)。

服务独立部署、镜像 target、配置归属与扩容约束见 [部署架构](docs/deployment.md)。
