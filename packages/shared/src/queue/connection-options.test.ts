import { describe, expect, it } from "vitest";
import { createBullMqConnectionOptions } from "./connection-options.js";

describe("BullMQ connection parsing", () => {
  it("parses Redis URLs for BullMQ", () => {
    expect(createBullMqConnectionOptions("redis://user:pass@localhost:16379/2")).toEqual({
      host: "localhost",
      port: 16379,
      username: "user",
      password: "pass",
      db: 2,
    });
  });

  it("enables TLS for rediss URLs and keeps plain redis connections unencrypted", () => {
    expect(createBullMqConnectionOptions("rediss://redis.example.com:16379/0")).toMatchObject({
      host: "redis.example.com",
      port: 16379,
      tls: {},
    });
    expect(createBullMqConnectionOptions("redis://localhost:16379")).not.toHaveProperty("tls");
  });

  it("rejects unsupported Redis URL protocols", () => {
    expect(() => createBullMqConnectionOptions("http://localhost:16379")).toThrow(
      'Unsupported Redis URL protocol "http:"',
    );
  });

  it("rejects non-numeric Redis database indexes", () => {
    expect(() => createBullMqConnectionOptions("redis://localhost/not-a-number")).toThrow(
      "Redis URL database index must be a non-negative integer",
    );
  });
});
