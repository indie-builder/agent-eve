# 探索并替换 Oxc / Rust 工具链

Status: completed

## 用户授权

个人项目允许大胆升级和直接替换。先核对当前技术栈与 Oxc 生态能力，能够完整覆盖现有用途就落地，不维护旧工具双轨。

## 候选范围

- Oxlint 替代 ESLint + typescript-eslint。
- Oxfmt 替代 Prettier，包含 Toolbox Skill 生成后的 Markdown 格式化。
- tsdown / Rolldown 替代 tsup，保留 API/Worker external 依赖、workspace bundle、Prisma chunk 与生产部署行为。
- Next.js 自带 Turbopack、Eve 自带 Rolldown、TS7 原生 CLI 保持各自官方构建路径。

## 验收

版本与 API 有当前官方文档/registry 证据。更新所有调用方、脚本、配置、文档，删除被替代工具。全仓 lint/typecheck/test/build、Skill 生成、独立生产包检查通过；不运行 Docker/数据库迁移/真实模型回合。架构审查后中文分功能点提交并统一推送。
