// ─────────────────────────────────────────────────────────────
// feature-titles.ts
// User-renamable feature (tab) titles — Header tabs + "Send to…" buttons
// sab yahin se aate hain. localStorage persisted, useSyncExternalStore
// se bina prop-drilling har component me live sync.
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";

export type FeatureTabId = "studio" | "merger" | "cleaner" | "transcribe" | "srt-cleaner";

export const FEATURE_ORDER: FeatureTabId[] = [
  "studio",
  "merger",
  "cleaner",
  "transcribe",
  "srt-cleaner",
];

/** Pipeline order number (header + numbered buttons me prefix) */
export const FEATURE_NUMBER: Record<FeatureTabId, number> = {
  studio: 1,
  merger: 2,
  cleaner: 3,
  transcribe: 4,
  "srt-cleaner": 5,
};

export const DEFAULT_FEATURE_TITLES: Record<FeatureTabId, string> = {
  studio: "Voiceover Studio",
  merger: "Audio Merger",
  cleaner: "Audio Cleaner",
  transcribe: "Audio to SRT",
  "srt-cleaner": "SRT Cleaner",
};

const LS_KEY = "voicescribe.featureTitles.v1";
const MAX_LEN = 30;

type TitleMap = Record<FeatureTabId, string>;

function load(): TitleMap {
  const fresh = { ...DEFAULT_FEATURE_TITLES };
  try {
    if (typeof window === "undefined") return fresh;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    for (const id of FEATURE_ORDER) {
      const v = parsed?.[id];
      if (typeof v === "string" && v.trim()) fresh[id] = v.trim().slice(0, MAX_LEN);
    }
  } catch {
    /* corrupt draft ignore */
  }
  return fresh;
}

let cache: TitleMap | null = null;
const listeners = new Set<() => void>();

function read(): TitleMap {
  if (!cache) cache = load();
  return cache;
}

function persist() {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* quota ignore */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Live titles — kahin bhi rename ho, sab subscribers re-render. */
export function useFeatureTitles(): TitleMap {
  return useSyncExternalStore(subscribe, read, read);
}

/** Non-hook read (event handlers ke liye) */
export function getFeatureTitles(): TitleMap {
  return { ...read() };
}

export function setFeatureTitle(id: FeatureTabId, label: string) {
  const clean = label.trim().slice(0, MAX_LEN);
  cache = { ...read(), [id]: clean || DEFAULT_FEATURE_TITLES[id] };
  persist();
  emit();
}

export function resetFeatureTitles() {
  cache = { ...DEFAULT_FEATURE_TITLES };
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/** "5. SRT Cleaner" jaisa numbered label */
export function numberedTitle(titles: TitleMap, id: FeatureTabId): string {
  return `${FEATURE_NUMBER[id]}. ${titles[id] || DEFAULT_FEATURE_TITLES[id]}`;
}

export const FEATURE_TITLE_MAX_LEN = MAX_LEN;
