"use client";

import { useState } from "react";
import type {
  AgentArtifact,
  AgentInputRequest,
  AgentInputResponse,
  AgentRunEvent,
} from "@agent-template/shared";

export function AgentRunTimeline({
  disabled,
  events,
  onInputResponses,
}: {
  disabled?: boolean;
  events: AgentRunEvent[];
  onInputResponses?: (responses: AgentInputResponse[]) => void | Promise<void>;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-950">运行事件</h2>
        <p className="text-sm text-slate-500">来自当前 Agent Chat SSE 连接的运行事件。</p>
      </div>

      {events.length ? (
        <div className="mt-4 flex flex-col gap-3">
          {events.map((event, index) => (
            <AgentRunEventRow
              disabled={disabled}
              event={event}
              key={`${event.kind}-${index}`}
              onInputResponses={onInputResponses}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
          暂无运行事件。
        </p>
      )}
    </section>
  );
}

function AgentRunEventRow({
  disabled,
  event,
  onInputResponses,
}: {
  disabled?: boolean;
  event: AgentRunEvent;
  onInputResponses?: (responses: AgentInputResponse[]) => void | Promise<void>;
}) {
  if (event.kind === "tool-call") {
    return (
      <LogRow label={`Tool call: ${event.tool}`} tone="blue">
        {event.input}
      </LogRow>
    );
  }

  if (event.kind === "tool-result") {
    return (
      <LogRow
        label={`Tool result: ${event.tool}${event.status ? ` (${event.status})` : ""}`}
        tone={event.status === "failed" ? "red" : "green"}
      >
        {event.error}
      </LogRow>
    );
  }

  if (event.kind === "text") {
    return <LogRow label="Agent output">{event.text}</LogRow>;
  }

  if (event.kind === "done") {
    return (
      <LogRow label="Final result" tone="green">
        {event.result}
      </LogRow>
    );
  }

  if (event.kind === "error") {
    return (
      <LogRow label="Run failed" tone="red">
        {event.message}
      </LogRow>
    );
  }

  if (event.kind === "input-requested") {
    return (
      <InputRequestPanel
        disabled={disabled}
        onInputResponses={onInputResponses}
        requests={event.requests}
      />
    );
  }

  if (event.kind === "authorization") {
    return (
      <LogRow label={`连接授权: ${event.connection} (${event.status})`} tone="blue">
        {[event.description, event.instructions, event.url].filter(Boolean).join("\n")}
      </LogRow>
    );
  }

  if (event.kind === "subagent") {
    return (
      <LogRow
        label={`Subagent: ${event.name} (${event.status})`}
        tone={event.status === "failed" || event.status === "stopped" ? "red" : "blue"}
      >
        {event.sessionId}
      </LogRow>
    );
  }

  if (event.kind === "compaction") {
    return (
      <LogRow label={`上下文压缩: ${event.status}`}>
        {event.inputTokens === undefined ? undefined : `触发时输入 token: ${event.inputTokens}`}
      </LogRow>
    );
  }

  if (event.kind === "usage") {
    return (
      <LogRow label="模型用量">
        {[
          event.inputTokens === undefined ? undefined : `输入: ${event.inputTokens}`,
          event.outputTokens === undefined ? undefined : `输出: ${event.outputTokens}`,
          event.costUsd === undefined ? undefined : `成本: $${event.costUsd}`,
        ]
          .filter(Boolean)
          .join(" / ")}
      </LogRow>
    );
  }

  if (event.kind === "waiting") {
    return <LogRow label="Agent 会话等待下一条消息" tone="blue" />;
  }

  if (event.kind === "artifacts") {
    return <ArtifactTabs tabs={event.tabs} />;
  }

  return <LogRow label="Unknown event">{event.text}</LogRow>;
}

type InputDraft = { optionId?: string; text: string };

function InputRequestPanel({
  disabled,
  onInputResponses,
  requests,
}: {
  disabled?: boolean;
  onInputResponses?: (responses: AgentInputResponse[]) => void | Promise<void>;
  requests: AgentInputRequest[];
}) {
  const [drafts, setDrafts] = useState<Record<string, InputDraft>>({});
  const canSubmit = requests.every((request) => {
    const draft = drafts[request.requestId];
    return Boolean(draft?.text.trim() || draft?.optionId);
  });

  function selectOption(request: AgentInputRequest, optionId: string) {
    setDrafts((current) => ({
      ...current,
      [request.requestId]: { optionId, text: "" },
    }));
  }

  function setFreeform(requestId: string, text: string) {
    setDrafts((current) => ({
      ...current,
      [requestId]: { optionId: undefined, text },
    }));
  }

  function submitResponses() {
    const responses = requests.map((request): AgentInputResponse => {
      const draft = drafts[request.requestId];
      if (!draft) {
        throw new Error(`Missing input response for ${request.requestId}`);
      }
      if (draft.text.trim()) {
        return {
          kind: "text",
          requestId: request.requestId,
          text: draft.text.trim(),
        };
      }
      if (!draft.optionId) {
        throw new Error(`Missing selected option for ${request.requestId}`);
      }
      return {
        kind: "selected-option",
        requestId: request.requestId,
        optionId: draft.optionId,
      };
    });
    void onInputResponses?.(responses);
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
      <div className="font-medium">等待人工输入</div>
      <div className="mt-3 flex flex-col gap-4">
        {requests.map((request) => {
          const draft = drafts[request.requestId] ?? { text: "" };
          return (
            <div className="flex flex-col gap-2" key={request.requestId}>
              <p>{request.prompt}</p>
              {request.options?.length ? (
                <div className="flex flex-wrap gap-2">
                  {request.options.map((option) => {
                    const selected = draft.optionId === option.id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={
                          option.style === "danger"
                            ? "rounded-md bg-red-700 px-3 py-1.5 text-white disabled:opacity-50"
                            : selected
                              ? "rounded-md bg-blue-950 px-3 py-1.5 text-white disabled:opacity-50"
                              : "rounded-md bg-blue-700 px-3 py-1.5 text-white disabled:opacity-50"
                        }
                        disabled={disabled || !onInputResponses}
                        key={option.id}
                        onClick={() => selectOption(request, option.id)}
                        title={option.description}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {request.allowFreeform || !request.options?.length ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-blue-900">自定义回答</span>
                  <input
                    aria-label={request.prompt}
                    className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-950"
                    disabled={disabled || !onInputResponses}
                    onChange={(event) => setFreeform(request.requestId, event.target.value)}
                    placeholder="输入回答"
                    value={draft.text}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
        <button
          className="w-fit rounded-md bg-blue-950 px-3 py-1.5 text-white disabled:opacity-50"
          disabled={disabled || !onInputResponses || !canSubmit}
          onClick={submitResponses}
          type="button"
        >
          提交回答
        </button>
      </div>
    </div>
  );
}

function LogRow({
  children,
  label,
  tone = "slate",
}: {
  children?: string;
  label: string;
  tone?: "blue" | "green" | "red" | "slate";
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-green-200 bg-green-50 text-green-900",
    red: "border-red-200 bg-red-50 text-red-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      <div className="font-medium">{label}</div>
      {children ? (
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans leading-6">{children}</pre>
      ) : null}
    </div>
  );
}

function ArtifactTabs({ tabs }: { tabs: AgentArtifact[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) {
    return <LogRow label="Artifacts">No artifact content.</LogRow>;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            className={`rounded-md px-2 py-1 text-left ${tab.id === active.id ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            type="button"
          >
            {tab.label} <span className="text-xs opacity-70">{tab.hint}</span>
          </button>
        ))}
        <button
          className="ml-auto rounded-md bg-white px-2 py-1 text-slate-700"
          onClick={() => void navigator.clipboard?.writeText(active.content)}
          type="button"
        >
          复制
        </button>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-slate-900">
        {active.content}
      </pre>
    </div>
  );
}
