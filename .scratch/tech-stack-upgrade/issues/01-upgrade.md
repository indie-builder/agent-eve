# 升级项目技术栈到最新稳定版本

Status: completed

## 需求

核对官方发布源和 npm registry，将直接依赖、Node/pnpm 和基础服务配置升级到当前最新稳定版本，修复必要的兼容性问题。

用户确认：这是个人项目，直接跟进最新稳定版，包括跨大版本；优先完成升级，不增加旧版本兼容负担。

## 范围

- 根目录及各 workspace 的 package.json、pnpm-lock.yaml、pnpm-workspace.yaml。
- Node 版本声明、Dockerfile、Docker Compose 基础服务镜像和必要迁移说明。
- 升级影响到的配置、调用方、测试、生成内容和开发文档。
- 保留 TypeScript 7 原生 CLI 与 TypeScript 6 JavaScript API 兼容层。
- 保留 eve 的 latest spec、Kimi Anthropic-compatible 配置及 Agent runtime 公共 interface。

## 验收

- 版本有 registry 或官方发布证据；不使用未发布版本或预发布版本替代稳定版本。
- pnpm install --frozen-lockfile、Prisma Client 生成、全仓 lint/typecheck/test/build 通过。
- Eve authored surface 本地构建、info 和 eval 列表检查通过。
- 完成 improve-codebase-architecture 审查与必要修复，按功能点提交。
- 本次不启动 Docker、不对现有数据库迁移或 seed、不发起付费模型请求。

## Comments

- 升级前全仓 lint/typecheck/test/build 已用 `turbo run lint typecheck test build --force` 绕过缓存验证，44/44 任务通过，108 项测试通过，1 项真实模型测试按原规则跳过。
- 升级前 Eve build/info/eval:list 通过，诊断 0 errors / 0 warnings。
- 升级前 `pnpm audit` 报告 82 项漏洞（4 critical / 36 high / 39 moderate / 3 low），升级后复核。
- PostgreSQL 大版本升级必须保留旧数据卷，并说明逻辑备份、恢复及回退方式。
- 已升级 Node 26.12.0、pnpm 12.14.0、Next 16.4.2、React 19.3.1、Fastify 5.12.7、Prisma 三件套 7.10.1、BullMQ 6.3.16、ioredis 6.0.0、Vitest 5.0.5、tsup 9.0.0、Toolbox 1.14.0、Eve 0.80.1（保留 latest spec）及其余直接依赖。
- Prisma npm latest 指向 8.0.0-rc.23，按最新稳定版口径采用 7.10.1。
- Toolbox 已直接迁移到 group/--group；业务 Skill 重新生成并通过包级 lint/typecheck/test。
- pnpm 12 frozen lockfile 安装与 peers check 通过；Claude runtime 类型检查及 29 项测试通过，1 项 live eval 按原规则跳过。
- 安全修复复核后剩余 1 moderate：`sprintf-js@1.1.3`（GHSA-hp3w-g68c-fv3c）；公告建议的 1.1.4 尚未在 registry 发布，未添加无法安装的版本或隐藏审计结果。
- 根 AGENTS.md 已记录个人项目优先最新稳定技术栈、大版本直接迁移、避免旧版兼容代码的规则。
- 升级后 Node 26 + pnpm 12 环境全仓 `turbo run typecheck --force` 11/11 通过，`turbo run lint test build --force` 33/33 通过；108 项测试通过，1 项 live eval 按原规则跳过。
- BullMQ 6 Worker 使用显式 ioredis driver 的本地构造检查通过；Claude SDK 动态 import 通过。
- 基础服务配置升级为 PostgreSQL 18.6 / Redis 8.10.2，官方 Docker Hub 精确 Alpine tag 均返回 200（含 amd64 / arm64）。PostgreSQL 18 官方 PGDATA/VOLUME 已核对，新卷挂载为 `postgres18_data:/var/lib/postgresql`，旧卷未操作。
- Compose 通过本地 YAML parser（支持 anchor）和卷一致性断言，未运行 Docker。迁移说明位于 `docs/upgrade-postgres18.md`。
- 独立 Opus 审查升级配置：无可证实的正确性或部署阻塞；Eve 迁移另做独立审查。
- improve-codebase-architecture 聚焦 Explore：0 个必要 deepening 候选。SDK 在 app 的重复声明为 external bundle 部署所需，Toolbox 双 runtime 生成由现有 module 负责，保留公共 selector seam。报告已输出到系统临时目录并打开。
- Eve 0.80 独立 build/info/eval:list 通过：0 diagnostics，4 skills，3 evals。新版移除 subagent depth 限制，内建 agent 委派仍启用并受 session token 预算约束，README/AGENTS 已同步。
- 最终 `turbo run lint typecheck test build --force` 44/44 任务通过。
- Eve 独立 Opus 复核发现可恢复 `turn.failed → session.waiting` 会被误报成功等待；新增回归先复现失败，再同时归约 session.failed / turn.failed 为本轮 failed，保留已有 continuation 路径。修复后 Eve 31 项测试、lint/typecheck 通过，全仓 11 个 build 通过；总计 109 项测试通过，1 项 live eval 跳过。
