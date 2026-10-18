import { describe, expect, it } from "vitest";
import { stackItems } from "./stack.js";

describe("stackItems", () => {
  it("includes the required Agent platform technologies", () => {
    expect(stackItems).toContain("Eve Agent runtime");
    expect(stackItems).toContain("BullMQ");
    expect(stackItems).toContain("Fastify");
  });
});
