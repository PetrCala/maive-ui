import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UploadedData } from "@store/dataStore";

// In-memory store backing a mocked idb database, so we can exercise the
// dataCacheDb wrapper without a real IndexedDB (jsdom has none).
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
      objectStoreNames: { contains: () => true },
      createObjectStore: () => undefined,
    }),
  ),
}));

// eslint-disable-next-line import/first
import {
  putUploadedData,
  getUploadedData,
  deleteUploadedData,
} from "@src/utils/dataCacheDb";

const sample = {
  id: "data_1",
  filename: "study.csv",
  data: [{ effect: 0.2, se: 0.05, n: 100 }],
  rawData: [{ effect: 0.2, se: 0.05, n: 100 }],
  columnNames: ["effect", "se", "n"],
  hasHeaders: true,
  base64Data: "",
  uploadedAt: new Date(),
  subsampleFilter: null,
} as unknown as UploadedData;

describe("dataCacheDb", () => {
  beforeEach(() => {
    store.clear();
    // Satisfy the `typeof indexedDB === "undefined"` guard; idb is mocked above.
    vi.stubGlobal("indexedDB", {});
  });

  it("stores and retrieves an uploaded dataset by id", async () => {
    await putUploadedData("data_1", sample);
    expect(await getUploadedData("data_1")).toEqual(sample);
  });

  it("returns undefined for a missing id", async () => {
    expect(await getUploadedData("missing")).toBeUndefined();
  });

  it("deletes a cached dataset", async () => {
    await putUploadedData("data_1", sample);
    await deleteUploadedData("data_1");
    expect(await getUploadedData("data_1")).toBeUndefined();
  });
});
