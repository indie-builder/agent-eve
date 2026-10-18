import { createHash, timingSafeEqual } from "node:crypto";

export function isLoopbackEveHost(host: string) {
  const hostname = new URL(host).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function matchesServiceToken(actual: string | null, expected: string): boolean {
  if (!actual || !expected) {
    return false;
  }

  return timingSafeEqual(hashToken(actual), hashToken(expected));
}

function hashToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}
