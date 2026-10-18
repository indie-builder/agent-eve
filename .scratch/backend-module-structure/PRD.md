# 后端能力模块与分层目录

Status: implemented-and-verified

## 目标

后端源码按模块和能力组织，目录体现HTTP入口、应用编排、数据库访问、队列和外部runtime adapter的职责与依赖方向，避免全部平铺在src。保持现有HTTP接口、Eve authored surface和进程部署方式。

## 设计约束

- 根apps保留API、Worker、Eve runtime、Toolbox独立进程；packages保留跨进程共享能力。
- 能力module优先，module内部按真实职责分层；没有职责的层不创建目录或空文件。
- app/server是装配与启动入口；业务HTTP路由通过Fastify封装按能力注册，不让根app继续持有所有handler实现。
- 数据库schema/client/config/fixture应分别有归属；数据库访问有明确入口，但不为尚不存在的CRUD业务伪造repository基类或模型。
- 不新抽全局queue module；保留现有adapter seam及生命周期。
- Eve agent目录服从框架filesystem-first发现规则；可复用实现迁入明确能力目录，更新实际引用。
- 原有公共package exports是调用方interface，目录迁移同步更新exports与内部imports，不保留旧路径兼容文件。
- 统一验收标准继续生效；迁移测试跟随module移动，不增加重复检查。

## 必须同步的范围

源码路径与imports、package exports、TS/build配置、测试fixture imports、Eve agent authored surface引用、Toolbox生成路径及契约、Prisma配置/seed引用、AGENTS/README/部署与测试文档、相关ADR引用。

## 验证

pnpm lint、pnpm typecheck、pnpm test、pnpm build、pnpm format:check；不自动运行Docker、迁移数据库或真实模型。迁移后检查旧路径引用和package import方向，确认Web/API测试与Eve构建均通过。

## 设计依据

mattpocock-skills:codebase-design的module/interface/depth/seam/adapter原则，以及Fastify按feature组织、register封装规则。目标是locality与可导航性，不按目录深度衡量架构质量。
