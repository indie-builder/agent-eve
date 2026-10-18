import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { worker: "src/bootstrap/worker.ts" },
  format: ["esm"],
  fixedExtension: false,
  platform: "node",
  target: "node26",
  dts: false,
  deps: {
    neverBundle: ["bullmq", "ioredis", "pino", "zod"],
    alwaysBundle: [/^@agent-template\//],
  },
  clean: true,
});
