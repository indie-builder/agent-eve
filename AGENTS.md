# 项目协作指南

## 项目定位

TypeScript Agent 平台模板：`apps/` 放运行进程，`packages/` 放可复用能力。

核心栈：Next.js、Fastify、Prisma/PostgreSQL、Redis、BullMQ、MCP Toolbox、Eve、Zod、Pino、Vitest。

## 通用规则

- 用户可见文案默认中文；技术名词保留英文。
- 本项目是个人项目，技术选型和升级优先采用当前最佳实践与最新稳定技术栈；允许直接升级大版本，并同步迁移调用方、配置和测试。
- 面向新版本直接实现，删除被替代的旧实现；不要为兼容旧版本堆积兼容层、双轨逻辑或过渡代码。确有生态工具尚未支持的必要适配时，只保留最小实现并注明移除条件。
- 依赖升级以 npm 当前已发布的最新稳定版为准，允许跨大版本；manifest 使用 `>=x.y.z`，不设置大版本上限（包括 `0.x`）。npm alias 同样使用无上限稳定范围；不自动采用 beta、RC 或其他预发布，即使 latest tag 指向它们。
- pnpm-lock.yaml 固定已验证版本，部署使用 frozen lockfile；packageManager、.nvmrc 和容器镜像记录本次验证版本以保证可复现，不作为主动升级上限。
- 例外：`packages/agent-eve` 的官方 `eve` 依赖按用户要求使用 `latest`。
- TypeScript 统一使用最新稳定的原生 `typescript` 包；Next.js 使用官方 CLI 类型检查路径，不维护 TS6 alias 或旧 JavaScript API 兼容层。
- 工具链统一使用 Oxlint（lint）、Oxfmt（format）和 tsdown / Rolldown（独立 package 打包）；Next.js 与 Eve 保留各自官方构建流程，类型检查继续使用 TS7。
- 共享代码优先放 `packages/`；应用层只编排运行流程。
- 不把业务假设写死进模板；模板保持可复用、低耦合。
- 修改后按影响范围运行对应 package 的 `lint`、`typecheck`、`test`。
- 构建与回归验证默认直接在本地运行；只有用户明确要求 Docker 构建、Docker 启动或容器内验证时，才使用 Docker Compose。不要把 Docker 当作默认验证路径，也不要在未获授权时运行内部调用 `docker compose` 的 verifier。
- 架构术语以 `GLOSSARY.md` 为准；架构候选维护在 `.scratch/architecture-review/backlog.md`。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## 本地服务

- Web: `http://localhost:13000`
- API: `http://localhost:14000`
- MCP Toolbox: `http://localhost:15000`
- PostgreSQL: `localhost:15432`
- Redis: `localhost:16379`

启动本地依赖：`docker compose up -d`

## 研发 Agent 与技能

- 研发默认使用 Claude Code，业务 Agent runtime 仍为 Eve；不维护 Codex 兼容配置。
- 技能优先采用对应的 Claude Code Plugin，以项目维度安装（`claude plugin install <plugin>@<marketplace> --scope project`）；不支持项目维度时才使用用户维度。
- 只有没有对应 Plugin 或项目自定义的技能才安装到项目目录。外部技能通过 Skills CLI 管理，真实文件统一存 `.agents/skills/<skill-name>`，`.claude/skills` 使用相对链接发现，不维护第二份手工镜像；项目自定义技能同样按此目录布局保留。
- 查找技能统一使用 `find-skills` 与 `npx skills@latest find <技术或用途>`；先核对是否有对应 Plugin，再决定本地安装。Plugin 自己持有 skills/agents/hooks，不复制进项目或修改其缓存。
- Plugin 和 marketplace 声明合并到 `.claude/settings.json`，保留已有设置。无 Plugin 的后备技能通过 `npx skills@latest add <来源> --skill <名称> --agent claude-code -y` 管理，默认项目维度，不加 `-g`；更新用 `npx skills@latest update --project -y`，来源锁文件提交到仓库。
- 更新后核对远端组件清单：删除已退休技能、旧链接和上游已删文件，不能只做增量复制；改名时更新 Claude 链接与项目引用。
- Skills CLI 管理来源以 `skills-lock.json` 为准；Plugin与本地业务边界记录在 `.agents/skill-sources.json`，分类清单见 `docs/agents/skills.md`。本地业务技能单独标记，不因远端缺失删除。
- 不把已安装技能清单写进 AGENTS.md。

## Agent skills

- 任务、PRD 和 issue：本地 markdown，写入 `.scratch/<feature-slug>/`。See `docs/agents/issue-tracker.md`.
- issue triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。See `docs/agents/triage-labels.md`.
- 领域文档：根目录 `GLOSSARY.md` 和 `docs/adr/`。See `docs/agents/domain.md`.

## 模块地图

- `apps/web`: 用户界面和浏览器端体验。
- `apps/api`: HTTP API、健康检查、Agent job intake、Chat SSE。
- `apps/worker`: BullMQ 后台任务消费和 Worker process 装配。
- `apps/runtime`: Eve HTTP 服务、provider、Workflow 与 `agent/` authored surface。
- `apps/toolbox`: MCP Toolbox `tools.yaml`、数据库 Tool provider 配置和 Eve Skill authoring CLI。
- `packages/ui`: 共享 React UI 组件和样式工具。
- `packages/shared`: 前后端共享 Zod schema、类型和常量。
- `packages/db`: Prisma schema、Prisma Client 和数据库配置。
- `packages/logger`: Pino logger 封装。
- `packages/agent`: Eve Agent run 的输入校验、环境配置和公共入口。
- `packages/agent-eve`: Eve HTTP client adapter、事件投影与 continuation 编解码。

## 架构规则

- 每个明确任务或需求完成后，提交前必须使用 `mattpocock-skills:improve-codebase-architecture` 做一轮代码架构审查。
- 架构审查产生的候选问题默认按该 skill 的推荐方案落地；只有涉及产品取舍、破坏性变更、成本明显扩大或外部约束无法判断时才向用户确认。
- 架构报告默认中文HTML，标题、字段、图例和最终提问用中文；保留 module/interface/depth/seam/adapter/leverage/locality 和 Strong/Worth exploring/Speculative 原词。
- 每个架构候选修复后单独提交，全部候选修复并验证完成后再统一推送。
- Web、API、Worker、Eve runtime、Toolbox 独立进程和镜像，分别部署与扩缩容；模型凭证只配置在 runtime，API/Worker 仅持有服务连接凭证。
- API/Worker 只通过 `@agent-template/agent` 调用 Eve HTTP client，不嵌入模型执行；`apps/runtime` 独占 authored surface 和 Workflow 状态。
- Agent runtime 统一使用 Eve；按 Eve 当前最佳实践实现，删除 runtime 选择器与旧技术栈兼容分支，不维护双轨实现。
- AI 请求统一使用 Anthropic Messages 协议（`POST /v1/messages`、`x-api-key`、`anthropic-version: 2023-06-01`），默认模型 `group/flash`；API Key 只放本地 `.env` 或部署环境变量。
- `TOOLBOX_URL` 是 Agent runtime 自己持有的 MCP 连接地址；不再维护平台级 MCP registry 或 `TOOLBOX_TOOLSET`。
- Eve runtime 在 `apps/runtime/agent/connections/toolbox.ts` 维护 filesystem-first MCP connection 和 allowlist。
- 新增或删除 Toolbox Tool 时，必须同步更新 Eve MCP connection 的 allowlist；不要在 `packages/shared` 或 `apps/api` 重新抽平台级 MCP module。
- API/Web 不提供 `tools/list`、`tools/call`、MCP resource 或 MCP App 代理路由；MCP tool discovery 和调用只发生在 Eve Agent runtime 内。
- Queue runtime 暂不抽新 module；等第三个 queue consumer 或可替换 adapter 需求出现再抽。

## 提交规则

- 涉及 Git 提交、提交信息、changelog 或提交规范时，必须使用 `superpowers-zh:chinese-commit-conventions`。
- 每个明确任务或需求完成后，先完成架构审查和必要修复，再默认提交并推送到当前跟踪分支；用户明确说“不要提交”“不要推送”“先别提交”时除外。
- 只查看、只分析、只给方案或没有文件改动时，不创建空提交。
- 按功能点提交，不把无关改动混进同一个提交。
- 提交前检查 `git status --short --branch`。
- 不提交 `.env`、构建产物、缓存目录、`node_modules`。
