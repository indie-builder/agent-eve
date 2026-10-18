# Eve 单栈与独立服务部署

Status: completed

## 用户要求

- 保留 pnpm Workspace + Turborepo 的前后端分离结构。
- 删除 Claude Agent SDK runtime，只使用 Eve；直接按保留技术栈最佳实践实现，不维护旧版兼容或双 runtime 分支。
- Web、API、Worker、Agent runtime 和 Toolbox 按职责与负载独立容器部署、配置资源和扩缩容。

## 范围与验收

- 删除 Claude runtime、依赖、env、volume 声明、前端文案、Skill 双份生成逻辑；更新领域文档与协作规则。
- API 负责 HTTP/SSE/intake，Worker 负责 BullMQ 消费，Eve runtime 承担模型与 MCP 执行；应用不嵌入模型执行服务。
- 为独立进程提供明确的应用入口、镜像 target、构建和启动命令；运行时构建在 build 阶段完成。
- 区分客户端连接配置与 runtime provider 凭证；核实 Eve Workflow 持久化及横向扩容约束。
- 本地 lint/typecheck/test/build 与 Eve 独立 build/info/eval:list、配置结构校验；不运行 Docker、不调用真实模型、不迁移已有数据库。
- 架构审查、必要修复、中文分功能点提交并推送当前跟踪分支。

## 实施与验证

- 删除 Claude package、SDK依赖、selector、env/volume声明；Toolbox只生成Eve Skill。
- authored surface/provider/channel auth/evals迁至apps/runtime；packages/agent-eve收敛为HTTP client adapter，公共输入校验保留packages/agent。
- 四个独立生产镜像target，Web standalone、API/Worker prod deploy、Runtime预构建Nitro输出；模型凭证仅runtime。
- Worker并发配置、failed/skipped队列失败、SIGTERM/SIGINT关闭；Redis AOF/noeviction。
- Eve接入PostgreSQL Workflow world 5.0.4，独立workflow-setup初始化schema；同版本多副本与just-bash进程内sandbox约束已记录。
- 架构审查Strong候选：删除client模型/authoredSurface字段，服务端配置只由runtime持有；调用方schema/UI/测试同步迁移。
- 全仓lint/typecheck/test/build强制执行44/44通过，84项测试通过；peers check通过。
- API/Web/local-world runtime独立临时产物健康检查200；Postgres world完成构建与输出依赖校验，真实DB迁移和多副本恢复未执行。
- pnpm audit剩余1 moderate sprintf-js（补丁未发布），无high/critical。
- 未运行Docker、真实模型调用、数据库迁移；旧Claude卷未删除。
