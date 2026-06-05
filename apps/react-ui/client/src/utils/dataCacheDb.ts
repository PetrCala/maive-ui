import { openDB, type IDBPDatabase } from "idb";
import type { UploadedData } from "@store/dataStore";

// Durable, client-side cache of uploaded/demo datasets (IndexedDB). The
// in-memory `dataCache` Map is lost on a full page reload, which previously
// left the model page with no data and let a run be submitted empty (the R
// backend then reported "Found 0 columns"). Persisting here lets the data be
// recovered after a reload / browser restart. Browser-only → no infra cost.

const DB_NAME = "maive-data-cache";
const STORE = "uploads";
const DB_VERSION = 1;

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

export const putUploadedData = async (
  id: string,
  data: UploadedData,
): Promise<void> => {
  const dbp = getDb();
  if (!dbp) {
    return;
  }
  try {
    const db = await dbp;
    await db.put(STORE, data, id);
  } catch {
    // cache write failures are non-fatal
  }
};

export const getUploadedData = async (
  id: string,
): Promise<UploadedData | undefined> => {
  const dbp = getDb();
  if (!dbp) {
    return undefined;
  }
  try {
    const db = await dbp;
    return (await db.get(STORE, id)) as UploadedData | undefined;
  } catch {
    return undefined;
  }
};

export const deleteUploadedData = async (id: string): Promise<void> => {
  const dbp = getDb();
  if (!dbp) {
    return;
  }
  try {
    const db = await dbp;
    await db.delete(STORE, id);
  } catch {
    // non-fatal
  }
};
