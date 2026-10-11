/**
 * Pipeline Session Persistence — reload-proof state management.
 * - Text/chhota data (SRT, script, labels, activeTab): localStorage (fast, sync).
 * - Audio Files (Blob): IndexedDB (localStorage me File nahi sama sakta).
 * Page load par dono jodkar wapas File objects banate hain.
 */

export interface PipelineTextSnapshot {
  srt: string | null;
  srtAudioLabel: string | null;
  srtAudioName: string | null;
  srtAudioType: string | null;
  script: string | null;
  scriptLabel: string | null;
  audioSource: string | null;
  audioName: string | null;
  audioType: string | null;
  activeTab: string | null;
  updatedAt: number;
}

export interface PipelineSession extends PipelineTextSnapshot {
  mainAudioFile: File | null;
  srtAudioFile: File | null;
}

const LS_KEY = "audioStudio.pipeline.v1";
const DB_NAME = "AudioStudioSession";
const DB_VERSION = 1;
const FILE_STORE = "files";
const MAX_BLOB_BYTES = 80 * 1024 * 1024; // 80MB se badi file persist nahi hogi

function openSessionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutFile(key: string, file: File | null): Promise<void> {
  const db = await openSessionDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    const store = tx.objectStore(FILE_STORE);
    if (!file || file.size > MAX_BLOB_BYTES) {
      store.delete(key);
    } else {
      store.put({ key, blob: file, name: file.name, type: file.type });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetFile(key: string): Promise<File | null> {
  try {
    const db = await openSessionDB();
    return new Promise((resolve) => {
      const tx = db.transaction(FILE_STORE, "readonly");
      const req = tx.objectStore(FILE_STORE).get(key);
      req.onsuccess = () => {
        const rec = req.result as { blob?: Blob; name?: string; type?: string } | undefined;
        if (rec?.blob) {
          resolve(new File([rec.blob], rec.name || `${key}.audio`, { type: rec.type || "audio/mpeg" }));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function savePipelineText(snap: Omit<PipelineTextSnapshot, "updatedAt">): void {
  try {
    if (typeof window === "undefined") return;
    const full: PipelineTextSnapshot = { ...snap, updatedAt: Date.now() };
    window.localStorage.setItem(LS_KEY, JSON.stringify(full));
  } catch {
    /* quota full ho to session skip — app nahi tootegi */
  }
}

export async function savePipelineFiles(mainAudio: File | null, srtAudio: File | null): Promise<void> {
  try {
    await Promise.all([idbPutFile("mainAudio", mainAudio), idbPutFile("srtAudio", srtAudio)]);
  } catch {
    /* ignore */
  }
}

function loadPipelineText(): PipelineTextSnapshot | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PipelineTextSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadPipelineSession(): Promise<PipelineSession | null> {
  const text = loadPipelineText();
  if (!text) return null;
  const [mainAudioFile, srtAudioFile] = await Promise.all([
    idbGetFile("mainAudio"),
    idbGetFile("srtAudio"),
  ]);
  return { ...text, mainAudioFile, srtAudioFile };
}
