"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  X,
  Trash2,
  Download,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  Merge,
  FileText,
  Clock,
  HardDrive,
} from "lucide-react";
import {
  StoredAudioItem,
  getAudioQueue,
  deleteAudioFromQueue,
  clearAudioQueue,
} from "@/lib/audio-storage";
import StudioAudioPlayer from "@/components/StudioAudioPlayer";
import { useFeatureTitles } from "@/lib/feature-titles";

interface AudioHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForCleaner?: (dataUrl: string, filename: string) => void;
  onSelectForTranscribe?: (dataUrl: string, filename: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function AudioHistoryModal({
  isOpen,
  onClose,
  onSelectForCleaner,
  onSelectForTranscribe,
}: AudioHistoryModalProps) {
  const ft = useFeatureTitles();
  const [items, setItems] = useState<StoredAudioItem[]>([]);
  const [activePlayId, setActivePlayId] = useState<string | null>(null);

  const loadHistory = async () => {
    const list = await getAudioQueue();
    setItems(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    await deleteAudioFromQueue(id);
    await loadHistory();
    if (activePlayId === id) setActivePlayId(null);
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear your local audio history?")) {
      await clearAudioQueue();
      setItems([]);
      setActivePlayId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Local Audio Stack History</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold font-mono">
                  {items.length} / 20 Audios
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                IndexedDB Safe Queue: Purges automatically after 20 audios so browser storage stays clean.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                title="Clear history"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <HardDrive className="w-10 h-10 mx-auto mb-2.5 text-slate-300 stroke-[1.2]" />
              <p className="text-xs font-semibold text-slate-600">No saved audio yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Audio generated in Studio, merged, or enhanced in Audio Cleaner will automatically persist here.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const dateStr = new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition-all space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                          item.sourceTab === "cleaner"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.sourceTab === "merger"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.sourceTab}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate max-w-xs">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>{formatTime(item.durationSeconds)}</span>
                      <span>&bull;</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                      <span>&bull;</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Player Preview */}
                  <StudioAudioPlayer
                    src={item.dataUrl}
                    title={item.name}
                    downloadFilename={`${item.name}.${item.format}`}
                    className="bg-slate-900/95"
                  />

                  {/* Quick Action Handoffs */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      {onSelectForCleaner && (
                        <button
                          onClick={() => {
                            onSelectForCleaner(item.dataUrl, `${item.name}.${item.format}`);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Send to {ft.cleaner}</span>
                        </button>
                      )}

                      {onSelectForTranscribe && (
                        <button
                          onClick={() => {
                            onSelectForTranscribe(item.dataUrl, `${item.name}.${item.format}`);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-600" />
                          <span>Send to {ft.transcribe}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Delete from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
