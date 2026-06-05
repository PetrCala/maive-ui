import { openDB, type IDBPDatabase } from "idb";
import type { ModelResults, RTMAResults } from "@src/types/api";

// Durable, client-side cache of run results (IndexedDB). Lets a run stay
// viewable after the 48h server TTL and across browser restarts. Browser-only,
// so there is no server/infra cost.

const DB_NAME = "maive-runs-cache";
const STORE = "results";
const DB_VERSION = 1;

type CachedResult = ModelResults | RTMAResults;

let dbPromise: Promise<IDBPDatabase> | undefined;

const getDb = (): Promise<IDBPDatabase> | undefined => {
  if (typeof indexedDB === "undefined") {
    return undefined;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
};

export const putResult = async (
  jobId: string,
  result: CachedResult,
): Promise<void> => {
  const dbp = getDb();
  if (!dbp) {
    return;
  }
  try {
    const db = await dbp;
    await db.put(STORE, result, jobId);
  } catch {
    // cache write failures are non-fatal
  }
};

export const getResult = async (
  jobId: string,
): Promise<CachedResult | undefined> => {
  const dbp = getDb();
  if (!dbp) {
    return undefined;
  }
  try {
    const db = await dbp;
    return (await db.get(STORE, jobId)) as CachedResult | undefined;
  } catch {
    return undefined;
  }
};

export const deleteResult = async (jobId: string): Promise<void> => {
  const dbp = getDb();
  if (!dbp) {
    return;
  }
  try {
    const db = await dbp;
    await db.delete(STORE, jobId);
  } catch {
    // non-fatal
  }
};

export const clearAllResults = async (): Promise<void> => {
  const dbp = getDb();
  if (!dbp) {
    return;
  }
  try {
    const db = await dbp;
    await db.clear(STORE);
  } catch {
    // non-fatal
  }
};
