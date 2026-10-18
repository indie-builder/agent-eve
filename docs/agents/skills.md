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
| `superpowers-zh@superpowers-zh`                 | 1.7.14       | 中文工程流程，含 `chinese-commit-conventions`                                           | project  |
| `agentic-awesome-skills@agentic-awesome-skills` | 19.9.0       | 含 `agents-md`、`api-design-principles`、`sql-optimization-patterns` 的社区技能集       | project  |

后两组是完整套件，不支持只安装其中一个 Skill。社区 Plugin 包含2649个技能，superpowers-zh 包含21个技能，会附带所需三项/一项之外的能力；本项目按用户要求优先采用 Plugin，而不是复制其中的文件。Impeccable 与 superpowers-zh 的 SessionStart 等 hooks 由 Plugin 自己管理，项目不手抄 hooks。

## 按项目用途分类

| 项目维度         | 优先使用                                                                                         | 本地后备/自定义                    |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 前端组件与体验   | `impeccable:impeccable`                                                                          | `shadcn`、`react-best-practices`   |
| Next开发与缓存   | `nextjs` Plugin 的专项技能                                                                       | 无重复本地副本                     |
| API与数据库      | 社区Plugin的API/SQL技能、PostgreSQL best practices Plugin                                        | `prisma-orm-setup`                 |
| Eve Agent        | 无对应官方Claude Plugin                                                                          | `eve`，以已安装eve包内docs为事实源 |
| 需求、实施与质量 | Matt Pocock的27个稳定技能、superpowers-zh                                                        | 无重复本地副本                     |
| 工程文档与提交   | 社区Plugin的`agents-md`、Matt的`writing-for-agents`、`superpowers-zh:chinese-commit-conventions` | `find-skills`                      |
| 项目业务         | 无远端Plugin                                                                                     | 4个`ecommerce-*`业务Skill          |

## 本地 Skill（第二选项）

真实文件在 `.agents/skills`，通过 `.claude/skills/<name> → ../../.agents/skills/<name>` 供 Claude Code 发现，当前共 **9个**：

- 外部后备5个：`find-skills`、`react-best-practices`、`shadcn`、`prisma-orm-setup`、`eve`。
- 本地业务4个：`ecommerce-sales-analysis`、`ecommerce-product-analysis`、`ecommerce-order-operations`、`ecommerce-fulfillment-operations`。

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

[skill-sources.json](../../.agents/skill-sources.json) 记录项目Plugin的来源/版本/覆盖、后备技能的repo/ref/path/commit/目录校验和、本地业务技能和退休映射。Plugin/marketplace启用规则以 `.claude/settings.json` 为准。

更新顺序：先检查对应Plugin、用Claude Code更新项目安装，再完整同步无Plugin后备目录；上游改名同步迁移，上游确认删除同步删除。项目业务Skill不因缺少远端目录而删除。外部技能指导服从项目规则，尤其最新稳定依赖、单Eve、默认本地验证、凭证只在环境中等约束。

Plugin新增或更新后需要在新会话生效。当前会话的技能列表可能仍是启动时快照；重新启动Claude Code后再用 `/plugin` 检查。Impeccable原生引擎首次运行可能下载平台二进制；本次未执行引擎下载或完整设计hook回合。
