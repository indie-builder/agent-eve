# 统一 e2e 验收并精简测试

Status: completed

## 用户授权与最终目标

集成tester-army/e2e并安装官方项目Plugin；参考作者最佳实践，以它作为唯一端到端标准，删除重复与低价值用例，集中保留必要底层检查。用户追加要求将这套标准写入项目规则。

## 实现

- 根AGENTS新增测试标准，Web/API/UI/Logger作用域规则与README/docs/testing.md同步。
- 默认pnpm test执行test:contracts与test:e2e；删除冗余test:all别名。
- 默认e2e共6流程：4条Web、2条API；同一runner报告。API target无browser，Web使用Chromium。
- 浏览器成功请求不再被mock：真实Web→HTTP/CORS→Fastify生产路由→runAgent→SSE→UI，只在外部runEve/queue seam提供测试adapter。API端口14020，每测试隔离状态并关闭；Web由runner启动在13020。
- 新增test:live，要求已启动的真实Web/API/Eve环境；缺少URL直接失败、不skip。不自动Docker，默认回归不调用真实模型。
- 25个Vitest文件/89用例精简到13文件/54用例；Shared/Eve协议集中契约文件，UI/Logger移除空Vitest配置/脚本/依赖。删除无调用方submitAgentJob；保留job HTTP验收。
- 保留安全、协议、进程资源释放和数据不变量，新增SSE逐字节UTF-8与queue入队失败仍close保护。原3个Eve eval保留按需运行。
- HTTP验收暴露非法Zod输入原返回500，请求体safeParse限定400，验收锁定状态码；内部配置/metadata错误继续默认500和日志。独立review指出全局ZodError分类会误判，已收窄并补内部故障500回归。
- 官方e2e@e2e Plugin 0.21.2 project scope，三项skills，无重复本地副本。依赖e2e>=0.21.2、@e2e-dev/web>=0.15.2由锁文件固定。

## 验证

Node.js26.12.0：默认pnpm test包含54底层检查和6e2e均通过；全仓lint/format/typecheck通过，生产build11项通过，冻结锁文件安装通过。真实环境入口缺URL时预期CONFIG_LOAD_FAILED（exit2、不执行测试）；提供URL后list发现1条live流程，未调用模型。独立review完成：唯一finding为全局ZodError400误分类；已改请求边界safeParse并新增内部500保护。修复后API lint/typecheck/build、54底层检查、6e2e与全仓format再次通过。

## 提交与审查记录

AGENTS要求的mattpocock-skills:improve-codebase-architecture设置disable-model-invocation:true，工具拒绝自动调用并禁止复刻；该项未执行，不能用独立正确性review冒充。用户在获知此限制后明确要求提交PR并合并，本轮据此完成提交/合并流程。此前Superpowers清理与e2e改动分功能点提交。

## 未验证与限制

真实模型/Live、Eve eval、DB/Redis/MCP/Worker消费与Docker未运行；本机仅模型代理在运行，其他依赖未启动。默认通过不代表真实模型/持久化链路通过。上游0.x升级需重新验证API。无CI workflow。新Plugin需新会话加载。
