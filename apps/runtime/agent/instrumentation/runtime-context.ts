import { otelIntegration } from "eve/instrumentation/otel";

export default otelIntegration({
  runtimeContext({ channel, session }) {
    return {
      "agent-template.channel": channel.kind ?? "unknown",
      "agent-template.principalType": session.auth.current?.principalType ?? "unauthenticated",
    };
  },
});
