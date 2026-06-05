import { describe, it, expect, vi, beforeEach } from "vitest";
import { modelService } from "@api/services/modelService";

describe("modelService.getRuns", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] without hitting the network for an empty id list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await modelService.getRuns([]);
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests the batch endpoint with comma-joined, encoded ids", async () => {
    const payload = [
      { jobId: "a", status: "running" },
      { jobId: "b", status: "succeeded" },
    ];
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

    const result = await modelService.getRuns(["a", "b"]);

    expect(result).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe("/api/runs?ids=a,b");
  });

  it("throws a descriptive error when the endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    await expect(modelService.getRuns(["a"])).rejects.toThrow(
      /Failed to fetch runs/,
    );
  });
});
