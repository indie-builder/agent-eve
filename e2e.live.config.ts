import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

const url = process.env.E2E_LIVE_WEB_URL;
if (!url || !process.env.E2E_LIVE_API_URL) {
  throw new Error("真实验收需要已启动的服务：设置 E2E_LIVE_WEB_URL 和 E2E_LIVE_API_URL。");
}

export default {
  tests: "tests/live/**/*.e2e.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  assertionTimeout: 120_000,
  actionTimeout: 120_000,
  targets: [{ name: "live", engine: web(), app: { url } }],
} satisfies E2EConfig;
