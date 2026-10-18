# 默认使用本地 Anthropic Messages 网关

Status: completed

## 用户要求

所有 AI 调用采用 Anthropic Messages 协议，目标 `http://127.0.0.1:3425/v1/messages`，`x-api-key` 认证，`anthropic-version: 2023-06-01`，JSON 请求体默认模型 `group/flash`、`max_tokens: 1024`。密钥仅保存本地被忽略的环境文件。

## 实施范围

- Eve 的现有 Anthropic AI SDK provider、模型默认值与单次输出上限。
- 根环境示例、Eve 本地环境、Compose 容器访问宿主机地址、文档与协作约定。
- SDK 请求协议回归测试、runtime/adapter 质量检查与架构审查。

## 验证记录

- 按用户给定协议向本地网关发送 `hi`：HTTP 200，Anthropic Message 响应，实际返回模型 `deepseek-v4.1-flash`（请求为 `group/flash`）。
- 本次不做真实 Agent/Tool/Workflow 回合，不启动 Docker 或迁移数据库。

- SDK mock fetch 回归验证 URL、认证 header、协议版本、模型与默认/覆盖 max_tokens；runtime 18 项测试、lint、typecheck、build 通过。
- 单次输出上限通过 AI SDK defaultSettingsMiddleware 应用，流式与非流式共用，不增加新协议层。
