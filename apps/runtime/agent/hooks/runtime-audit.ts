import { defineHook, type HookDefinition } from "eve/hooks";

const runtimeAudit: HookDefinition = defineHook({
  events: {
    "session.started"(_event, ctx) {
      audit("info", "session.started", ctx.session.id, ctx.channel.kind);
    },
    "session.waiting"(_event, ctx) {
      audit("info", "session.waiting", ctx.session.id, ctx.channel.kind);
    },
    "session.completed"(_event, ctx) {
      audit("info", "session.completed", ctx.session.id, ctx.channel.kind);
    },
    "session.failed"(event, ctx) {
      audit("error", "session.failed", ctx.session.id, ctx.channel.kind, {
        code: event.data.code,
      });
    },
    "authorization.required"(event, ctx) {
      audit(
        "info",
        "authorization.required",
        ctx.session.id,
        ctx.channel.kind,
        {
          connection: event.data.name,
        },
      );
    },
    "authorization.completed"(event, ctx) {
      audit(
        "info",
        "authorization.completed",
        ctx.session.id,
        ctx.channel.kind,
        {
          connection: event.data.name,
          outcome: event.data.outcome,
        },
      );
    },
    "compaction.completed"(_event, ctx) {
      audit("info", "compaction.completed", ctx.session.id, ctx.channel.kind);
    },
  },
});

export default runtimeAudit;

function audit(
  level: "error" | "info",
  event: string,
  sessionId: string,
  channel: string | undefined,
  detail: Record<string, string> = {},
) {
  try {
    console[level](
      JSON.stringify({
        channel: channel ?? "unknown",
        event,
        sessionId,
        ...detail,
      }),
    );
  } catch {
    // Audit logging must never fail a durable Agent session.
  }
}
