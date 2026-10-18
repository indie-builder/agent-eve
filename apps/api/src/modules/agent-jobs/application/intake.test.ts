import { describe, expect, it } from "vitest";
import { createAgentJobIntake } from "./intake.js";

// 队列失败和资源释放无法由正常 HTTP 旅程稳定制造，在 intake seam 验证。
describe("createAgentJobIntake", () => {
  it("入队失败时仍关闭连接，非法输入不创建队列", async () => {
    let created = 0;
    let closed = 0;
    const intake = createAgentJobIntake(() => {
      created += 1;
      return {
        name: "agent-jobs",
        add: async () => {
          throw new Error("queue unavailable");
        },
        close: async () => {
          closed += 1;
        },
      };
    });
    await expect(intake.enqueue({ prompt: "" })).rejects.toThrow("Too small");
    expect(created).toBe(0);
    await expect(
      intake.enqueue({ prompt: "运行", requestedAt: "2026-06-26T00:00:00.000Z" }),
    ).rejects.toThrow("queue unavailable");
    expect(created).toBe(1);
    expect(closed).toBe(1);
  });

  it("validates, enqueues, and closes the Agent job queue", async () => {
    const calls: unknown[] = [];
    const intake = createAgentJobIntake(() => {
      calls.push(["createQueue"]);

      return {
        name: "agent-jobs",
        async add(name, payload) {
          calls.push(["add", name, payload]);
          return { id: "job-1" };
        },
        async close() {
          calls.push(["close"]);
        },
      };
    });
    const result = await intake.enqueue({
      prompt: "Summarize this template",
      requestedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(result).toEqual({ id: "job-1", queue: "agent-jobs" });
    expect(calls).toEqual([
      ["createQueue"],
      [
        "add",
        "agent.run",
        {
          prompt: "Summarize this template",
          requestedAt: "2026-06-26T00:00:00.000Z",
        },
      ],
      ["close"],
    ]);
  });
});
