"use client";

import { FormEvent, useState } from "react";
import { Button } from "@agent-template/ui";
import type {
  AgentContinuation,
  AgentInputResponse,
  AgentRunEvent,
  AgentRunResult,
} from "@agent-template/shared";
import { streamAgentChat } from "@/lib/agent-client";
import { AgentMarkdown } from "./agent-markdown";
import { AgentRunTimeline } from "./agent-run-timeline";

type AgentConsoleStatus =
  | "idle"
  | "submitting"
  | "running"
  | "waiting"
  | "completed"
  | "skipped"
  | "failed";

export function AgentConsole() {
  const [prompt, setPrompt] = useState("");
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [streamedOutput, setStreamedOutput] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AgentConsoleStatus>("idle");
  const [continuation, setContinuation] = useState<AgentContinuation | null>(null);
  const submitting = status === "submitting" || status === "running";
  const messageParts = buildAgentMessageParts(events);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("请输入 Agent 请求。");
      setStatus("failed");
      return;
    }

    await executeAgentTurn({ prompt });
  }

  async function executeAgentTurn(input: { prompt?: string; responses?: AgentInputResponse[] }) {
    setError("");
    setEvents([]);
    setResult(null);
    setStreamedOutput("");
    setStatus("submitting");

    try {
      const chatResult = await streamAgentChat({
        ...input,
        ...(continuation ? { continuation } : {}),
        onEvent(runEvent) {
          setEvents((current) => appendRunEvent(current, runEvent));
          if (runEvent.kind === "text") {
            setStreamedOutput(runEvent.text);
          }
          if (runEvent.kind === "done") {
            setStreamedOutput(runEvent.result);
          }
          setStatus("running");
        },
      });

      setResult(chatResult);
      setContinuation(chatResult.continuation ?? null);
      setStreamedOutput(chatResult.output ?? chatResult.reason ?? "");
      setStatus(chatResult.status === "skipped" ? "skipped" : chatResult.status);
    } catch (caught) {
      setError(getAgentChatErrorMessage(caught));
      setStatus("failed");
    }
  }

  async function handleInputResponses(responses: AgentInputResponse[]) {
    await executeAgentTurn({ responses });
  }

  function handleNewSession() {
    setError("");
    setEvents([]);
    setPrompt("");
    setResult(null);
    setContinuation(null);
    setStatus("idle");
    setStreamedOutput("");
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Prompt</span>
        <textarea
          className="min-h-36 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition focus:border-slate-400"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={continuation ? "继续当前 Agent 会话" : "描述你希望 Agent 完成的工作"}
          value={prompt}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button disabled={submitting} type="submit">
          {submitting ? "运行中..." : status === "failed" ? "重试" : "发送给 Agent"}
        </Button>
        {continuation ? (
          <Button disabled={submitting} onClick={handleNewSession} type="button" variant="outline">
            开始新会话
          </Button>
        ) : null}
        <p
          aria-live="polite"
          className={status === "failed" ? "text-sm text-red-600" : "text-sm text-slate-500"}
        >
          {getStatusText(status, error)}
        </p>
      </div>

      {result || streamedOutput || messageParts.length ? (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p
            className={
              result?.status === "failed"
                ? "text-sm font-medium text-red-700"
                : "text-sm font-medium text-green-700"
            }
          >
            Agent 回复
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {messageParts.length ? (
              messageParts.map((part, index) => (
                <div
                  className="flex flex-col gap-3 break-words text-sm text-slate-950"
                  key={`reply-text-${index}`}
                >
                  <AgentMarkdown>{part.text}</AgentMarkdown>
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-3 break-words text-sm text-slate-950">
                <AgentMarkdown>
                  {streamedOutput || result?.output || result?.reason || "Agent 未返回内容。"}
                </AgentMarkdown>
              </div>
            )}
          </div>
          {result ? <p className="mt-3 text-xs text-slate-500">Runtime: {result.runtime}</p> : null}
        </section>
      ) : null}

      <AgentRunTimeline
        disabled={submitting}
        events={events}
        onInputResponses={handleInputResponses}
      />
    </form>
  );
}

type AgentMessagePart = { kind: "text"; text: string };

function buildAgentMessageParts(events: AgentRunEvent[]) {
  const parts: AgentMessagePart[] = [];

  for (const event of events) {
    if (event.kind === "text" || event.kind === "done") {
      const text = event.kind === "text" ? event.text : event.result;

      if (!text.trim()) {
        continue;
      }

      const previous = parts.at(-1);

      if (previous?.kind === "text") {
        previous.text = text;
      } else {
        parts.push({ kind: "text", text });
      }
    }
  }

  return parts;
}

function appendRunEvent(events: AgentRunEvent[], event: AgentRunEvent) {
  if (event.kind !== "text") {
    return [...events, event];
  }

  const previous = events.at(-1);
  if (previous?.kind === "text") {
    return [...events.slice(0, -1), event];
  }

  return [...events, event];
}

function getStatusText(status: AgentConsoleStatus, error: string) {
  if (status === "submitting") {
    return "正在连接 Agent Chat...";
  }

  if (status === "running") {
    return "Agent 正在执行。";
  }

  if (status === "completed") {
    return "Agent 已完成回复。";
  }

  if (status === "waiting") {
    return "Agent 会话正在等待人工输入或下一条消息。";
  }

  if (status === "skipped") {
    return "Agent runtime 未配置，未执行。";
  }

  if (status === "failed") {
    return error;
  }

  return "准备开始新的 Agent run。";
}

function getAgentChatErrorMessage(caught: unknown) {
  if (!(caught instanceof Error)) {
    return "启动 Agent run 失败，请重试。";
  }

  if (caught.message.startsWith("Agent chat rejected the request with status ")) {
    return `后端拒绝了 Agent Chat 请求（状态码 ${caught.message.split(" ").at(-1)}）。`;
  }

  if (caught.message === "Unable to reach Agent chat API") {
    return "无法连接 Agent Chat API，请检查网络或后端服务。";
  }

  return caught.message;
}
