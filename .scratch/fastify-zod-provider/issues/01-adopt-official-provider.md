# 接入官方 Fastify Zod Type Provider

Status: completed

## 需求与选择

用户要求主流成熟技术栈，Fastify与现有Zod结合，减少路由手写类型和校验，并核对相关项目技能。采用Fastify官方@fastify/type-provider-zod稳定版1.0.1，兼容Fastify5.12.7/Zod4.6.7，manifest使用>=1.0.1。不采用新的TypeBox schema，不更换tsx或Next/Eve官方构建。

## 实现

- bootstrap注册validatorCompiler/serializerCompiler；统一handler仅识别hasZodFastifySchemaValidationErrors，返回400中文message，其他错误走Fastify默认处理。
- 三个route module使用FastifyPluginAsyncZod；Chat/Job声明shared body schema，删除重复safeParse分支。
- Health/Job声明shared JSON response schema；SSE只校验输入，保留stream事件编码/headers/错误收尾。
- 保留Agent与queue intake非HTTP入口校验。
- 新增一个故障/泄漏契约检查：未知JSON字段不外泄、非法内部响应500，原内部配置500保护保留。
- API规则、后端架构文档、README与技能说明同步。

## 技能核对

项目已通过Skills CLI安装mcollina/skills的fastify-best-practices，.agents/skills单副本由.claude/skills链接发现；npx skills list --agent claude-code已核实。已有社区Plugin提供zod-validation-expert。不重复安装低采用量第三方技能，也不修改外部技能缓存/源码；TypeBox示例与本项目官方Zod Provider选择的区别记录于apps/api/AGENTS.md和docs/agents/skills.md。

## 验证

全仓typecheck/lint/format通过；55底层契约与6e2e通过；11workspace build与frozen install通过。独立review无必须修复问题，确认SSE、response500和未知字段过滤有效。Provider的Swagger/openapi peer依赖由pnpm解析，不注册Swagger UI或新增文档路由。400的issues格式改为Provider Fastify格式，仓库内无旧结构消费者，已在架构文档注明。

## 提交与限制

根规则要求的improve-codebase-architecture设置disable-model-invocation，仅允许用户手动调用；该指定审查不能自动执行，也不以独立correctness review冒充。用户在获知此限制后明确要求提交PR并合并，本轮据此执行。未运行Docker、数据库迁移或真实模型。
