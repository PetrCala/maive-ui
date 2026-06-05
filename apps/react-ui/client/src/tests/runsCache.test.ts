import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RTMAResults } from "@src/types/api";

// In-memory store backing a mocked idb database, so we can exercise the
// runsCache wrapper without a real IndexedDB (jsdom has none).
const store = new Map<string, unknown>();

vi.mock("idb", () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      put: (_storeName: string, value: unknown, key: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
      get: (_storeName: string, key: string) => Promise.resolve(store.get(key)),
      delete: (_storeName: string, key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      clear: () => {
        store.clear();
        return Promise.resolve();
      },
      objectStoreNames: { contains: () => true },
      createObjectStore: () => undefined,
    }),
  ),
}));

// eslint-disable-next-line import/first
import {
  putResult,
  getResult,
  deleteResult,
  clearAllResults,
} from "@src/utils/runsCache";

const sample = { foo: "bar" } as unknown as RTMAResults;

describe("runsCache", () => {
  beforeEach(() => {
    store.clear();
    // Satisfy the `typeof indexedDB === "undefined"` guard; the actual idb
    // openDB is mocked above.
    vi.stubGlobal("indexedDB", {});
  });

  it("stores and retrieves a result by jobId", async () => {
    await putResult("job-1", sample);
    expect(await getResult("job-1")).toEqual(sample);
  });

  it("returns undefined for a missing jobId", async () => {
    expect(await getResult("missing")).toBeUndefined();
  });

  it("deletes a cached result", async () => {
    await putResult("job-1", sample);
    await deleteResult("job-1");
    expect(await getResult("job-1")).toBeUndefined();
  });

  it("clears all cached results", async () => {
    await putResult("a", sample);
    await putResult("b", sample);
    await clearAllResults();
    expect(await getResult("a")).toBeUndefined();
    expect(await getResult("b")).toBeUndefined();
  });
});
