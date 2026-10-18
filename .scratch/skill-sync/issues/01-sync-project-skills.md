# 按项目维度整理并更新 Claude Code 研发能力

Status: completed

## 用户要求

盘点项目安装技能，按项目用途整理，更新到各上游最新版，远端删除的对应技能也删除，不做单纯增量覆盖。研发 Agent 默认 Claude Code，不考虑 Codex。**对应Plugin为第一选项，本地Skill为第二选项；支持项目安装时用project，不支持才用user。**

## 实施

- 追溯原35个技能来源，先核对上游完整目录与稳定Plugin清单；4个工程业务Skill和4个Eve runtime生成Skill明确分开。
- 最终项目级安装6个Plugin：Matt1.3.1、Next0.1.0、Postgres best practices c9be0e931b79、Impeccable4.6.0、superpowers-zh1.7.14、agentic-awesome-skills19.9.0；CLI实际记录scope project，声明进入.claude/settings.json。
- 无对应Plugin的5个技能使用最新上游后备：find-skills、react-best-practices、shadcn、prisma-orm-setup、eve。保留4个项目业务技能，合计9个本地技能，.claude/skills相对链接发现。
- 删除所有Plugin覆盖的本地副本和.codex发现/hooks。不手工维护Plugin hook或修改cache，中文架构报告偏好放AGENTS。
- 清理退休名to-prd/to-issues/writing-great-skills/prisma-database-setup及上游已删文件。以to-spec/to-tickets/writing-for-agents/prisma-orm-setup替代。
- CONTEXT.md迁为GLOSSARY.md并更新活跃引用，插件调用使用namespace。来源与版本见.agents/skill-sources.json，分类见docs/agents/skills.md。

## 验证

- 同步阶段45个目录与upstream快照逐树hash验证，中文架构定制除外；转Plugin后核对Plugin manifest覆盖与实际project安装，9个后备/本地目录再次验证来源和链接。
- 全仓lint/typecheck/test/build 44项任务、89项测试通过；format检查通过。
- Claude plugin validate项目本地skills源路径；Claude symlink目录验证仅有工具不跟随链接的提示，逐个真实路径另验证。
- 未执行Impeccable首次引擎下载、完整hooks回合、模型调用、Docker或数据库迁移。新Plugin在Claude Code新会话生效。

## 范围说明

社区Plugin是2649技能完整套件，中文superpowers为21技能套件，不能只选所需三项/一项；按用户明确Plugin优先要求采用。只调整本项目scope，不改其他项目启用配置，不批量升级无关全局插件。
