// Client-side IndexedDB Asset Vault (Max 20 Audio Items & Max 20 SRT Items FIFO)
// Ensures audio and subtitle files persist across page reloads and never overflow browser storage.

export interface StoredAudioItem {
  id: string;
  name: string;
  sourceTab: "studio" | "merger" | "cleaner" | "transcribe";
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
const DB_VERSION = 1;
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

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const aStore = db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
        aStore.createIndex("createdAt", "createdAt", { unique: false });
        aStore.createIndex("sourceTab", "sourceTab", { unique: false });
      }
      if (!db.objectStoreNames.contains(SRT_STORE)) {
        const sStore = db.createObjectStore(SRT_STORE, { keyPath: "id" });
        sStore.createIndex("createdAt", "createdAt", { unique: false });
        sStore.createIndex("sourceTab", "sourceTab", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
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

  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    const store = tx.objectStore(AUDIO_STORE);

    store.put(newItem);

    const index = store.index("createdAt");
    const getAllReq = index.getAll();

    getAllReq.onsuccess = () => {
      const allItems: StoredAudioItem[] = getAllReq.result || [];
      if (allItems.length > MAX_AUDIO_LIMIT) {
        allItems.sort((a, b) => a.createdAt - b.createdAt);
        const excessCount = allItems.length - MAX_AUDIO_LIMIT;
        for (let i = 0; i < excessCount; i++) {
          store.delete(allItems[i].id);
        }
      }
    };

    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve(newItem);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioQueue(): Promise<StoredAudioItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: StoredAudioItem[] = req.result || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items.slice(0, MAX_AUDIO_LIMIT));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Failed to load IndexedDB audio queue:", e);
    return [];
  }
}

export async function getLatestAudioByTab(
  tab: "studio" | "merger" | "cleaner" | "transcribe"
): Promise<StoredAudioItem | null> {
  const all = await getAudioQueue();
  const match = all.find((item) => item.sourceTab === tab);
  return match || null;
}

export async function deleteAudioFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    const store = tx.objectStore(AUDIO_STORE);
    store.delete(id);
    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAudioQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    const store = tx.objectStore(AUDIO_STORE);
    store.clear();
    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
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

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SRT_STORE, "readwrite");
    const store = tx.objectStore(SRT_STORE);

    store.put(newItem);

    const index = store.index("createdAt");
    const getAllReq = index.getAll();

    getAllReq.onsuccess = () => {
      const allItems: StoredSrtItem[] = getAllReq.result || [];
      if (allItems.length > MAX_SRT_LIMIT) {
        allItems.sort((a, b) => a.createdAt - b.createdAt);
        const excessCount = allItems.length - MAX_SRT_LIMIT;
        for (let i = 0; i < excessCount; i++) {
          store.delete(allItems[i].id);
        }
      }
    };

    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve(newItem);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSrtQueue(): Promise<StoredSrtItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SRT_STORE, "readonly");
      const store = tx.objectStore(SRT_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: StoredSrtItem[] = req.result || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items.slice(0, MAX_SRT_LIMIT));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Failed to load IndexedDB SRT queue:", e);
    return [];
  }
}

export async function deleteSrtFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SRT_STORE, "readwrite");
    const store = tx.objectStore(SRT_STORE);
    store.delete(id);
    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSrtQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SRT_STORE, "readwrite");
    const store = tx.objectStore(SRT_STORE);
    store.clear();
    tx.oncomplete = () => {
      notifyVaultUpdate();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
