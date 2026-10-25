"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Merge,
  FileAudio,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Sparkles,
  FileText,
} from "lucide-react";
import { PipelineVoiceoverPart, dataUrlToFile } from "@/lib/pipeline-store";
import { saveAudioToQueue, getLatestAudioByTab } from "@/lib/audio-storage";
import { generateSmartTitle } from "@/lib/title-generator";
import { numberedTitle, useFeatureTitles } from "@/lib/feature-titles";
import StudioAudioPlayer from "@/components/StudioAudioPlayer";

interface AudioFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface AudioMergerTabProps {
  initialVoiceoverParts?: PipelineVoiceoverPart[];
  onSendToCleaner?: (file: File) => void;
  onSendToTranscribe?: (file: File) => void;
}

export default function AudioMergerTab({
  initialVoiceoverParts = [],
  onSendToCleaner,
  onSendToTranscribe,
}: AudioMergerTabProps) {
  const ft = useFeatureTitles();
  const [fileList, setFileList] = useState<AudioFileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState(320);
  const [normalize, setNormalize] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedResult, setMergedResult] = useState<{
    audioDataUrl: string;
    durationSeconds: number;
    sizeBytes: number;
    filename: string;
    filesMergedCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-populate from Voiceover Studio if parts passed
  useEffect(() => {
    if (initialVoiceoverParts && initialVoiceoverParts.length > 0) {
      const items: AudioFileItem[] = initialVoiceoverParts.map((p) => {
        const file = dataUrlToFile(
          p.dataUrl,
          `part_${p.partNumber}_${p.title.replace(/[^a-zA-Z0-9]/g, "_")}.wav`
        );
        return {
          id: p.id,
          file,
          name: file.name,
          size: file.size,
        };
      });
      setFileList(items);
    }
  }, [initialVoiceoverParts]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems: AudioFileItem[] = Array.from(e.target.files).map((f) => ({
        id: `file_${Date.now()}_${Math.random()}`,
        file: f,
        name: f.name,
        size: f.size,
      }));
      setFileList((prev) => [...prev, ...newItems]);
      setMergedResult(null);
      setError(null);
    }
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fileList.length) return;

    const copy = [...fileList];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setFileList(copy);
  };

  const removeItem = (id: string) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMerge = async () => {
    if (fileList.length < 2) {
      setError("Please add at least 2 audio files to merge.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("filesCount", fileList.length.toString());
      formData.append("outputFormat", outputFormat);
      formData.append("bitrate", bitrate.toString());
      formData.append("normalize", normalize.toString());

      fileList.forEach((item, idx) => {
        formData.append(`file_${idx}`, item.file);
      });

      const res = await fetch("/api/merge-audio", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Merging failed");
      }

      setMergedResult(data);

      try {
        const rawNames = fileList.map((f) => f.name.replace(/\.[^/.]+$/, "")).join(" ");
        const smartName = generateSmartTitle(rawNames, "Merged Audio");
        await saveAudioToQueue({
          name: smartName,
          sourceTab: "merger",
          durationSeconds: data.durationSeconds,
          sizeBytes: data.sizeBytes,
          dataUrl: data.audioDataUrl,
          format: outputFormat,
        });
      } catch (err) {
        console.warn("Failed to save merged audio to IndexedDB:", err);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during merge");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Audio Track Merger</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Seamless Concat
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Merge multiple audio files seamlessly without drift or gaps. Reorder tracks
            and export as lossless WAV or high-bitrate MP3.
          </p>
        </div>
      </div>

      {initialVoiceoverParts && initialVoiceoverParts.length > 0 && fileList.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">
              🔗 Connected Pipeline: {fileList.length} audio parts auto-loaded from Step 1 Voiceover Studio!
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Ready to sequence &amp; merge</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Track List & Reordering */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Tracks to Merge ({fileList.length})
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Add Audio Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.aac"
              onChange={handleAddFiles}
              className="hidden"
            />
          </div>

          {fileList.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-12 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl bg-slate-50/70 hover:bg-amber-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-colors shadow-2xs"
            >
              <FileAudio className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Click to add audio files</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Select multiple files at once</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fileList.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      {index + 1}
                    </span>
                    <span className="truncate font-semibold text-slate-800">{item.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      ({(item.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveItem(index, "down")}
                      disabled={index === fileList.length - 1}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Settings & Output */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>Merge Output Settings</span>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Output Format</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="mp3">Mastered MP3</option>
                <option value="wav">Lossless WAV (PCM)</option>
              </select>
            </div>

            {outputFormat === "mp3" && (
              <div>
                <label className="block text-slate-600 font-medium mb-1">MP3 Bitrate</label>
                <select
                  value={bitrate}
                  onChange={(e) => setBitrate(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value={192}>192 kbps (Standard)</option>
                  <option value={320}>320 kbps (High Quality)</option>
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-700">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                className="accent-amber-600"
              />
              <span className="font-medium">Harmonize Track Loudness (-14 LUFS)</span>
            </label>

            <button
              onClick={handleMerge}
              disabled={isProcessing || fileList.length < 2}
              className="w-full py-2.5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-sm shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Merging with FFmpeg...</span>
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4" />
                  <span>Merge {fileList.length} Tracks</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Merged Result */}
          {mergedResult && (
            <div className="p-5 rounded-2xl bg-white border border-emerald-300 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Merged Audio Ready</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {fileList.length} Tracks Combined
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Duration: <b className="text-slate-800">{Math.round(mergedResult.durationSeconds)}s</b> &bull; Size:{" "}
                      <b className="text-slate-800">{(mergedResult.sizeBytes / 1024 / 1024).toFixed(2)} MB</b>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={mergedResult.audioDataUrl}
                    download={mergedResult.filename}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Merged Audio</span>
                  </a>
                </div>
              </div>

              <StudioAudioPlayer
                src={mergedResult.audioDataUrl}
                title={mergedResult.filename}
                downloadFilename={mergedResult.filename}
              />

              {/* Dedicated Next Step Pipeline Action Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                      NEXT PIPELINE STEP
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Step 3: {numberedTitle(ft, "cleaner")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Clean room noise, trim pause gaps, and master vocal frequencies for background music (BGM) coexistence.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onSendToCleaner && (
                    <button
                      onClick={() =>
                        onSendToCleaner(
                          dataUrlToFile(mergedResult.audioDataUrl, mergedResult.filename)
                        )
                      }
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Proceed to Step 3: {numberedTitle(ft, "cleaner")} ➔</span>
                    </button>
                  )}

                  {onSendToTranscribe && (
                    <button
                      onClick={() =>
                        onSendToTranscribe(
                          dataUrlToFile(mergedResult.audioDataUrl, mergedResult.filename)
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                      title="Skip Cleaner and jump directly to Subtitles"
                    >
                      <span>Skip to Step 4 ➔</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
