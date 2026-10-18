import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

export default {
  tests: "tests/*.e2e.ts",
  workers: 1,
  assertionTimeout: 10_000,
  targets: [
    { name: "api", platform: "api" },
    {
      name: "web",
      engine: web(),
      app: {
        url: "http://localhost:13020",
        command: {
          executable: "pnpm",
          args: ["--filter", "@agent-template/web", "exec", "next", "dev", "--port", "13020"],
          env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:14020" },
          startupTimeout: 120_000,
          log: ".e2e/logs/web.log",
        },
        readyUrl: "http://localhost:13020/agent",
      },
    },
  ],
} satisfies E2EConfig;
