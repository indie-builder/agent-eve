# packages/db/prisma 协作指南

## 职责

`packages/db/prisma` 管理 Prisma schema、migration history 和确定性 seed 数据。

## 规则

- `schema.prisma` 是数据模型来源；数据库结构变更必须生成并提交 migration。
- 开发环境用 `pnpm db:migrate` 生成/应用 migration；生产或 CI 用 `prisma migrate deploy`。
- 不手动改已提交且已应用的 migration；需要修正时新增 migration。
- 不用 `prisma db push` 作为长期方案；只能用于一次性原型验证，落地前必须转成 migration。
- `seed.ts` 只编排幂等 `upsert` 并在 `finally` 中关闭连接；不要写随机数据或依赖当前时间。
- `fixtures/template-events.ts` 保存 `SeedEvent` 和确定性事件数组；`fixtures/ecommerce.ts` 保存电商 fixture，数据不变量由同目录 `ecommerce.test.ts` 验证。
- 示例数据保留模板语境，不加入具体客户业务表。

## 验证

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm --filter @agent-template/db lint
pnpm --filter @agent-template/db typecheck
```

## 官方参考

- Prisma Migrate: `https://www.prisma.io/docs/orm/prisma-migrate`
- Development and production: `https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production`
- Deploying database changes: `https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate`
- Seeding: `https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding`
