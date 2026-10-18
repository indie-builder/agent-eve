# Oxc / Rust 工具链探索与落地

核对日期：2026-10-18。用户授权探索后直接替换可覆盖现有用途的工具，不维护旧工具双轨。

| 原工具 | 采用工具 | 版本 | 结论 |
| --- | --- | --- | --- |
| ESLint + typescript-eslint | Oxlint | 1.88.0 | 替换直接依赖和全部 workspace lint，根配置统一管理 |
| Prettier | Oxfmt | 0.73.0 | 替换 format 与 Toolbox Skill Markdown 格式化 |
| tsup | tsdown / Rolldown | 0.23.1 / 1.2.x | 替换 7 个包的直接打包命令，保留现有 external 与 workspace bundle |
| Next.js Turbopack | 原有官方构建 | 16.4.2 | 已使用 Rust bundler，保持 |
| Eve 内置 Rolldown | 原有官方构建 | Eve 0.80.1 | 已使用 Rust bundler，保持 |
| TS7 原生 CLI | 原有类型检查 | 7.0.2 | 已是原生实现，继续负责 typecheck |

## 实施细节

- 删除 11 份重复 ESLint 配置，启用根 `.oxlintrc.json`；correctness 为 error，包含 TypeScript、React、Next、accessibility、Vitest 规则，保留 no-explicit-any / ban-ts-comment / no-empty-object-type。
- Oxlint 暴露的 Next 内部链接、无类型 mock 和异常断言问题直接修正，未关闭规则。
- `.oxfmtrc.json` 排除生成产物、lockfile、外部安装技能和工程scratch；关闭 import/package排序，避免格式化改变导入顺序。格式化单独提交。
- tsdown 使用 `deps.alwaysBundle` 内联 workspace，`deps.neverBundle` 保留 API/Worker外部依赖；`fixedExtension:false` 保持部署脚本使用的 `.js` 入口，`dts:false` 延续原构建用途。
- 根 Oxlint 配置纳入 Turbo lint inputs，规则修改使缓存失效。
- TypeScript 6 JavaScript API 适配继续保留给 Next plugin 等现有工具；ESLint移除不意味着这些消费者已支持TS7 API。

## 验证

- 强制绕过缓存的全仓 lint/typecheck/test/build 44/44任务成功，89项测试通过。
- Oxfmt格式检查、frozen-lockfile安装、peer检查通过；Toolbox生成Skill后Markdown格式检查通过。
- tsdown生产包独立部署到临时目录，API health200、Prisma动态chunk import/构造通过，无数据库查询；Worker通过module hook验证并发/事件/关闭。
- 同机单次全仓lint耗时：ESLint 1.86s → Oxlint 0.39s，约4.8倍；含Turbo/进程启动开销，仅为当前项目测量。
- 安全审计仍只有1 moderate sprintf-js，补丁未发布，无high/critical。

## 当前不替换

Fastify、Prisma、BullMQ、Eve、React属于应用/运行时能力，不能用Oxc lint/parse/bundle工具直接替代；没有为了Rust引入另一套服务实现。Vitest已通过Vite/Rolldown构建测试，不引入新测试框架。真实数据库查询、Docker镜像和模型回合不在本次验证内。

## 来源

- https://oxc.rs/docs/guide/usage/linter.html
- https://oxc.rs/docs/guide/usage/formatter
- https://tsdown.dev/guide/migrate-from-tsup
- https://tsdown.dev/options/dependencies
- https://registry.npmjs.org/oxlint/latest
- https://registry.npmjs.org/oxfmt/latest
- https://registry.npmjs.org/tsdown/latest
