import { describe, it, expect, vi, beforeEach } from "vitest";
import { modelService } from "@api/services/modelService";
import { ApiRequestError } from "@api/utils/http";

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

  it("preserves the backend's message and status instead of a generic wrapper", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    const error = await modelService.getRuns(["a"]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(500);
    expect((error as Error).message).toBe("boom");
  });
});
