import { expect } from "e2e";
import { test } from "./fixtures";

test("Health 与 Agent job intake 的 HTTP 契约", { platforms: ["api"] }, async ({ api }) => {
  const health = await fetch(`${api}/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({
    service: "api",
    status: "ok",
    database: { status: "skipped" },
    redis: { status: "skipped" },
    agent: { runtime: "eve", configured: true },
  });
  const accepted = await fetch(`${api}/agent/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "生成报表", requestedAt: new Date().toISOString() }),
  });
  expect(accepted.status).toBe(202);
  expect(await accepted.json()).toEqual({ id: "acceptance-job", queue: "agent-jobs" });
  const rejected = await fetch(`${api}/agent/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "", requestedAt: new Date().toISOString() }),
  });
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({ message: "请求参数无效" });
});

test(
  "Chat 拒绝无 continuation 的人工回答并通过 SSE 报告 runtime 失败",
  { platforms: ["api"] },
  async ({ api }) => {
    const post = (body: unknown) =>
      fetch(`${api}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const invalid = await post({
      responses: [{ kind: "selected-option", requestId: "confirm-report", optionId: "yes" }],
    });
    expect(invalid.status).toBe(400);
    const failed = await post({ prompt: "继续", continuation: { token: "unknown-session" } });
    expect(failed.status).toBe(200);
    expect(failed.headers.get("content-type")).toContain("text/event-stream");
    expect(await failed.text()).toContain('event: error\ndata: {"message":"Unknown continuation"}');
  },
);
