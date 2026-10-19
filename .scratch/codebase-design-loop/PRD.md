# 整仓 Codebase Design 迭代

Status: implemented-and-verified

## 用户要求与基线

用户明确调用Codebase Design、Loop，检查整个项目结构并修复不合理处，直到没有未解决的明确结构问题且验证通过。先完成官方Fastify Zod Provider PR#5合并，基线fad3711；本轮分支refactor/codebase-design-loop。

## 准则与停止条件

- 采用codebase-design的module/interface/depth/seam/adapter/locality/deletion test，调整必须有实际触发与检错价值。
- 保持独立部署、Eve authored surface、统一e2e与主流稳定工具链；不增加假想repository/queue registry/DI层。
- 首轮覆盖Web/shared/tests、API/Worker/Agent/DB、runtime/toolbox/build/deploy；确认问题修复后跑聚焦和全仓验证，再独立复审。
- 已确认finding无未解决项，完整lint/typecheck/test/build/format与必要部署产物验证通过，复审无新的明确问题后停止loop。Speculative不为循环凑修复。
- 无Docker/真实模型/数据库迁移。sandbox部署模拟在本地临时目录进行。

## 首轮确认问题

| ID | 议题 | 状态 | 验证 |
| --- | --- | --- | --- |
| A1 | 无options文本HITL无法回答 | verified | 新Web真实HTTP文本HITL旅程 |
| A2 | 唯一runtime不支持multi-select却保留公开interface | verified | 删除无实现分支，shared拒绝旧输入 |
| A3 | rediss URL TLS丢失、非法协议未拒绝 | verified | Node连接adapter协议契约 |
| A4 | Web SSE异常不取消reader、不释放lock | verified | 未结束流与取消异常保护 |
| A5 | HTTP producer无限重试导致入队请求不结束 | verified | 本地连接故障契约，Worker策略保持 |
| A6 | terminal Eve session错误提供continuation | verified | terminal/recoverable分支契约 |
| A7 | SSE下游断开不穿过execution取消seam | verified | 真实HTTP断开与adapter signal检查 |
| A8 | Runtime部署漏sandbox模板 | verified | 隔离部署实际open/read Skill |
| A9 | Turbo跨目录输入遗漏导致错误缓存命中 | verified | dry-run hash失效检查 |
| A10 | Prisma生成前置泄漏给build/typecheck调用方 | verified | 无generated干净检查 |

## 首轮验证

Node26.12.0：frozen install、全仓lint、12任务typecheck、80底层检查、7e2e、12任务build、format全部通过。额外本地sandbox隔离读4Skill、缺模板负向对照、Turbo根tsconfig/allowlist/Skill hash变化、无generated生成与缓存恢复均通过。独立第二轮复审进行中。

## 第二轮复审

执行生命周期复审发现A11：session_not_active的POST拒绝没有stream event时仍回传失效continuation。已限定识别Eve ClientError code清除该token，普通temporarily_unavailable保留，31项Eve adapter检查通过。其余真实SDK取消路径复核通过。工程复审发现A12：next typegen后旧.next/dev validator仍污染独立检查；已增加继承主配置的tsconfig.typecheck.json排除dev产物，主配置保留Next开发发现。隔离副本中旧配置对不存在路由失败，新配置通过。sandbox部署/DB任务图/inputs复审无新问题。连接/HITL复审发现A13/A14：blocking连接初始化不代表Worker无活跃任务，强制关闭判定需只看主连接；reader.cancel的pending promise不能阻塞协议错误，已改fire-and-forget并保留解锁/rejection处理，Web5项检查通过。其他TLS/producer空闲后可用/HITL多请求与边界通过。Worker已仅按主connection初始化状态force关闭；本地真实BullMQ双连接握手回归旧实现失败、修复通过，7项Worker检查通过。

## 最终验证

第二轮补充修复后，Node26.12.0完整frozen install/lint/typecheck、84底层检查、7e2e、12任务build、format全部通过。最终独立复审完成，无新增阻断项。A11真实SDK错误类型、A12最终类型文件集合、A13双连接关闭判定和A14 pending cancel解锁均复核成立。Loop已停止。

## 保留边界

BullMQ主连接已ready但blocking连接握手永久无响应时，graceful close仍可能持续等待。现有双连接回归会释放握手，不能证明永久挂起可自行退出。简单扩大force条件会中断活跃任务；需上游修复或单独处理blocking初始化中断并确保活跃任务排空，本轮不扩张此治理范围。生产退出宽限期仍有意义。外部取消只停止本地transport，不承诺终止远端durable turn。

未执行Docker、真实Redis/TLS、数据库迁移或模型；sandbox仅本地隔离部署验证。实现与全仓检查运行于Node26.12.0，最终复审的部分内存核验运行于Node24.22.0。

## 记录

首轮审查指出当前按能力module的目录、官方Zod Provider、shared浏览器/Node入口、轻量UI/logger以及Agent execution公共interface合理，不为行数或目录层数重构。

指定improve-codebase-architecture设置disable-model-invocation，只能手动执行。本次用户明确调用codebase-design与loop，执行此工作流而非复刻保留技能。此前已授权的PR#5合并完成；用户在获知指定技能限制和剩余边界后明确要求本轮提交PR并合并，修复按功能候选独立提交。生产自动部署不在范围。
