import { describe, expect, it } from "vitest";

describe("frontend smoke", () => {
  it("loads basic runtime context", () => {
    expect(typeof process.version).toBe("string");
  });
});
