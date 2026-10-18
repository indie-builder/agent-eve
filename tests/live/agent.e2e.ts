import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { AgentRunResultSchema } from "@agent-template/shared";

test("真实 Web、API 与 Eve 完成回复和会话续接", async ({ app, browser, screen }) => {
  const apiUrl = process.env.E2E_LIVE_API_URL;
  if (!apiUrl) throw new Error("E2E_LIVE_API_URL is required");
  const health = await fetch(new URL("/health", apiUrl));
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    agent: { configured: true, runtime: "eve" },
  });
  const requests: Record<string, unknown>[] = [];
  await browser.route("**/agent/chat", async (route) => {
    expect(route.request.url).toBe(new URL("/agent/chat", apiUrl).href);
    requests.push(JSON.parse(route.request.postData ?? "{}"));
    await route.continue();
  });
  const marker = `验收标记${crypto.randomUUID().replaceAll("-", "")}`;
  await app.open("/agent");
  await screen.getByLabel("Prompt").fill(`请记住这个标记：${marker}。只回复该标记，不调用工具。`);
  const [first] = await Promise.all([
    browser.waitForResponse("**/agent/chat"),
    screen.getByRole("button", "发送给 Agent").tap(),
  ]);
  expect(first.status).toBe(200);
  const firstResult = readResult(await first.text());
  expect(firstResult).toMatchObject({
    sessionId: expect.any(String),
    continuation: { token: expect.any(String) },
  });
  expect(firstResult.output).toContain(marker);
  expect(firstResult.status === "waiting" || firstResult.status === "completed").toBe(true);
  await expect(screen.getByRole("button", "开始新会话")).toBeEnabled();
  await screen
    .getByLabel("Prompt")
    .fill("上一条要求你记住的标记是什么？只回复该标记，不调用工具。");
  const [second] = await Promise.all([
    browser.waitForResponse("**/agent/chat"),
    screen.getByRole("button", "发送给 Agent").tap(),
  ]);
  expect(second.status).toBe(200);
  const secondResult = readResult(await second.text());
  expect(secondResult.output).toContain(marker);
  expect(secondResult.status === "waiting" || secondResult.status === "completed").toBe(true);
  expect(secondResult.sessionId).toBe(firstResult.sessionId);
  await expect(screen.getByText(marker, { exact: false }).first()).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]).not.toHaveProperty("continuation");
  expect(requests[1]).toMatchObject({ continuation: { token: expect.any(String) } });
});

function readResult(stream: string) {
  const message = stream.split("\n\n").find((part) => part.startsWith("event: result\n"));
  if (!message) throw new Error("真实 Agent 没有返回最终结果");
  return AgentRunResultSchema.parse(JSON.parse(message.slice("event: result\ndata: ".length)));
}
