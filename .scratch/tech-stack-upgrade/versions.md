# 技术栈升级版本记录

核对日期：2026-10-18。npm 直接依赖通过 registry.npmjs.org 的发布元数据核对，原始基线为 `07b743d`。

| 技术                                     | 原版本         | 升级版本                   |
| ---------------------------------------- | -------------- | -------------------------- |
| Node.js                                  | 24.22.0 / 24.x | 26.12.0 / 26.x             |
| pnpm                                     | 11.11.0        | 12.14.0                    |
| Next.js                                  | 16.2.9         | 16.4.2                     |
| React / React DOM                        | 19.2.7         | 19.3.1                     |
| Tailwind CSS / PostCSS integration       | 4.3.1          | 4.3.3                      |
| Fastify                                  | 5.8.5          | 5.12.7                     |
| Prisma CLI / Client / PostgreSQL adapter | 7.8.0          | 7.10.1                     |
| BullMQ                                   | 5.79.1         | 6.3.16                     |
| ioredis                                  | 5.11.1         | 6.0.0                      |
| Claude Agent SDK                         | 0.3.193        | 0.3.302                    |
| Eve                                      | 0.22.4         | 0.80.1（spec 保留 latest） |
| AI SDK                                   | 7.0.14         | 7.0.143                    |
| Anthropic AI SDK provider                | 4.0.7          | 4.0.82                     |
| just-bash                                | 3.1.0          | 3.6.0                      |
| MCP Toolbox                              | 1.6.0          | 1.14.0                     |
| PostgreSQL                               | 17             | 18.6                       |
| Redis                                    | 7              | 8.10.2                     |
| Zod                                      | 4.4.3          | 4.6.7                      |
| Pino                                     | 10.3.1         | 10.4.0                     |
| pg                                       | 8.22.0         | 8.23.1                     |
| dotenv                                   | 17.4.2         | 18.0.8                     |
| Vitest                                   | 4.1.9          | 5.0.5                      |
| tsup                                     | 8.5.1          | 9.0.0                      |
| Turborepo                                | 2.10.0         | 2.11.9                     |
| ESLint                                   | 10.5.0         | 10.13.0                    |
| typescript-eslint                        | 8.62.0         | 8.71.2                     |
| Prettier                                 | 3.8.4          | 3.9.10                     |
| tsx                                      | 4.22.4         | 4.23.15                    |

TypeScript 原生 CLI 7.0.2、TypeScript 6 API 兼容包 6.0.2、@eslint/js 10.0.1、react-markdown 10.1.0、remark-gfm 4.0.1、class-variance-authority 0.7.1、clsx 2.1.1 已是最新稳定版。TypeScript 6 包内 alias 的实际 CLI 为 6.0.3。

Prisma `latest` tag 指向 8.0.0-rc.23，尚属预发布；CLI 与 Client/adapter 统一使用最新稳定 7.10.1。`pnpm outdated` 仅报告这个 RC 差异。

## 迁移要点

- Node 26 不内置 Corepack，Dockerfile 从 packageManager 字段安装 pnpm。
- BullMQ 6 的 ioredis 改为 optional peer，Worker 显式声明 Redis driver。
- Toolbox 直接使用 `kind: group` 与 `skills-generate --group`，同步领域术语、fixture 和文档。
- Eve 按 0.80 的 sessions、stream event、sandbox、instrumentation 接口直接迁移，不维护 0.22 双轨适配。
- 保留 TypeScript 6 JavaScript API 适配，因为 typescript-eslint 尚要求 TypeScript <6.1，TS7 JavaScript API 生态未就绪。

## 安全审计

升级前 82 项：4 critical / 36 high / 39 moderate / 3 low。

更新直接依赖、补齐 Claude SDK 的 MCP peer 并对上游固定的传递依赖采用已发布修复版本后，剩余 1 moderate：`sprintf-js@1.1.3`，GHSA-hp3w-g68c-fv3c。公告要求 >=1.1.4，但 registry 最新仍是 1.1.3；没有伪造安装版本或忽略此公告。项目默认关闭 Eve shell/文件工具。

对上游固定依赖的 override 标明移除条件；自动审计产生的重叠规则已合并。
