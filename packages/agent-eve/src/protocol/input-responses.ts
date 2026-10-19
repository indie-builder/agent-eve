import type { InputResponse } from "eve/client";
import type { AgentInputResponse } from "@agent-template/shared";

export function toEveInputResponses(responses: readonly AgentInputResponse[]): InputResponse[] {
  return responses.map((response) => {
    switch (response.kind) {
      case "selected-option":
        return {
          requestId: response.requestId,
          optionId: response.optionId,
        };
      case "text":
        return { requestId: response.requestId, text: response.text };
    }
  });
}
