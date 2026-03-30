import type { ResumeState } from "@/store/artboard";

const DB_NAME = "jobraker-resume-drafts";
const DB_VERSION = 1;
const STORE_NAME = "resume-builder-drafts";

export interface ResumeDraftRecord {
  key: string;
  resume: ResumeState;
  updatedAt: number;
  sourceUpdatedAt?: string | null;
}

const canUseIndexedDb = () =>
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

function openResumeDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openResumeDraftDb();

  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = await handler(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    });

    return result;
  } finally {
    db.close();
  }
}

export function getResumeDraftStorageKey(resumeId?: string | null): string {
  return resumeId ? `resume:${resumeId}` : "resume:new";
}

export async function loadResumeDraft(
  key: string,
): Promise<ResumeDraftRecord | null> {
  if (!canUseIndexedDb()) return null;

  return withStore("readonly", (store) => {
    return new Promise<ResumeDraftRecord | null>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as ResumeDraftRecord) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to read resume draft."));
    });
  });
}

export async function saveResumeDraft(record: ResumeDraftRecord): Promise<void> {
  if (!canUseIndexedDb()) return;

  await withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to save resume draft."));
    });
  });
}

export async function removeResumeDraft(key: string): Promise<void> {
  if (!canUseIndexedDb()) return;

  await withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to remove resume draft."));
    });
  });
}
