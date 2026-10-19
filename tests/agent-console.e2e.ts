import { expect } from "e2e";
import { test } from "./fixtures";

test.describe("Agent 控制台", { platforms: ["web"] }, () => {
  test("从首页进入控制台，空请求不会发出", async ({ app, browser, screen, api }) => {
    let requests = 0;
    await browser.route("**/agent/chat", async (route) => {
      requests += 1;
      await route.abort();
    });
    await app.open("/");
    await expect(screen.getByRole("heading", "项目模板已就绪")).toBeVisible();
    await expect(screen.getByText("ok", { exact: true })).toHaveCount(1);
    await screen.getByRole("link", "打开 Agent 控制台").tap();
    await expect(browser).toHaveURL("/agent");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("请输入 Agent 请求。")).toBeVisible();
    expect(requests).toBe(0);
    expect(api).toContain("14020");
  });

  test("通过真实 Chat HTTP 接口回复、续聊并开始新会话", async ({ app, browser, screen, api }) => {
    const requests: Record<string, unknown>[] = [];
    await browser.route("**/agent/chat", async (route) => {
      expect(route.request.url).toBe(`${api}/agent/chat`);
      requests.push(JSON.parse(route.request.postData ?? "{}"));
      await route.continue();
    });
    await app.open("/agent");
    await screen.getByLabel("Prompt").fill("  检查销售数据  ");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("Agent 已完成回复。")).toBeVisible();
    await expect(screen.getByText("收到：检查销售数据")).toBeVisible();
    await expect(screen.getByText("Final result")).toBeVisible();
    expect(requests[0]).toEqual({ prompt: "检查销售数据" });
    await screen.getByLabel("Prompt").fill("继续分析");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("收到：继续分析")).toBeVisible();
    expect(requests[1]).toMatchObject({
      prompt: "继续分析",
      continuation: { token: expect.any(String) },
    });
    await screen.getByRole("button", "开始新会话").tap();
    await expect(screen.getByLabel("Prompt")).toHaveValue("");
    await expect(screen.getByText("暂无运行事件。")).toBeVisible();
    await screen.getByLabel("Prompt").fill("新的请求");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("收到：新的请求")).toBeVisible();
    expect(requests).toHaveLength(3);
    expect(requests[2]).toEqual({ prompt: "新的请求" });
  });

  test("人工确认经 API 校验并携带 opaque continuation 续接", async ({
    app,
    browser,
    screen,
    api,
  }) => {
    const requests: unknown[] = [];
    await browser.route("**/agent/chat", async (route) => {
      expect(route.request.url).toBe(`${api}/agent/chat`);
      requests.push(JSON.parse(route.request.postData ?? "{}"));
      await route.continue();
    });
    await app.open("/agent");
    await screen.getByLabel("Prompt").fill("生成报表");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("Agent 会话正在等待人工输入或下一条消息。")).toBeVisible();
    await expect(screen.getByRole("button", "提交回答")).toBeDisabled();
    await screen.getByRole("button", "确认生成").tap();
    await screen.getByRole("button", "提交回答").tap();
    await expect(screen.getByText("Agent 已完成回复。")).toBeVisible();
    await expect(screen.getByText("报表已生成。")).toHaveCount(2);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual({
      continuation: { token: expect.any(String) },
      responses: [{ kind: "selected-option", requestId: "confirm-report", optionId: "yes" }],
    });
  });

  test("无选项的人工输入经 API 校验并携带 opaque continuation 续接", async ({
    app,
    browser,
    screen,
    api,
  }) => {
    const requests: unknown[] = [];
    await browser.route("**/agent/chat", async (route) => {
      expect(route.request.url).toBe(`${api}/agent/chat`);
      requests.push(JSON.parse(route.request.postData ?? "{}"));
      await route.continue();
    });
    await app.open("/agent");
    await screen.getByLabel("Prompt").fill("补充说明");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("Agent 会话正在等待人工输入或下一条消息。")).toBeVisible();
    await expect(screen.getByRole("button", "提交回答")).toBeDisabled();
    await screen.getByLabel("请补充说明").fill("请补充预算");
    await expect(screen.getByRole("button", "提交回答")).toBeEnabled();
    await screen.getByRole("button", "提交回答").tap();
    await expect(screen.getByText("Agent 已完成回复。")).toBeVisible();
    await expect(screen.getByText("已收到补充：请补充预算")).toHaveCount(2);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual({
      continuation: { token: expect.any(String) },
      responses: [{ kind: "text", requestId: "supplement", text: "请补充预算" }],
    });
  });

  test("临时 HTTP 失败后重试真实 API", async ({ app, browser, screen, api }) => {
    let requests = 0;
    await browser.route("**/agent/chat", async (route) => {
      expect(route.request.url).toBe(`${api}/agent/chat`);
      requests += 1;
      if (requests === 1) {
        await route.fulfill({ status: 503, json: { message: "temporarily unavailable" } });
      } else {
        await route.continue();
      }
    });
    await app.open("/agent");
    await screen.getByLabel("Prompt").fill("重试");
    await screen.getByRole("button", "发送给 Agent").tap();
    await expect(screen.getByText("后端拒绝了 Agent Chat 请求（状态码 503）。")).toBeVisible();
    await screen.getByRole("button", "重试").tap();
    await expect(screen.getByText("收到：重试")).toBeVisible();
    expect(requests).toBe(2);
  });
});
