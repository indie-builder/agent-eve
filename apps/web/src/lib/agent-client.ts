import {
  AgentRunResultSchema,
  AgentRunEventSchema,
  type AgentContinuation,
  type AgentInputResponse,
  type AgentRunEvent,
  type AgentRunResult,
} from "@agent-template/shared";

type StreamAgentChatOptions = {
  prompt?: string;
  continuation?: AgentContinuation;
  responses?: AgentInputResponse[];
  baseUrl?: string;
  fetcher?: typeof fetch;
  onEvent?: (event: AgentRunEvent) => void;
};

export async function streamAgentChat({
  prompt = "",
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:14000",
  fetcher = fetch,
  onEvent,
  continuation,
  responses,
}: StreamAgentChatOptions): Promise<AgentRunResult> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt && !responses?.length) {
    throw new Error("Prompt or input responses are required");
  }

  let response: Response;

  try {
    response = await fetcher(`${baseUrl}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
        ...(continuation ? { continuation } : {}),
        ...(responses?.length ? { responses } : {}),
      }),
    });
  } catch {
    throw new Error("Unable to reach Agent chat API");
  }

  if (!response.ok) {
    throw new Error(`Agent chat rejected the request with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Agent chat API did not return a stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AgentRunResult | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = readSseMessages(buffer, (message) => {
      const event = parseSseMessage(message);

      if (event.type === "agent-event") {
        onEvent?.(event.data);
      } else if (event.type === "result") {
        result = event.data;
      } else {
        throw new Error(event.data.message);
      }
    });

    if (done) {
      break;
    }
  }

  if (!result) {
    throw new Error("Agent chat stream ended without a result");
  }

  return result;
}

function readSseMessages(buffer: string, onMessage: (message: string) => void) {
  let cursor = buffer.indexOf("\n\n");

  while (cursor >= 0) {
    onMessage(buffer.slice(0, cursor));
    buffer = buffer.slice(cursor + 2);
    cursor = buffer.indexOf("\n\n");
  }

  return buffer;
}

function parseSseMessage(message: string) {
  let event = "message";
  let data = "";

  for (const line of message.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      data += line.slice("data:".length).trimStart();
    }
  }

  const parsed = JSON.parse(data);

  if (event === "agent-event") {
    return {
      type: "agent-event" as const,
      data: AgentRunEventSchema.parse(parsed),
    };
  }

  if (event === "result") {
    return {
      type: "result" as const,
      data: AgentRunResultSchema.parse(parsed),
    };
  }

  return {
    type: "error" as const,
    data: { message: String(parsed.message ?? "Agent chat failed") },
  };
}
