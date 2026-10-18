# 后端目录重组回归

Status: completed

## 完成条件

- 所有旧源码路径引用已从活动源码、配置、文档与根验收fixture移除，历史ADR/.scratch记录保留原事实。
- 根workspace依赖显式声明；frozen lockfile安装通过。
- 全仓lint/typecheck/test/build/format通过，54必要契约与6e2e保持。
- API/Worker生产产物仍为dist/server.js、dist/worker.js，Toolbox产物dist/skills/generate.js定位正确。
- Eve模型与authored surface构建通过，Prisma schema/migration不变。
- 独立审查没有未解决正确性问题。

## 已验证

Node26.12.0：frozen install、全仓lint/typecheck、54契约与6e2e、11workspace build、format全部通过。API/Worker/Toolbox入口产物存在；Eve run info返回ready且0errors/0warnings，eval:list保留3项。schema/migration/Dockerfile/Compose未改。旧路径活动引用搜索为空；根e2e通过package exports使用workspace能力。独立正确性/依赖方向review完成，无阻断问题；8个受影响package与根e2e类型检查复核通过。

## 不执行

Docker、数据库迁移/seed、Toolbox生成CLI写入与真实模型。目录重组仅本地验证，不把静态路径正确视作外部服务验收。
