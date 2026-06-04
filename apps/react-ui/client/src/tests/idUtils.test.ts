import { describe, it, expect } from "vitest";
import { generateJobId } from "@src/utils/idUtils";

describe("generateJobId", () => {
  it("returns a non-empty string", () => {
    const id = generateJobId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateJobId()));
    expect(ids.size).toBe(100);
  });
});
