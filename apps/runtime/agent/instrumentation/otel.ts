import { otel } from "eve/instrumentation/otel";

export default otel({
  functionId: "agent-template-eve",
  tracePolicy: () => ({
    emit: true,
    recordInputs: false,
    recordOutputs: false,
  }),
});
