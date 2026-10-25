"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FolderArchive,
  FileAudio,
  FileText,
  Play,
  Pause,
  Trash2,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  StoredAudioItem,
  StoredSrtItem,
  getAudioQueue,
  getSrtQueue,
  deleteAudioFromQueue,
  deleteSrtFromQueue,
  clearAudioQueue,
  clearSrtQueue,
  MAX_AUDIO_LIMIT,
  MAX_SRT_LIMIT,
} from "@/lib/audio-storage";
import { numberedTitle, useFeatureTitles } from "@/lib/feature-titles";

interface LeftSidebarVaultProps {
  onLoadAudioToTab?: (item: StoredAudioItem, targetTab: string) => void;
  onLoadSrtToTab?: (item: StoredSrtItem, targetTab: string) => void;
  currentActiveTab?: string;
}

// Raw sourceTab ids ko human-readable naam (kaunsi cheez kahan se aayi)
const SOURCE_LABELS: Record<string, string> = {
  studio: "🎙️ Studio",
  merger: "🔗 Merger",
  cleaner: "🧹 Cleaner",
  transcribe: "🎧 Audio→SRT",
  "audio-to-srt": "🎧 Audio→SRT",
  "srt-cleaner": "✨ SRT Clean",
};

const STYLE_LABELS: Record<string, string> = {
  auto: "Auto",
  manual: "Manual",
  devanagari: "Pure Hindi",
  roman: "Roman",
  english: "English",
  hinglish: "Hinglish",
  "translate-en": "→EN",
  "translate-hi": "→HI",
  clean: "Cleaned",
  captions: "Captions",
  custom: "Custom",
};

function formatVaultDate(ts: number): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `aaj ${time}`;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
  } catch {
    return "";
  }
}

function formatBytes(n: number): string {
  if (!n || isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function LeftSidebarVault({
  onLoadAudioToTab,
  onLoadSrtToTab,
  currentActiveTab,
}: LeftSidebarVaultProps) {
  const ft = useFeatureTitles();
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [vaultTab, setVaultTab] = useState<"audio" | "srt">("audio");
  const [audioList, setAudioList] = useState<StoredAudioItem[]>([]);
  const [srtList, setSrtList] = useState<StoredSrtItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Mini In-Vault Audio Player
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const vaultAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mobile par drawer default band (screen cover na kare)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsOpen(false);
    }
  }, []);

  // Mobile drawer se tab me bhejo to drawer band karo (desktop rail untouched)
  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setIsOpen(false);
  };

  const refreshVault = async () => {
    setIsRefreshing(true);
    try {
      const [audiosRes, srtsRes] = await Promise.allSettled([
        getAudioQueue(),
        getSrtQueue(),
      ]);
      if (audiosRes.status === "fulfilled") {
        setAudioList(audiosRes.value);
      } else {
        console.warn("Failed to get audio queue:", audiosRes.reason);
      }
      if (srtsRes.status === "fulfilled") {
        setSrtList(srtsRes.value);
      } else {
        console.warn("Failed to get srt queue:", srtsRes.reason);
      }
    } catch (e) {
      console.warn("Failed to refresh asset vault:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshVault();

    const handleStorageUpdate = () => {
      refreshVault();
    };

    window.addEventListener("vault-storage-updated", handleStorageUpdate);
    return () => {
      window.removeEventListener("vault-storage-updated", handleStorageUpdate);
    };
  }, []);

  const handleTogglePlay = (item: StoredAudioItem) => {
    if (playingAudioId === item.id) {
      vaultAudioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (vaultAudioRef.current) {
        vaultAudioRef.current.src = item.dataUrl;
        vaultAudioRef.current.play().then(() => {
          setPlayingAudioId(item.id);
        }).catch((e) => console.warn("Vault play error:", e));
      }
    }
  };

  const handleDeleteAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingAudioId === id) {
      vaultAudioRef.current?.pause();
      setPlayingAudioId(null);
    }
    await deleteAudioFromQueue(id);
    await refreshVault();
  };

  const handleDeleteSrt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSrtFromQueue(id);
    await refreshVault();
  };

  const handleCopySrt = (item: StoredSrtItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.srtContent);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Hidden audio element for mini vault preview */}
      <audio
        ref={vaultAudioRef}
        onEnded={() => setPlayingAudioId(null)}
        className="hidden"
      />

      <aside
        className={`shrink-0 select-none transition-all duration-300 ease-in-out flex-col border-slate-200 bg-white shadow-xs z-50 md:z-20 min-h-0 ${
          isOpen
            ? "flex fixed md:static top-0 md:top-auto left-0 h-dvh md:h-full w-[86vw] max-w-xs md:w-80 border-r"
            : "hidden md:flex md:h-full md:w-12 md:border-r"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          {isOpen ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-2xs">
                <FolderArchive className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                  <span>Asset Vault</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono font-semibold">
                    IndexedDB
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 truncate">Max 20 Files Auto-Saved</p>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsOpen(true)}
              className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow-2xs"
              title="Open Asset Vault"
            >
              <FolderArchive className="w-4 h-4" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {isOpen && (
              <button
                onClick={() => refreshVault()}
                className={`p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer ${
                  isRefreshing ? "animate-spin text-amber-600" : ""
                }`}
                title="Refresh Asset Vault"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title={isOpen ? "Collapse Vault" : "Expand Vault"}
            >
              {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Vault Tabs: 🎵 Audios vs 📝 SRTs */}
            <div className="grid grid-cols-2 p-2 gap-1.5 border-b border-slate-100 bg-slate-50/50 text-xs font-bold">
              <button
                onClick={() => setVaultTab("audio")}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  vaultTab === "audio"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileAudio className="w-3.5 h-3.5 text-amber-600" />
                <span>Audios</span>
                <span className="text-[10px] font-mono px-1.5 rounded-full bg-slate-100 text-slate-600">
                  {audioList.length}/{MAX_AUDIO_LIMIT}
                </span>
              </button>

              <button
                onClick={() => setVaultTab("srt")}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  vaultTab === "srt"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>SRTs</span>
                <span className="text-[10px] font-mono px-1.5 rounded-full bg-slate-100 text-slate-600">
                  {srtList.length}/{MAX_SRT_LIMIT}
                </span>
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2 overscroll-contain">
              {vaultTab === "audio" ? (
                /* ─── AUDIO ITEMS ─── */
                audioList.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-400 space-y-2">
                    <FileAudio className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                    <p className="font-semibold text-slate-600">No Audios Saved Yet</p>
                    <p className="text-[11px] text-slate-400">
                      Generated voiceovers and cleaned audios will automatically appear here.
                    </p>
                  </div>
                ) : (
                  audioList.map((item, idx) => {
                    const isPlaying = playingAudioId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border text-xs transition-all flex flex-col gap-2 ${
                          isPlaying
                            ? "bg-amber-50/70 border-amber-400 shadow-2xs ring-1 ring-amber-400"
                            : "bg-white hover:bg-slate-50 border-slate-200"
                        }`}
                      >
                        {/* Title & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 truncate text-[11.5px]" title={item.name}>
                              🎧 {item.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-mono font-semibold text-slate-700">
                                {formatSeconds(item.durationSeconds)}
                              </span>
                              <span>&bull;</span>
                              <span>{formatBytes(item.sizeBytes)}</span>
                              <span>&bull;</span>
                              <span className="px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                {SOURCE_LABELS[item.sourceTab] || item.sourceTab}
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                              Audio file • {formatVaultDate(item.createdAt)}
                            </div>
                          </div>

                          {/* Play/Pause Button */}
                          <button
                            onClick={() => handleTogglePlay(item)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 ${
                              isPlaying
                                ? "bg-amber-500 text-slate-950 font-bold"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                            title={isPlaying ? "Pause" : "Play Preview"}
                          >
                            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 ml-0.5 fill-current" />}
                          </button>
                        </div>

                        {/* Actions: Load in Tabs / Download / Delete */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1">
                            {onLoadAudioToTab && (
                              <>
                                <button
                                  onClick={() => { onLoadAudioToTab(item, "cleaner"); closeOnMobile(); }}
                                  className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold cursor-pointer border border-amber-200"
                                  title={`Send to ${ft.cleaner}`}
                                >
                                  ➔ Cleaner
                                </button>
                                <button
                                  onClick={() => { onLoadAudioToTab(item, "transcribe"); closeOnMobile(); }}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                                  title={`Send to ${ft.transcribe}`}
                                >
                                  ➔ SRT
                                </button>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <a
                              href={item.dataUrl}
                              download={`${item.name}.${item.format || "mp3"}`}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Download audio"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              onClick={(e) => handleDeleteAudio(item.id, e)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete from Vault"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* ─── SRT SUBTITLE ITEMS ─── */
                srtList.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                    <p className="font-semibold text-slate-600">No Subtitles Saved Yet</p>
                    <p className="text-[11px] text-slate-400">
                      Step 4 (Audio to SRT) me subtitle banayein, yahan automatically save ho jayenge.
                    </p>
                  </div>
                ) : (
                  srtList.map((item) => {
                    const isCopied = copiedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs transition-all flex flex-col gap-2"
                      >
                        {/* Title & Cues */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 truncate text-[11.5px]" title={item.name}>
                              📝 {item.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {item.cuesCount} Cues
                              </span>
                              {item.scriptStyle && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                  {STYLE_LABELS[item.scriptStyle] || item.scriptStyle}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                {SOURCE_LABELS[item.sourceTab] || item.sourceTab}
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                              Subtitle file • {formatVaultDate(item.createdAt)}
                            </div>
                          </div>

                          {/* Copy Button */}
                          <button
                            onClick={(e) => handleCopySrt(item, e)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            title="Copy full SRT content"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1">
                            {onLoadSrtToTab && (
                              <>
                                <button
                                  onClick={() => { onLoadSrtToTab(item, "transcribe"); closeOnMobile(); }}
                                  className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold cursor-pointer border border-amber-200"
                                  title="Open in Live Sync Preview"
                                >
                                  ➔ Preview
                                </button>
                                <button
                                  onClick={() => { onLoadSrtToTab(item, "srt-cleaner"); closeOnMobile(); }}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                                  title={`Send to ${numberedTitle(ft, "srt-cleaner")}`}
                                >
                                  ➔ 5. Cleaner
                                </button>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <a
                              href={`data:text/plain;charset=utf-8,${encodeURIComponent(item.srtContent)}`}
                              download={item.filename || `${item.name}.srt`}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Download .SRT file"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              onClick={(e) => handleDeleteSrt(item.id, e)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete subtitle"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Bottom Actions: Clear Queue */}
            {(audioList.length > 0 || srtList.length > 0) && (
              <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[10px] text-slate-500">
                <span>FIFO Max 20 Auto-Prune</span>
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear all stored files from the Asset Vault?")) {
                      if (vaultTab === "audio") await clearAudioQueue();
                      else await clearSrtQueue();
                      await refreshVault();
                    }
                  }}
                  className="text-rose-600 hover:underline font-semibold cursor-pointer"
                >
                  Clear {vaultTab === "audio" ? "Audios" : "SRTs"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Collapsed strip icons */
          <div className="flex-1 py-4 flex flex-col items-center gap-4 text-slate-400">
            <button
              onClick={() => { setIsOpen(true); setVaultTab("audio"); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer relative"
              title={`Audios (${audioList.length}/20)`}
            >
              <FileAudio className="w-4 h-4 text-amber-600" />
              {audioList.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                  {audioList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setIsOpen(true); setVaultTab("srt"); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer relative"
              title={`SRTs (${srtList.length}/20)`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              {srtList.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                  {srtList.length}
                </span>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Mobile: backdrop + floating vault button */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/30 cursor-pointer"
          title="Open Asset Vault"
        >
          <FolderArchive className="w-4 h-4" />
          <span>Vault</span>
          {(audioList.length > 0 || srtList.length > 0) && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-slate-950 text-amber-400 text-[10px] font-bold flex items-center justify-center">
              {audioList.length + srtList.length}
            </span>
          )}
        </button>
      )}
    </>
  );
}
