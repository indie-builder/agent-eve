import { describe, expect, it } from "vitest";
import { defaultDatabaseUrl, getDatabaseUrl } from "./config.js";

describe("getDatabaseUrl", () => {
  it("uses DATABASE_URL when provided", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgresql://user:pass@localhost:5432/app" })).toBe(
      "postgresql://user:pass@localhost:5432/app",
    );
  });

  it("falls back to the template database URL", () => {
    expect(getDatabaseUrl({})).toBe(defaultDatabaseUrl);
  });
});
