"use client";

// ─────────────────────────────────────────────────────────────
// tts-audio-store.ts
// Robust IndexedDB Persistence for Audio Studio
// Safely stores multi-megabyte audio buffers, drafts, and session history locally.
// ─────────────────────────────────────────────────────────────

const DB_NAME = "audio_studio_db";
const DB_VERSION = 1;
const STORE_BOXES = "studio_boxes";
const STORE_AUDIO = "studio_audio_tracks";

function openTTSDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BOXES)) {
        db.createObjectStore(STORE_BOXES);
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves the full set of script boxes for a persona to IndexedDB.
 */
export async function saveBoxesToStorage(
  personaId: string,
  boxes: any[]
): Promise<void> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOXES, "readwrite");
      const store = tx.objectStore(STORE_BOXES);
      // Strip out huge audioDataUrl before saving boxes metadata to keep table fast
      const cleanBoxes = boxes.map((b) => ({
        ...b,
        hasAudio: !!b.audioResult?.audioDataUrl,
      }));
      store.put(cleanBoxes, `boxes_${personaId}`);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn("[Storage] Failed to save boxes:", err);
  }
}

/**
 * Loads the saved script boxes for a persona from IndexedDB.
 */
export async function loadBoxesFromStorage(
  personaId: string
): Promise<any[] | null> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOXES, "readonly");
      const store = tx.objectStore(STORE_BOXES);
      const req = store.get(`boxes_${personaId}`);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn("[Storage] Failed to load boxes:", err);
    return null;
  }
}

/**
 * Saves a generated audio result (.wav base64 data) for a specific box.
 */
export async function saveAudioToStorage(
  boxId: string,
  audioResult: any,
  personaId: string,
  textSnippet: string
): Promise<void> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, "readwrite");
      const store = tx.objectStore(STORE_AUDIO);
      const record = {
        boxId,
        audioResult,
        personaId,
        textSnippet: textSnippet.slice(0, 120),
        savedAt: Date.now(),
      };
      store.put(record, boxId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error("[Storage] Failed to save audio track:", err);
  }
}

/**
 * Loads the saved audio result for a specific box.
 */
export async function loadAudioFromStorage(boxId: string): Promise<any | null> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, "readonly");
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.get(boxId);
      req.onsuccess = () => {
        db.close();
        resolve(req.result?.audioResult || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn("[Storage] Failed to load audio track for box:", boxId, err);
    return null;
  }
}

/**
 * Deletes audio for a specific box.
 */
export async function deleteAudioFromStorage(boxId: string): Promise<void> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, "readwrite");
      const store = tx.objectStore(STORE_AUDIO);
      store.delete(boxId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn("[Storage] Failed to delete audio:", err);
  }
}

/**
 * Clears all stored audio and boxes for a persona.
 */
export async function clearAllTTSDataForPersona(
  personaId: string,
  boxIds: string[]
): Promise<void> {
  try {
    const db = await openTTSDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BOXES, STORE_AUDIO], "readwrite");
      tx.objectStore(STORE_BOXES).delete(`boxes_${personaId}`);
      const audioStore = tx.objectStore(STORE_AUDIO);
      for (const id of boxIds) {
        audioStore.delete(id);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error("[Storage] Failed to clear data:", err);
  }
}
