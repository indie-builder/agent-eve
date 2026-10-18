# Eve 单栈与独立服务部署

## 状态

Accepted。替代 ADR 0001 的双 runtime 选择，以及 ADR 0007 的 Claude authored surface；ADR 0006 与 ADR 0008 的 MCP 所有权、opaque continuation 原则继续适用于 Eve。

## 决策

项目继续采用 pnpm Workspace + Turborepo monorepo，前后端分离。Agent runtime 只使用 Eve，删除 Claude Agent SDK 与 runtime selector，按当前 Eve interface 直接实现。

Web、API、Worker、Eve runtime、Toolbox 分别运行在独立进程和容器中。它们使用独立镜像 target、配置和资源配额；不通过同一个容器或启动脚本一起运行。API/Worker 通过 Eve HTTP client 调用 runtime，模型 provider、Toolbox MCP connection、authored surface 和 Workflow 状态属于 Eve runtime。

- Web：页面与交互，只调用 API。
- API：HTTP 输入校验、Chat SSE、Agent job intake 和健康检查；同步 Chat 转发 Eve stream，后台任务进入 BullMQ。
- Worker：消费 BullMQ、并发与关闭流程，通过同一个 Agent run 公共入口调用 Eve。
- Eve runtime：模型执行、会话、HITL、Tool/MCP 和 Workflow；服务凭证与 provider 凭证分别配置。
- Toolbox：数据库 Tool provider，独立连接 PostgreSQL。
- PostgreSQL / Redis：数据与队列基础设施，独立持久化。

## 部署约束

Web/API/Worker/runtime 按各自负载独立配置副本与资源。Eve 使用与当前协议匹配的 PostgreSQL Workflow world，共享 state、stream 和内部队列；迁移作为一次性部署任务。runtime 副本必须运行相同 Eve 构建版本；上线验证跨副本会话、锁与 Workflow callback。当前 just-bash sandbox 为进程内，依赖文件连续性的多副本场景还需要远程 sandbox 或会话亲和。

## 理由

服务负载、运行时依赖和扩容节奏不同。共享仓库用于复用 schema、日志与构建编排，不代表共享运行进程、provider 凭证或扩容单元。保留实际的公共 Agent run interface，不为已经删除的 runtime 维护 adapter registry 或旧协议兼容路径。
