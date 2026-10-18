# 统一测试标准

TesterArmy e2e 是本项目唯一的端到端验收框架。用户旅程和对外 API 共用 e2e 的配置、fixtures、断言、报告及默认运行入口；Vitest 只保留必要底层契约检查，Eve eval 只做按需模型评估。强制规则见根目录 [AGENTS.md](../AGENTS.md#测试标准)。

## 运行入口

使用 `.nvmrc` 的 Node.js 26.12.0 和项目声明的 pnpm。安装一次 Chromium：

```bash
pnpm install --frozen-lockfile
pnpm exec e2e-web install chromium
pnpm test
```

Linux 环境安装系统依赖可用 `pnpm exec e2e-web install chromium --with-deps`。日常只需要 `pnpm test`，当前仓库没有 CI workflow。

| 命令                                  | 用途                                              |
| ------------------------------------- | ------------------------------------------------- |
| `pnpm test`                           | 精简底层契约检查 → e2e Web/API 验收               |
| `pnpm test:e2e`                       | 只跑统一的确定性 Web/API 验收                     |
| `pnpm test:contracts`                 | 排查底层协议、安全与资源释放问题                  |
| `pnpm test:live`                      | 对已启动的真实 Web/API/Eve 环境验收，调用真实模型 |
| `pnpm exec e2e list`                  | 列出默认验收流程，不启动服务                      |
| `pnpm test:e2e --headed`              | 显示浏览器                                        |
| `pnpm test:e2e --reporter list,junit` | 终端与 JUnit 报告                                 |
| `pnpm lint` / `pnpm typecheck`        | 各 workspace 与全部 e2e 配置、用例检查            |

实际验证版本为 `e2e 0.21.2`、`@e2e-dev/web 0.15.2`，manifest 使用无上限稳定范围，锁文件固定验证版本。engine 自带固定版本 `playwright-core`，不另装 Playwright Test 或 Cypress。匿名遥测可用 `E2E_TELEMETRY_DISABLED=1` 关闭。

## 默认验收覆盖

`e2e.config.ts` 使用两个 target：`api` 不启动浏览器，`web` 使用 Chromium。同一套 e2e runner 在根 `tests/*.e2e.ts` 发现6个流程，不重复在多个 target 执行同一流程。

| 文件                         | 流程                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `tests/agent-console.e2e.ts` | 首页健康状态/导航/空请求；Chat回复/续聊/新会话；人工确认续接；临时HTTP失败重试，共4条 |
| `tests/api.e2e.ts`           | Health/job intake HTTP契约；非法人工回答与runtime SSE错误，共2条                      |

Web 自动在 `localhost:13020` 启动，fixtures 按测试监听 `127.0.0.1:14020` 上的生产 Fastify app，结束后关闭；`workers: 1` 避免固定端口冲突。执行时不要同时运行该应用的另一个 Next dev server（共用 `.next/dev`），也不要占用这两个端口。Next CLI 可能更新自动生成的 `next-env.d.ts` 路径。

成功路径跨越真实页面、浏览器HTTP/CORS、Fastify路由、Zod输入校验、`runAgent`公共入口、SSE编码/解码和UI展示。SSR health同样访问测试API，不再指向Web自身。测试fixture只在已有 `runEve` 与 queue seam 注入确定性adapter：runtime状态在每条测试内隔离，queue不连接Redis。浏览器route观察并放行真实成功请求，仅为503等故障注入伪造错误响应。

这是一套**确定性应用验收**，不等于已经验证真实Eve、模型、MCP、PostgreSQL、Redis或Worker消费。没有为测试在生产代码增加mock模式。API-only target不启动浏览器，但与Web共用runner和fixture。

默认结果在 `.e2e/report.json`，失败trace/截图在 `.e2e/results/`，启动日志在 `.e2e/logs/web.log`，全部忽略提交。e2e不经过Turbo缓存。

## 精简结果与必要例外

原有25个Vitest文件、89个展开用例，收敛为**13个文件、54个用例**。移除两个没有必要保留测试的package的Vitest依赖、脚本和配置；没有使用pass-with-no-tests或skip掩盖测试删除。

| 范围                                       | 处理与保留理由                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| API原路由/health/job成功与continuation测试 | 迁入e2e真实HTTP和浏览器流程，删除inject重复；底层只留health故障聚合、内部故障500分类、queue生命周期（含入队失败close）4项  |
| Web agent-client/stack                     | happy path、HITL与重试由e2e验收；删静态stack断言和无调用方的submitAgentJob，保留网络/SSE error、截断流、UTF-8按字节分块3项 |
| UI/Logger                                  | 删除class合并和Pino名称等简单库行为测试，同时移除空runner配置                                                              |
| Shared                                     | 5个文件集中为contracts.test.ts；删除合法输入回显，保留非法run输入/continuation/Redis URL等5项                              |
| Agent/Eve adapter                          | 集中protocol.test.ts，保留非法token、HITL映射/敏感信息不泄漏、失败优先级、流投影、信任规则及client调用，合计19项           |
| Runtime                                    | 删除latest依赖策略、数组存在性、重复URL归一化检查；保留Messages协议、危险工具禁用、sandbox/telemetry、production认证等15项 |
| Toolbox                                    | 4个产物文案测试替换为tools.yaml、runtime allowlist和Skill工具引用的一致性契约1项                                           |
| Worker                                     | 配置校验集中到process.test.ts，保留失败/waiting语义、信号处理与只关闭一次5项                                               |
| DB fixture                                 | 保留数据规模确定性和金额不变量2项，删除默认URL常量测试                                                                     |

选择是否写底层测试的标准是：该保护无法通过少量稳定用户/API流程有效验证。不要把每个合法schema、getter或简单委托都变成单测，也不为减少数字把无关场景硬合成一个长测试。

## 真实环境验收与模型评估

先按部署文档准备Web/API/Eve和所需数据库；Web的 `NEXT_PUBLIC_API_BASE_URL` 必须匹配目标API。然后显式运行：

```bash
E2E_LIVE_WEB_URL=http://localhost:13000 \
E2E_LIVE_API_URL=http://localhost:14000 \
pnpm test:live
```

`e2e.live.config.ts` 只发现 `tests/live/*.e2e.ts`，不启动/修改外部服务，不注入runtime adapter。缺少URL直接报错；服务不可达、健康检查失败或模型未返回有效结果均使测试失败。流程通过浏览器发送随机标记，再用原样continuation续接，检查两次实际SSE结果和相同session，验证真实模型回忆。它会写入Eve/Workflow会话并产生模型费用；指向开发/验收环境。

Live与默认回归使用同一框架，分别运行以隔离外部环境条件和模型成本；它不能替代MCP工具与queued job消费的专门验收。本次未运行live：本机只有模型代理在运行，PostgreSQL、Redis、API和Eve均未启动，没有自动运行Docker。

原有3个Eve eval继续保留：销售分析工具调用、默认危险工具权限、会话连续性。可先 `pnpm --filter @agent-template/runtime eval:list`，需要时 `pnpm --filter @agent-template/runtime exec eve eval`。它们不是另一套UI验收，不纳入默认 `pnpm test`。Prisma migration/seed仍是显式操作。

## 上游依据

- [测试金字塔与AI Agent](https://tester.army/blog/test-pyramid-ai-agents)：保留必要逻辑单测和窄集成，删除不再增加信心的重复宽测试；旅程以故障后需要立即修复的用户目标为准。文章部分讨论TesterArmy托管平台，不能把其云能力自动视为本地SDK能力。
- [开源e2e API testing](https://e2e.tester.army/docs/api-testing)：UI和API在同一runner执行，API-only可无browser/model。
- [开源e2e断言边界](https://e2e.tester.army/docs/reference/expect#not-included)：代码级检查归unit runner，不提供toThrow、resolves/rejects等能力。
- [Introducing e2e](https://tester.army/blog/introducing-e2e)：按步骤选择locator或agent操作，最终检查保持明确；采用e2e不要求每步调用AI。

[官方项目级Plugin](agents/skills.md#e2e-测试技能)提供测试编写、迁移和项目验证技能。新增测试按根规则落在上述现有入口，避免再发展平行套件。
