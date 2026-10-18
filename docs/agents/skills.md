# 项目研发技能与 Plugin

核对日期：2026-10-18。研发 Agent 统一使用 **Claude Code**，业务 Agent runtime 继续使用 Eve。安装顺序是：**对应 Plugin → 项目本地 Skill**；Plugin 支持项目维度，所以本项目不需要用户维度兜底。

## 项目维度配置

Plugin 声明位于 `.claude/settings.json`，使用 `--scope project` 安装。Plugin 文件可缓存于用户目录，但只对声明启用的项目生效；缓存位置不等于启用范围。团队成员克隆后通过 Claude Code 的安装/信任流程获取对应 Plugin。不要把缓存复制进仓库。

| Plugin                                          | 核对版本     | 对本项目提供的能力                                                                      | 安装范围 |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- | -------- |
| `mattpocock-skills@claude-plugins-official`     | 1.3.1        | 27个稳定工程/生产力技能：需求澄清、spec/ticket、实施、TDD、排错、架构、评审、研究与交接 | project  |
| `nextjs@nextjs`                                 | 0.1.0        | Next开发诊断、Cache Components采用/优化及上游相关专项技能                               | project  |
| `postgres-best-practices@supabase-agent-skills` | c9be0e931b79 | PostgreSQL性能、schema、索引与数据库最佳实践                                            | project  |
| `impeccable@impeccable`                         | 4.6.0        | 界面设计、审查、组件与体验优化，包含原生agents/hooks                                    | project  |
| `agentic-awesome-skills@agentic-awesome-skills` | 19.9.0       | 含 `agents-md`、`api-design-principles`、`sql-optimization-patterns` 的社区技能集       | project  |
| `redis-development@claude-plugins-official`     | 1.4.0        | Redis开发、连接和性能最佳实践                                                           | project  |

社区 Plugin 包含2649个技能，是完整套件，不支持只安装其中一个 Skill；本项目优先采用 Plugin，而不是复制其中的文件。Impeccable 的 SessionStart 等 hooks 由 Plugin 自己管理，项目不手抄 hooks。

本项目不使用 Superpowers。已卸载 `superpowers-zh` Plugin、移除专属 marketplace 和缓存，并删除强制调用规则。社区套件收录的13个 Superpowers 工作流副本通过 `.claude/settings.json` 的 `skillOverrides: off` 关闭，用户级设置同步关闭；不手改其他 Plugin 的缓存，避免更新后恢复。社区套件原始文件仍随该 Plugin 分发，但不会作为可调用技能加载。

## 按项目用途分类

| 项目维度         | 优先使用                                                                   | 本地后备/自定义                         |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| 前端组件与体验   | `impeccable:impeccable`                                                    | `shadcn`、`vercel-react-best-practices` |
| Next开发与缓存   | `nextjs` Plugin 的专项技能                                                 | 无重复本地副本                          |
| API与数据库      | 社区Plugin的API/SQL技能、PostgreSQL best practices Plugin                  | `prisma-orm-setup`                      |
| Eve Agent        | 无对应官方Claude Plugin                                                    | `eve`，以已安装eve包内docs为事实源      |
| 需求、实施与质量 | Matt Pocock的27个稳定技能                                                  | 无重复本地副本                          |
| 工程文档与提交   | 社区Plugin的`agents-md`、Matt的`writing-for-agents`；提交格式遵循AGENTS.md | `find-skills`                           |
| 项目业务         | 无远端Plugin                                                               | 4个`ecommerce-*`业务Skill               |

## 按技术栈补齐的最佳实践

通过 `npx skills@latest find <技术>` 查询并核对来源后，新增以下项目能力：

| 技术               | 采用技能/Plugin                                   | 来源与选择依据                                                                            |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fastify / Pino集成 | `fastify-best-practices`                          | Fastify维护者Matteo Collina，搜索显示74.7K安装，覆盖plugins、validation、inject测试与Pino |
| Turborepo          | `turborepo`                                       | Vercel官方，82.5K安装，要求阅读当前安装turbo包内docs                                      |
| pnpm 12            | `pnpm`                                            | antfu/skills，专项指导覆盖pnpm12与workspace配置                                           |
| Vitest 5           | `vitest`                                          | antfu/skills，41.2K安装，当前内容以Vitest5为基线                                          |
| tsdown             | `tsdown`                                          | rolldown/tsdown官方当前技能；未采用索引中已失效的antfu旧条目                              |
| Oxlint / Oxfmt     | `migrate-oxlint`、`migrate-oxfmt`                 | oxc-project/oxc官方，搜索显示7.6K/4.2K安装，定位为迁移和配置维护参考                      |
| Redis              | `redis-development@claude-plugins-official` 1.4.0 | Redis官方Plugin，scope project，优先于重复本地技能                                        |

现有社区Plugin提供 `bullmq-specialist`、`zod-validation-expert`、Docker和TypeScript指导，不重复安装。它们的个别示例可能落后于BullMQ6/Zod4，涉及具体API时以当前安装版本与官方文档为准。Pino未采用低安装量非官方技能，由Fastify官方维护者技能和现有logger规则覆盖。

## 本地 Skill（第二选项）

外部技能统一由 Skills CLI 管理，来源固定在 `skills-lock.json`。真实文件统一放 `.agents/skills/<name>`，以 `.claude/skills` 相对链接发现；CLI add的复制结果和update的链接结果统一收敛为此单副本布局。当前是 **12个CLI管理技能 + 4个本地业务技能**。

- CLI管理：`find-skills`、`vercel-react-best-practices`、`shadcn`、`prisma-orm-setup`、`eve`、`fastify-best-practices`、`turborepo`、`pnpm`、`vitest`、`tsdown`、`migrate-oxlint`、`migrate-oxfmt`。
- 本地业务4个仍放在 `.agents/skills`，通过 `.claude/skills` 相对链接发现。

保留后备的依据是未找到覆盖该技能的官方Claude Plugin。Prisma虽然有官方MCP Plugin，但不含新版`prisma-orm-setup`，不能以同品牌替代实际能力；shadcn当前的Cursor Plugin也不等于Claude Plugin。

Eve服务的 `apps/runtime/agent/skills` 另有4个由Toolbox生成的业务Skill，工具名带`toolbox__`前缀，不属于研发Plugin安装；不改用Claude研发技能替代它们。

## 本次完整同步与删除

- 已核对上游目录/Plugin manifest和版本；有Plugin的本地技能副本全部移除，Plugin更新后以新版实际组件清单为准，不恢复已删除名称。
- 退休旧名清理：`to-prd` → `to-spec`、`to-issues` → `to-tickets`、`writing-great-skills` → `writing-for-agents`（由Matt Plugin提供）；`prisma-database-setup` → `prisma-orm-setup`（后备目录）。旧目录和旧链接均删除。
- 远端目录里的旧文件也清理，不只覆盖新增文件，包括旧Next loop文档、TDD refactoring文档、Impeccable 3.x JS hook/engine等。Plugin覆盖后不保留手工镜像兼容层。
- 删除 `.codex` 发现链接与hooks；项目仅维护Claude Code入口。
- 领域术语文档迁为 `GLOSSARY.md`，与新版Matt Plugin一致。
- 原架构技能的中文HTML定制收敛到项目AGENTS.md，不修改Plugin缓存或保留整份重复技能。

## 来源与维护

`skills-lock.json` 是外部项目技能的CLI来源锁；[skill-sources.json](../../.agents/skill-sources.json) 记录Plugin的来源/版本/覆盖、本地技能校验和及退休映射。Plugin/marketplace启用规则以 `.claude/settings.json` 为准。

常用命令：

```bash
npx skills@latest find fastify
npx skills@latest add mcollina/skills --skill fastify-best-practices --agent claude-code -y
npx skills@latest list --agent claude-code
npx skills@latest update --project -y
npx skills@latest remove <skill-name> --agent claude-code -y
```

更新顺序：先检查对应Plugin、用Claude Code更新项目安装，再用Skills CLI更新无Plugin后备目录并核对远端文件树；上游改名同步迁移，上游确认删除同步删除。项目业务Skill不因缺少远端目录而删除。外部技能指导服从项目规则，尤其最新稳定依赖、单Eve、默认本地验证、凭证只在环境中等约束。

Plugin新增或更新后需要在新会话生效。当前会话的技能列表可能仍是启动时快照；重新启动Claude Code后再用 `/plugin` 检查。Impeccable原生引擎首次运行可能下载平台二进制；本次未执行引擎下载或完整设计hook回合。
