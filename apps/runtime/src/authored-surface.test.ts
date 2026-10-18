import { describe, expect, it } from "vitest";
import { defaultEveAgentModel } from "./model/provider.js";

describe("Eve authored surface", () => {
  it("loads the authored surface through eve defineAgent", async () => {
    const agent = (await import("../agent/agent")).default as {
      model?: { modelId?: string };
    };

    expect(agent.model?.modelId).toBe(defaultEveAgentModel);
  });

  it("owns Toolbox as an Eve MCP connection", async () => {
    const { default: toolbox, eveToolboxToolNames } = await import("../agent/connections/toolbox");
    const connection = toolbox as {
      description?: string;
      tools?: { allow?: readonly string[] };
      url?: string;
    };

    expect(connection.url).toBe("http://localhost:15000/mcp");
    expect(connection.description).toContain("MCP Toolbox read models");
    expect(connection.tools?.allow).toEqual([...eveToolboxToolNames]);
  });

  it("authors production limits, a local-safe sandbox, hooks, and privacy-safe telemetry", async () => {
    const agent = (await import("../agent/agent")).default as {
      compaction?: { thresholdPercent?: number };
      limits?: {
        maxInputTokensPerSession?: number;
        maxOutputTokensPerSession?: number;
      };
    };
    const sandbox = (await import("../agent/sandbox")).default;
    const sandboxEnvironment = (await import("../agent/sandbox")).environment;
    const otel = (await import("../agent/instrumentation/otel")).default;
    const hook = (await import("../agent/hooks/runtime-audit")).default as {
      events?: Record<string, unknown>;
    };

    expect(agent.compaction?.thresholdPercent).toBe(0.75);
    expect(agent.limits).toMatchObject({
      maxInputTokensPerSession: 1_000_000,
      maxOutputTokensPerSession: 100_000,
    });
    expect(sandboxEnvironment.provider).toBe("just-bash");
    expect(sandbox).toBeTypeOf("function");
    expect(
      otel.options.tracePolicy?.({
        agentName: "agent-template-eve",
        audience: "private",
        channel: { kind: "http" },
        environment: "production",
        principalType: "service",
      }),
    ).toEqual({
      emit: true,
      recordInputs: false,
      recordOutputs: false,
    });
    expect(hook.events).toHaveProperty("session.failed");
  });

  it("authors the shared PostgreSQL Workflow world and keeps it external in hosted output", async () => {
    const agent = (await import("../agent/agent")).default as {
      build?: { externalDependencies?: readonly string[] };
      experimental?: { workflow?: { world?: string } };
    };

    expect(agent.experimental?.workflow?.world).toBe("@workflow/world-postgres");
    expect(agent.build?.externalDependencies).toEqual(["@workflow/world-postgres"]);
  });

  it.each(["bash", "read_file", "web_fetch", "web_search", "write_file"])(
    "disables the production-incompatible default tool %s",
    async (tool) => {
      const definition = (await import(`../agent/tools/${tool}.ts`)).default as {
        kind?: string;
      };

      expect(definition.kind).toBe("eve:disabled-tool");
    },
  );
});
