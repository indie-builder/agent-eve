import { defineMcpClientConnection } from "eve/connections";
import { never } from "eve/tools/approval";

export const eveToolboxToolNames = [
  "get-agent-run-summary",
  "get-ecommerce-order-detail",
  "get-template-event",
  "list-agent-run-timeline",
  "list-agent-runs",
  "list-ecommerce-fulfillment-exceptions",
  "list-ecommerce-orders-in-window",
  "list-ecommerce-top-products",
  "list-failed-agent-runs-in-window",
  "list-template-events",
  "list-template-events-in-window",
  "summarize-ecommerce-sales-by-channel",
  "summarize-ecommerce-sales-by-day",
  "summarize-template-events-by-type",
  "summarize-tool-invocations",
] as const;

export default defineMcpClientConnection({
  url: toMcpEndpoint(process.env.TOOLBOX_URL ?? "http://localhost:15000"),
  description:
    "MCP Toolbox read models for Agent runs, template events, and synthetic ecommerce operations.",
  approval: never(),
  tools: { allow: [...eveToolboxToolNames] },
});

function toMcpEndpoint(toolboxUrl: string) {
  const normalized = toolboxUrl.replace(/\/+$/, "");
  return normalized.endsWith("/mcp") ? normalized : `${normalized}/mcp`;
}
