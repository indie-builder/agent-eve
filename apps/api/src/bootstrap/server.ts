import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = buildApp({ env });

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

let closing: Promise<void> | undefined;
const close = () => {
  closing ??= app.close();
  return closing;
};

process.on("SIGTERM", close);
process.on("SIGINT", close);
