import { describe, it, expect } from "vitest";
import CONST from "@src/CONST";
import { isTooLargeForSyncRun } from "@src/utils/runGating";

describe("isTooLargeForSyncRun", () => {
  it("gates RTMA above CONST.RTMA_SYNC_ROW_LIMIT rows", () => {
    expect(isTooLargeForSyncRun("RTMA", CONST.RTMA_SYNC_ROW_LIMIT + 1)).toBe(
      true,
    );
    expect(isTooLargeForSyncRun("RTMA", 490)).toBe(true);
  });

  it("allows RTMA at or below the limit", () => {
    expect(isTooLargeForSyncRun("RTMA", CONST.RTMA_SYNC_ROW_LIMIT)).toBe(false);
    expect(isTooLargeForSyncRun("RTMA", 15)).toBe(false);
    expect(isTooLargeForSyncRun("RTMA", 0)).toBe(false);
  });

  it("never gates the fast model types, regardless of size", () => {
    for (const modelType of ["MAIVE", "WAIVE", "WLS"] as const) {
      expect(
        isTooLargeForSyncRun(modelType, CONST.RTMA_SYNC_ROW_LIMIT + 1),
      ).toBe(false);
      expect(isTooLargeForSyncRun(modelType, 10_000)).toBe(false);
    }
  });
});
