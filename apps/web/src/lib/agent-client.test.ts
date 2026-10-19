import { describe, expect, it } from "vitest";
import { streamAgentChat } from "./agent-client";

describe("Chat SSE 协议异常", () => {
  it.each(["rejected", "pending"] as const)(
    "协议失败时取消流并解锁，%s清理不阻塞原始错误",
    async (cleanup) => {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('event: error\ndata: {"message":"runtime failed"}\n\n'),
          );
        },
        cancel() {
          cancelled = true;
          if (cleanup === "pending") return new Promise<void>(() => {});
          throw new Error("cleanup failed");
        },
      });
      await expect(
        streamAgentChat({ prompt: "运行", fetcher: async () => new Response(body) }),
      ).rejects.toThrow("runtime failed");
      expect(cancelled).toBe(true);
      expect(body.locked).toBe(false);
    },
  );

  it("区分网络不可达与后端 SSE error", async () => {
    await expect(
      streamAgentChat({
        prompt: "运行",
        fetcher: async () => {
          throw new TypeError("fetch failed");
        },
      }),
    ).rejects.toThrow("Unable to reach Agent chat API");
    await expect(
      streamAgentChat({
        prompt: "运行",
        fetcher: async () => new Response('event: error\ndata: {"message":"runtime failed"}\n\n'),
      }),
    ).rejects.toThrow("runtime failed");
  });

  it("拒绝缺少最终结果的截断流", async () => {
    await expect(
      streamAgentChat({
        prompt: "运行",
        fetcher: async () =>
          new Response('event: agent-event\ndata: {"kind":"text","text":"未完成"}\n\n'),
      }),
    ).rejects.toThrow("Agent chat stream ended without a result");
  });

  it("跨网络分块保留 UTF-8 和 SSE 消息边界", async () => {
    const bytes = new TextEncoder().encode(
      'event: result\ndata: {"promptLength":2,"runtime":"eve","configured":true,"status":"completed","output":"中文回复"}\n\n',
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    await expect(
      streamAgentChat({ prompt: "运行", fetcher: async () => new Response(body) }),
    ).resolves.toMatchObject({ output: "中文回复", status: "completed" });
  });
});
