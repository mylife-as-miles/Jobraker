const DB_NAME = "jobraker-chat-attachments";
const DB_VERSION = 1;
const STORE = "images";

export type CachedChatImage = {
  messageId: string;
  mimeType: string;
  name: string;
  base64: string;
  images?: Array<{
    mimeType: string;
    name: string;
    base64: string;
  }>;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "messageId" });
      }
    };
  });
}

export async function cacheChatAttachment(record: Omit<CachedChatImage, "savedAt">): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put({
      ...record,
      savedAt: Date.now(),
    } satisfies CachedChatImage);
  });
}

export async function cacheChatAttachments(
  messageId: string,
  images: Array<{ mimeType: string; name: string; base64: string }>,
): Promise<void> {
  const first = images[0];
  if (!first) return;
  await cacheChatAttachment({
    messageId,
    mimeType: first.mimeType,
    name: first.name,
    base64: first.base64,
    images,
  });
}

export async function getChatAttachment(
  messageId: string,
): Promise<CachedChatImage | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(messageId);
    req.onsuccess = () => resolve((req.result as CachedChatImage) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteChatAttachment(messageId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(messageId);
  });
}
