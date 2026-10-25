// Client-side IndexedDB Asset Vault (Max 20 Audio Items & Max 20 SRT Items FIFO)
// Ensures audio and subtitle files persist across page reloads and never overflow browser storage.

export interface StoredAudioItem {
  id: string;
  name: string;
  sourceTab: "studio" | "merger" | "cleaner" | "transcribe" | "audio-to-srt";
  createdAt: number;
  durationSeconds: number;
  sizeBytes: number;
  dataUrl: string;
  format: string;
  presetUsed?: string;
}

export interface StoredSrtItem {
  id: string;
  name: string;
  sourceTab: "audio-to-srt" | "srt-cleaner" | "studio";
  createdAt: number;
  cuesCount: number;
  srtContent: string;
  durationSeconds?: number;
  scriptStyle?: string;
  filename?: string;
}

const DB_NAME = "AudioStudioDB_v2";
const DB_VERSION = 2;
const AUDIO_STORE = "audio_stack";
const SRT_STORE = "srt_stack";
export const MAX_AUDIO_LIMIT = 20;
export const MAX_SRT_LIMIT = 20;

function notifyVaultUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vault-storage-updated"));
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = () => {
      console.warn("IndexedDB open blocked: another connection has the database open");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;

      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const aStore = db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
        aStore.createIndex("createdAt", "createdAt", { unique: false });
        aStore.createIndex("sourceTab", "sourceTab", { unique: false });
      } else if (tx) {
        try {
          const aStore = tx.objectStore(AUDIO_STORE);
          if (!aStore.indexNames.contains("createdAt")) {
            aStore.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!aStore.indexNames.contains("sourceTab")) {
            aStore.createIndex("sourceTab", "sourceTab", { unique: false });
          }
        } catch (e) {
          console.warn("Could not verify audio indexes:", e);
        }
      }

      if (!db.objectStoreNames.contains(SRT_STORE)) {
        const sStore = db.createObjectStore(SRT_STORE, { keyPath: "id" });
        sStore.createIndex("createdAt", "createdAt", { unique: false });
        sStore.createIndex("sourceTab", "sourceTab", { unique: false });
      } else if (tx) {
        try {
          const sStore = tx.objectStore(SRT_STORE);
          if (!sStore.indexNames.contains("createdAt")) {
            sStore.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!sStore.indexNames.contains("sourceTab")) {
            sStore.createIndex("sourceTab", "sourceTab", { unique: false });
          }
        } catch (e) {
          console.warn("Could not verify srt indexes:", e);
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO QUEUE OPERATIONS (MAX 20 FIFO)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAudioToQueue(
  item: Omit<StoredAudioItem, "id" | "createdAt"> & { id?: string }
): Promise<StoredAudioItem> {
  const db = await openDB();
  const newItem: StoredAudioItem = {
    ...item,
    id: item.id || `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };

  return await new Promise<StoredAudioItem>((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        reject(new Error(`Store ${AUDIO_STORE} not found in database`));
        return;
      }
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);

      store.put(newItem);

      // FIFO pruning using key cursor — avoids loading massive dataUrls into RAM
      const countReq = store.count();
      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > MAX_AUDIO_LIMIT) {
          const excess = count - MAX_AUDIO_LIMIT;
          let deleted = 0;
          try {
            const index = store.index("createdAt");
            const cursorReq = index.openKeyCursor(); // ASC order: oldest first
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor && deleted < excess) {
                store.delete(cursor.primaryKey);
                deleted++;
                cursor.continue();
              }
            };
          } catch {
            // fallback if index missing
          }
        }
      };

      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve(newItem);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    } catch (err) {
      reject(err);
    }
  });
}

export async function getAudioQueue(): Promise<StoredAudioItem[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(AUDIO_STORE)) {
      return [];
    }
    return await new Promise<StoredAudioItem[]>((resolve, reject) => {
      try {
        const tx = db.transaction(AUDIO_STORE, "readonly");
        const store = tx.objectStore(AUDIO_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const items: StoredAudioItem[] = req.result || [];
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(items.slice(0, MAX_AUDIO_LIMIT));
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn("Failed to load IndexedDB audio queue:", e);
    return [];
  }
}

export async function getLatestAudioByTab(
  tab: "studio" | "merger" | "cleaner" | "transcribe" | "audio-to-srt"
): Promise<StoredAudioItem | null> {
  const all = await getAudioQueue();
  const match = all.find((item) => item.sourceTab === tab);
  return match || null;
}

export async function deleteAudioFromQueue(id: string): Promise<void> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(AUDIO_STORE)) return;
  return await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function clearAudioQueue(): Promise<void> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(AUDIO_STORE)) return;
  return await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      store.clear();
      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SRT QUEUE OPERATIONS (MAX 20 FIFO)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSrtToQueue(
  item: Omit<StoredSrtItem, "id" | "createdAt" | "cuesCount"> & {
    id?: string;
    cuesCount?: number;
  }
): Promise<StoredSrtItem> {
  const db = await openDB();
  const calculatedCues =
    item.cuesCount !== undefined
      ? item.cuesCount
      : (item.srtContent.match(/-->/g) || []).length;

  const newItem: StoredSrtItem = {
    ...item,
    cuesCount: calculatedCues,
    filename: item.filename || `${item.name.replace(/\s+/g, "_")}.srt`,
    id: item.id || `srt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };

  return await new Promise<StoredSrtItem>((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(SRT_STORE)) {
        reject(new Error(`Store ${SRT_STORE} not found in database`));
        return;
      }
      const tx = db.transaction(SRT_STORE, "readwrite");
      const store = tx.objectStore(SRT_STORE);

      store.put(newItem);

      // FIFO pruning using key cursor
      const countReq = store.count();
      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > MAX_SRT_LIMIT) {
          const excess = count - MAX_SRT_LIMIT;
          let deleted = 0;
          try {
            const index = store.index("createdAt");
            const cursorReq = index.openKeyCursor(); // ASC order: oldest first
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor && deleted < excess) {
                store.delete(cursor.primaryKey);
                deleted++;
                cursor.continue();
              }
            };
          } catch {
            // fallback
          }
        }
      };

      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve(newItem);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    } catch (err) {
      reject(err);
    }
  });
}

export async function getSrtQueue(): Promise<StoredSrtItem[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(SRT_STORE)) {
      return [];
    }
    return await new Promise<StoredSrtItem[]>((resolve, reject) => {
      try {
        const tx = db.transaction(SRT_STORE, "readonly");
        const store = tx.objectStore(SRT_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const items: StoredSrtItem[] = req.result || [];
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(items.slice(0, MAX_SRT_LIMIT));
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn("Failed to load IndexedDB SRT queue:", e);
    return [];
  }
}

export async function deleteSrtFromQueue(id: string): Promise<void> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(SRT_STORE)) return;
  return await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(SRT_STORE, "readwrite");
      const store = tx.objectStore(SRT_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function clearSrtQueue(): Promise<void> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(SRT_STORE)) return;
  return await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(SRT_STORE, "readwrite");
      const store = tx.objectStore(SRT_STORE);
      store.clear();
      tx.oncomplete = () => {
        notifyVaultUpdate();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}
