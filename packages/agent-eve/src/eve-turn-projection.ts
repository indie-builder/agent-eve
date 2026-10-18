import type { InputOption, InputRequest, MessageStreamEvent } from "eve/client";
import type { AgentRunEvent } from "@agent-template/shared";

export type EveStreamProjectionState = {
  messageText: string;
};

export type EveTurnProjection =
  | { status: "completed" | "waiting"; output: string }
  | { status: "failed"; reason: string };

export function projectEveTurn(
  events: readonly MessageStreamEvent[],
): EveTurnProjection | undefined {
  const failed =
    findLastByType(events, "session.failed") ??
    findLastByType(events, "turn.failed");
  if (failed) {
    return { status: "failed", reason: failed.data.message };
  }

  const boundary = findLastBoundary(events);
  if (!boundary) {
    return undefined;
  }

  return {
    status: boundary.type === "session.completed" ? "completed" : "waiting",
    output: findEveOutput(events),
  };
}

export function projectEveStreamEvent(
  event: MessageStreamEvent,
  state: EveStreamProjectionState,
): AgentRunEvent[] {
  switch (event.type) {
    case "message.appended":
      state.messageText += event.data.messageDelta;
      return state.messageText
        ? [{ kind: "text", text: state.messageText }]
        : [];
    case "message.completed":
      state.messageText = "";
      return [{ kind: "text", text: event.data.message }];
    case "actions.requested":
      return event.data.actions.map((action) => ({
        kind: "tool-call",
        tool: readActionRequestName(action),
        input: formatEveOutput(action.input),
      }));
    case "action.result": {
      const tool = readActionResultName(event.data.result);
      return tool
        ? [
            {
              kind: "tool-result",
              tool,
              status: event.data.status,
              ...(event.data.error?.message
                ? { error: event.data.error.message }
                : {}),
            },
          ]
        : [];
    }
    case "input.requested":
      return [
        {
          kind: "input-requested",
          requests: event.data.requests.map(projectInputRequest),
        },
      ];
    case "authorization.required":
      return [
        {
          kind: "authorization",
          connection: event.data.name,
          status: "required",
          description: event.data.description,
          ...(event.data.authorization?.url
            ? { url: event.data.authorization.url }
            : {}),
          ...(event.data.authorization?.userCode
            ? { userCode: event.data.authorization.userCode }
            : {}),
          ...(event.data.authorization?.instructions
            ? { instructions: event.data.authorization.instructions }
            : {}),
        },
      ];
    case "authorization.completed":
      return [
        {
          kind: "authorization",
          connection: event.data.name,
          status: event.data.outcome,
        },
      ];
    case "agent.started":
      return [
        {
          kind: "subagent",
          name: event.data.name,
          status: "started",
          sessionId: event.data.sessionId,
        },
      ];
    case "task.started":
      return [];
    case "task.settled":
      return event.data.kind === "agent" && event.data.name
        ? [
            {
              kind: "subagent",
              name: event.data.name,
              status:
                event.data.status === "cancelled"
                  ? "stopped"
                  : event.data.status,
            },
          ]
        : [];
    case "compaction.requested":
      return [
        {
          kind: "compaction",
          status: "requested",
          ...(event.data.usageInputTokens === null
            ? {}
            : { inputTokens: event.data.usageInputTokens }),
        },
      ];
    case "compaction.completed":
      return [{ kind: "compaction", status: "completed" }];
    case "step.completed": {
      const usage = event.data.usage;
      return usage
        ? [
            {
              kind: "usage",
              ...(usage.inputTokens === undefined
                ? {}
                : { inputTokens: usage.inputTokens }),
              ...(usage.outputTokens === undefined
                ? {}
                : { outputTokens: usage.outputTokens }),
              ...(usage.cacheReadTokens === undefined
                ? {}
                : { cacheReadTokens: usage.cacheReadTokens }),
              ...(usage.cacheWriteTokens === undefined
                ? {}
                : { cacheWriteTokens: usage.cacheWriteTokens }),
              ...(usage.costUsd === undefined
                ? {}
                : { costUsd: usage.costUsd }),
            },
          ]
        : [];
    }
    case "session.waiting":
      return [{ kind: "waiting" }];
    case "step.failed":
    case "turn.failed":
    case "session.failed":
      return [{ kind: "error", message: event.data.message }];
    case "action.input.appended":
    case "action.partial":
    case "approval.candidate":
    case "approval.settled":
    case "context.cleared":
    case "input.resolved":
    case "message.received":
    case "reasoning.appended":
    case "reasoning.completed":
    case "result.completed":
    case "session.completed":
    case "session.started":
    case "step.started":
    case "turn.cancelled":
    case "turn.completed":
    case "turn.started":
    case "turn.waiting":
      return [];
    default: {
      const unhandled: never = event;
      void unhandled;
      return [];
    }
  }
}

function projectInputRequest(request: InputRequest) {
  return {
    requestId: request.requestId,
    prompt: request.prompt,
    tool: request.action.toolName,
    ...(request.display ? { display: request.display } : {}),
    ...(request.allowFreeform === undefined
      ? {}
      : { allowFreeform: request.allowFreeform }),
    ...(request.options
      ? { options: request.options.map(projectInputOption) }
      : {}),
  };
}

function projectInputOption(option: InputOption) {
  return {
    id: option.id,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
    ...(option.style ? { style: option.style } : {}),
  };
}

function readActionRequestName(
  action: Extract<
    MessageStreamEvent,
    { type: "actions.requested" }
  >["data"]["actions"][number],
) {
  switch (action.kind) {
    case "tool-call":
    case "workflow-tool-call":
      return action.toolName;
    case "subagent-call":
      return `eve:subagent:${action.subagentName}`;
    case "remote-agent-call":
      return `eve:subagent:${action.remoteAgentName}`;
    case "load-skill":
      return "eve:load-skill";
  }
}

function readActionResultName(
  result: Extract<
    MessageStreamEvent,
    { type: "action.result" }
  >["data"]["result"],
) {
  switch (result.kind) {
    case "tool-result":
      return result.toolName;
    case "subagent-result":
      return `eve:subagent:${result.subagentName}`;
    case "load-skill-result":
      return "eve:load-skill";
  }
}

function findLastBoundary(events: readonly MessageStreamEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event?.type === "session.waiting" ||
      event?.type === "session.completed" ||
      (event?.type === "turn.waiting" && event.data.on === "input")
    ) {
      return event;
    }
  }

  return undefined;
}

function findEveOutput(events: readonly MessageStreamEvent[]): string {
  const result = findLastByType(events, "result.completed");
  if (result) {
    return formatEveOutput(result.data.result);
  }

  const final = findLastMessage(
    events,
    (finishReason) => finishReason !== "tool-calls",
  );
  const anyMessage = final ?? findLastMessage(events, () => true);
  if (anyMessage) {
    return anyMessage.data.message;
  }

  let streamed = "";
  for (const event of events) {
    if (event.type === "message.appended") {
      streamed += event.data.messageDelta;
    }
  }

  return streamed;
}

function findLastMessage(
  events: readonly MessageStreamEvent[],
  predicate: (finishReason: string) => boolean,
) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event?.type === "message.completed" &&
      predicate(event.data.finishReason)
    ) {
      return event;
    }
  }

  return undefined;
}

function findLastByType<TType extends MessageStreamEvent["type"]>(
  events: readonly MessageStreamEvent[],
  type: TType,
): Extract<MessageStreamEvent, { type: TType }> | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === type) {
      return event as Extract<MessageStreamEvent, { type: TType }>;
    }
  }

  return undefined;
}

function formatEveOutput(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}
