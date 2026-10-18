# 后端模块与目录分层

本项目采用能力module优先、module内按真实职责分层的结构。进程划分继续遵循[ADR 0009](adr/0009-eve-only-independent-services.md)，API、Worker、Eve runtime、Toolbox独立部署；目录表达源码归属，不改变运行时拓扑。

## 目录与职责

```text
apps/api/src/
  bootstrap/                  # Fastify装配、启动、环境配置
  modules/
    agent-chat/http/          # 输入校验、Chat路由、SSE生命周期
    agent-jobs/
      http/                   # job HTTP入口
      application/            # Agent job intake：校验、入队、结果与关闭
      infrastructure/         # BullMQ queue创建
    health/
      http/                   # Health HTTP入口
      application/            # 依赖状态聚合与降级规则
      infrastructure/         # PostgreSQL/Redis探测、超时、释放
apps/worker/src/
  bootstrap/                  # 环境与进程启动
  modules/agent-jobs/          # consumer装配、状态转换、信号与关闭
apps/runtime/
  src/model/                  # 模型provider与执行限制
  src/security/               # channel认证策略
  agent/                      # Eve固定发现目录，不搬进src/modules
  evals/                      # Eve原生模型行为评估
apps/toolbox/
  tools.yaml                  # 数据库Tool provider与只读SQL
  src/skills/                 # 业务Skill生成与契约
packages/
  db/
    src/postgres/             # Client与数据库连接配置
    prisma/schema.prisma      # 持久化模型
    prisma/migrations/        # migration历史
    prisma/fixtures/          # seed样例数据及不变量
    prisma/seed.ts            # 幂等写入与连接关闭
  agent/src/run/              # 公共Agent run：输入/环境校验与结果投影
  agent-eve/src/
    client/                   # Eve HTTP client执行与连接配置
    protocol/                 # continuation、HITL、事件转换
    security/                 # token与loopback信任规则
  shared/src/
    agent-run/                # 前后端共享run/event契约
    agent-jobs/               # job契约
    health/                   # 健康状态契约
    queue/                    # 纯连接参数解析，不是queue runtime
  logger/src/index.ts         # 单一Pino能力入口，保持小而直接
```

顶层装配只连接module和adapter，不持有所有HTTP handler。业务module内部只有真正有职责的层：Chat当前直接调用公共Agent run，不额外创建转调service；Worker consumer已经封装消费和关闭流程，不再拆一个透传job handler。

## 依赖方向

- `bootstrap`选择生产或测试adapter，连接HTTP module与application。
- `http`负责请求、状态码、headers、SSE；`application`负责输入、输出、状态与资源生命周期，依赖注入的能力。
- `infrastructure`实现外部访问，持有BullMQ、Redis、Prisma等细节；application不反向import具体外部实现。
- API/Worker经 `@agent-template/agent` → `@agent-template/agent-eve` → Eve HTTP 调用。模型配置和凭证只在runtime。
- Eve authored surface拥有Toolbox connection与allowlist，Toolbox执行自己的SQL，Web/API不代理MCP。
- package通过声明的exports暴露interface。应用不import其他应用源码；根验收fixtures可以装配被测应用，workspace能力仍经package exports调用。

这一划分把改变集中在对应module，提高locality；现有queue/health/runtime seam继续支持生产与测试adapter，保留检错leverage，不增加通用DI容器。

## 数据库访问与repository

数据库并非所有文件都放进一个repository目录：连接、schema/migrations、测试数据、业务查询有不同归属。

当前TypeScript应用没有业务CRUD repository：API只有健康检查 `SELECT 1`，样例写入在seed，业务只读查询由Toolbox管理。健康检查归health基础设施，seed归Prisma维护流程，Toolbox SQL无需再包TypeScript repository。

当真实业务功能需要TypeScript读写数据库时，在所属能力module增加 `data-access/<业务名>.repository.ts`，封装Prisma查询、事务与映射，application调用有业务含义的操作。只有实际出现跨应用复用，才把完整能力上移 `packages/`。先有实际访问职责，再考虑可替换interface；不预建generic CRUD或空repository基类。

## 新增与迁移规则

1. 先判断所属能力和进程，再选择该module内已有的职责层。只为真实职责创建目录，不强制每个module凑齐三层。
2. 跨进程共享的契约/执行能力归package；进程启动和adapter选择归bootstrap。
3. 同步源码imports、package exports、build/dev入口、Prisma配置、Eve发现引用、Toolbox路径计算、验收fixtures和目录规则；旧源码路径直接移除。
4. 数据库migration历史和Eve authored surface遵循工具约定，不随通用src布局搬迁。
5. 保留现有测试interface，契约随module移动，根 `tests/`仍是唯一Web/API验收入口。目录调整不复制一套测试。

## 构建与验证约束

API/Worker使用命名build entry保持 `dist/server.js`、`dist/worker.js`；Toolbox生成器保持源码和产物相同相对层级，避免 `import.meta.url`定位错误。数据库generated Client与migration位置保持稳定，目录整理不产生migration。

验证使用本地 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm format:check`，并搜索旧路径。真实模型、数据库迁移和Docker仍须按对应运行条件显式执行。

依据：`mattpocock-skills:codebase-design`的module/interface/depth/seam/adapter原则，以及Fastify按feature组织路由和register封装。目录层数不是质量指标，清楚的归属和单向依赖才是目标。
