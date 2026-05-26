type CachedAuthUser = {
  id: string;
  email?: string;
};

export type CachedAuthSnapshot = {
  hasSession: boolean;
  user: CachedAuthUser | null;
  onboardingComplete: boolean | null;
  updatedAt: number;
};

const DB_NAME = "jobraker-offline-cache";
const STORE_NAME = "kv";
const AUTH_SNAPSHOT_KEY = "auth-snapshot";
const LOCAL_STORAGE_FALLBACK_KEY = "jobraker.offline.authSnapshot";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function toSerializable(snapshot: CachedAuthSnapshot) {
  return JSON.stringify(snapshot);
}

function fromSerializable(value: unknown): CachedAuthSnapshot | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as CachedAuthSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      hasSession: Boolean(parsed.hasSession),
      user:
        parsed.user && typeof parsed.user.id === "string"
          ? {
              id: parsed.user.id,
              email:
                typeof parsed.user.email === "string"
                  ? parsed.user.email
                  : undefined,
            }
          : null,
      onboardingComplete:
        typeof parsed.onboardingComplete === "boolean"
          ? parsed.onboardingComplete
          : null,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function readFallbackSnapshot(): CachedAuthSnapshot | null {
  if (typeof window === "undefined") return null;
  return fromSerializable(window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY));
}

function writeFallbackSnapshot(snapshot: CachedAuthSnapshot | null) {
  if (typeof window === "undefined") return;
  if (!snapshot) {
    window.localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
    return;
  }
  window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, toSerializable(snapshot));
}

async function readIndexedDbSnapshot(): Promise<CachedAuthSnapshot | null> {
  const db = await openDb();
  if (!db) return readFallbackSnapshot();

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(AUTH_SNAPSHOT_KEY);
      request.onsuccess = () => resolve(fromSerializable(request.result));
      request.onerror = () => resolve(readFallbackSnapshot());
    } catch {
      resolve(readFallbackSnapshot());
    }
  });
}

async function writeIndexedDbSnapshot(snapshot: CachedAuthSnapshot | null) {
  const db = await openDb();
  writeFallbackSnapshot(snapshot);
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (!snapshot) store.delete(AUTH_SNAPSHOT_KEY);
      else store.put(toSerializable(snapshot), AUTH_SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getCachedAuthSnapshot() {
  return readIndexedDbSnapshot();
}

export async function cacheAuthSnapshot(
  snapshot: Omit<CachedAuthSnapshot, "updatedAt">,
) {
  await writeIndexedDbSnapshot({
    ...snapshot,
    updatedAt: Date.now(),
  });
}

export async function updateCachedOnboardingStatus(
  onboardingComplete: boolean,
  user?: CachedAuthUser | null,
) {
  const existing = await getCachedAuthSnapshot();
  await cacheAuthSnapshot({
    hasSession: existing?.hasSession ?? Boolean(user),
    user: user ?? existing?.user ?? null,
    onboardingComplete,
  });
}

export async function clearCachedAuthSnapshot() {
  await writeIndexedDbSnapshot(null);
}
