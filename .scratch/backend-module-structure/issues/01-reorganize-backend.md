# 后端按能力module与职责层级重组

Status: completed

## 用户需求

API、数据库和访问层等后端源码不再全部平铺，参考架构设计技能按正常模块/能力/层级组织。前一测试与技能PR#3已合并到main（cd939b9），本任务独立分支refactor/backend-modules。

## 设计

详见docs/backend-architecture.md。API bootstrap装配，agent-chat、agent-jobs、health能力各有HTTP入口，存在应用流程/基础设施时才建层；Worker按消费能力归位。DB区分postgres连接、Prisma模型/迁移和fixtures/seed。Eve client分client/protocol/security，模型配置归runtime。Shared按契约能力归位。Eve authored surface保持发现约定。

当前不存在应用业务repository，不预建generic CRUD；实际业务SQL仍由Toolbox持有。后续真实TypeScript业务访问归所属module/data-access。根e2e共享package导入改用公开exports并显式声明workspace开发依赖。

## 范围

迁移源码与测试，更新imports、package exports、dev/build命名入口、Prisma/Toolbox路径计算、e2e fixtures和AGENTS/README/测试/部署文档。不改HTTP行为、schema/migrations、服务拓扑，不保留旧路径兼容层。

## 提交状态

源码迁移和验证完成。根规则要求的improve-codebase-architecture因disable-model-invocation仅允许用户手动调用，该项未执行；本轮已使用codebase-design设计并完成独立正确性/依赖方向审查，无阻断问题。用户在获知限制后再次明确要求本次后端重构提交PR并合并，本轮据此完成提交与合并流程。

## 验证计划

受影响包lint/typecheck/contracts/build；根pnpm lint/typecheck/test/build/format:check、frozen安装、旧路径残留搜索；独立正确性审查。默认54契约/6e2e保持，不执行真实模型/Docker/数据库迁移。
