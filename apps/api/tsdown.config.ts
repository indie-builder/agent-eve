import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { server: "src/bootstrap/server.ts" },
  format: ["esm"],
  fixedExtension: false,
  platform: "node",
  target: "node26",
  dts: false,
  deps: {
    neverBundle: [
      "@prisma/adapter-pg",
      "@prisma/client",
      "bullmq",
      "fastify",
      "ioredis",
      "pg",
      "pino",
      "zod",
    ],
    alwaysBundle: [/^@agent-template\//],
  },
  clean: true,
});
