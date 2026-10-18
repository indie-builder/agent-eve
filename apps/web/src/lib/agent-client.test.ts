import { describe, expect, it } from "vitest";
import { streamAgentChat } from "./agent-client";

describe("Chat SSE 协议异常", () => {
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
