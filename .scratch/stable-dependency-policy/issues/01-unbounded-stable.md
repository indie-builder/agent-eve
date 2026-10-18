# 统一最新稳定版与无上限依赖策略

Status: completed

## 用户要求

pnpm、TypeScript 和其余现有技术栈均可跨大版本升级，不设置版本上限；采用最新稳定版本，排除 beta、RC 等预发布。

## 发布核对

2026-10-18 直接查询 npm registry 全部第三方直接依赖，pnpm 最新稳定为 12.14.0，其余直接依赖均为当前最新稳定。Prisma latest 为 8.0.0-rc.23，最高稳定为 7.10.1，保留稳定三件套。

## 调整

- dependencies / devDependencies / peerDependencies 及 npm alias 改用无上限 >= 稳定基线。
- Node engine 改为 >=26.12.0；.nvmrc、packageManager、Docker image 保留经过验证的精确版本，不构成主动升级限制。
- security override 的修复目标去掉 major 上限；左侧漏洞版本选择范围继续保留以限定受影响依赖。
- Eve 继续用户指定 latest spec，安装锁文件固定已验证版本；更新时核对 latest 是否稳定。
- TypeScript 最新稳定为 7.0.2；Next 16.4 默认走CLI，项目没有旧JS API消费者，删除两个alias与TS6兼容包，统一typescript >=7.0.2，不关闭真实类型检查。

## 验证

frozen install、peers、format 均通过；lint/typecheck/test/build 强制执行 44/44 任务通过，89 项测试通过。TypeScript CLI 为 7.0.2，Next 16.4.2 构建类型检查和 DB/shared declaration emit 通过。最新稳定元数据已逐项核对；未运行 Docker、数据库迁移或模型调用。

独立审查与架构 Explore：0 个必要架构候选，无阻塞。pnpm update 按开放 semver 范围解析已排除 Prisma RC；安全审计仍为 1 moderate sprintf-js（上游补丁未发布），无 high/critical。
