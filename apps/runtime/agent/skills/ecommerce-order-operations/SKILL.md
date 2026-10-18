---
name: ecommerce-order-operations
description: Investigates ecommerce orders using bounded operational lists and exact order details. Use when the user asks about order status, customer segment context, a concrete order number, or order-level troubleshooting.
---

## Usage

下列 Toolbox 能力通过当前 Agent runtime 自己维护的 MCP connection 暴露。加载本 skill 后，调用该 runtime 的限定 Tool 名；不要绕过 Agent 直接连接数据库。官方生成器同时产出的数据库直连脚本不会安装到 Agent 的 skill 目录。

## Workflow

1. 用户提供订单号时，直接调用 `toolbox__get-ecommerce-order-detail`，不要先扫描订单列表。
2. 用户询问一段时间的订单时，调用 `toolbox__list-ecommerce-orders-in-window`，时间窗不超过 31 天且结果有界。
3. 需要继续核查时，只对用户选中的具体订单调用详情 Tool。
4. 返回合成 customer code、segment 和地区即可；不要声称存在联系方式或真实个人信息。

## Available Toolbox tools

### toolbox__get-ecommerce-order-detail

Return one synthetic ecommerce order with its customer business context and line items.
Use this tool only when the user provides a concrete orderNumber.

#### Parameters

| Name        | Type   | Description                                                 | Required | Default |
| :---------- | :----- | :---------------------------------------------------------- | :------- | :------ |
| orderNumber | string | Concrete ecommerce order number, for example EC20260601001. | Yes      |         |

---

### toolbox__list-ecommerce-orders-in-window

List a bounded operational order view for the synthetic ecommerce dataset.
Customer data is limited to synthetic customer code, segment, and region; no direct contact data is returned.

#### Parameters

| Name  | Type    | Description                                      | Required | Default |
| :---- | :------ | :----------------------------------------------- | :------- | :------ |
| from  | string  | Inclusive ISO-8601 UTC operational window start. | Yes      |         |
| to    | string  | Exclusive ISO-8601 UTC operational window end.   | Yes      |         |
| limit | integer | Maximum number of orders to return.              | No       | `50`    |

---
