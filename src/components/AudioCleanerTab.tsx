"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileAudio,
  Sparkles,
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Volume2,
  FileText,
  Zap,
  Mic,
  Film,
  Wand2,
  Broom,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { dataUrlToFile } from "@/lib/pipeline-store";
import { numberedTitle, useFeatureTitles } from "@/lib/feature-titles";
import { saveAudioToQueue, getLatestAudioByTab } from "@/lib/audio-storage";
import StudioAudioPlayer from "@/components/StudioAudioPlayer";

export interface AudioCleanerPreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  bassBoost: number;
  midCut: number;
  presenceBoost: number;
  airBoost: number;
  compression: "none" | "mild" | "heavy";
  deesser: boolean;
  denoise: "none" | "mild" | "aggressive";
  highpass: boolean;
  dynaudnorm: boolean;
  loudnorm: "youtube_14" | "podcast_16" | "none";
  silenceTrim: "none" | "moderate" | "fast";
  resample48k: boolean;
}

export const CLEANER_PRESETS: AudioCleanerPreset[] = [
  {
    id: "reels_fast",
    name: "⚡ Reels & Shorts Viral Punch",
    tagline: "Fast Pacing • High Retention • BGM Cut-Through",
    badge: "Viral Hero",
    description: "High-energy voice that cuts through loud BGM and SFX on phone speakers. Gated silence removal cuts all pauses >180ms down to 80ms with punchy VCA broadcast compression.",
    bassBoost: 1.5,
    midCut: -3.5,
    presenceBoost: 5.0,
    airBoost: 3.0,
    compression: "heavy",
    deesser: true,
    denoise: "none",
    highpass: true,
    dynaudnorm: false,
    loudnorm: "youtube_14",
    silenceTrim: "fast",
    resample48k: true,
  },
  {
    id: "podcast_warm",
    name: "🎙️ Studio Podcast Host",
    tagline: "Shure SM7B Rich Radio Warmth",
    badge: "Deep Warmth",
    description: "Rich proximity chest warmth (+4.5dB @ 130Hz) and mud scoop. Smooth optical leveling with natural pauses 100% preserved. Sits in front of subtle acoustic BGM.",
    bassBoost: 4.5,
    midCut: -3.0,
    presenceBoost: 3.0,
    airBoost: 1.5,
    compression: "mild",
    deesser: true,
    denoise: "none",
    highpass: true,
    dynaudnorm: false,
    loudnorm: "podcast_16",
    silenceTrim: "none",
    resample48k: true,
  },
  {
    id: "documentary",
    name: "🎬 Cinematic Documentary",
    tagline: "NatGeo / Storytelling Realism",
    badge: "Cinema Master",
    description: "Open, majestic cinematic voice. Sub-70Hz rumble cut leaves room for orchestral BGM and sub-impact SFX. Silky 11kHz sheen with natural dramatic pauses.",
    bassBoost: 2.5,
    midCut: -2.0,
    presenceBoost: 2.5,
    airBoost: 4.0,
    compression: "none",
    deesser: true,
    denoise: "none",
    highpass: true,
    dynaudnorm: true,
    loudnorm: "youtube_14",
    silenceTrim: "moderate",
    resample48k: true,
  },
  {
    id: "crystal_clear",
    name: "✨ AI Voice Naturalizer (De-Robotic)",
    tagline: "Organic Tone • Removes AI Harshness",
    badge: "De-Robotics",
    description: "Removes synthetic metallic edge and sibilance from Gemini / Kokoro / ElevenLabs TTS. Infuses organic human chest warmth (+3dB @ 160Hz) for natural delivery.",
    bassBoost: 3.0,
    midCut: -2.5,
    presenceBoost: 0.5,
    airBoost: 0.5,
    compression: "mild",
    deesser: true,
    denoise: "none",
    highpass: true,
    dynaudnorm: false,
    loudnorm: "youtube_14",
    silenceTrim: "moderate",
    resample48k: true,
  },
  {
    id: "raw_mic",
    name: "🧹 Phone Mic & Noisy Room Restorer",
    tagline: "Spectral Denoiser + Speech Clarity",
    badge: "Room Denoiser",
    description: "95Hz rumble cut + FFT background hiss remover + downward room gate. Turns phone and unpadded room recordings into clear, usable audio that won't buzz under BGM.",
    bassBoost: 1.0,
    midCut: -3.0,
    presenceBoost: 3.5,
    airBoost: 1.5,
    compression: "mild",
    deesser: true,
    denoise: "mild",
    highpass: true,
    dynaudnorm: false,
    loudnorm: "youtube_14",
    silenceTrim: "moderate",
    resample48k: true,
  },
  {
    id: "normal_silence",
    name: "⚡ Normal Audio (Fast Silence Cut)",
    tagline: "Pure Voice • Smart Gate Silence Cut",
    badge: "Pure Pacing",
    description: "100% original voice tone preserved with zero EQ coloration. Downward gate + rapid silence cutter removes all dead gaps (>180ms to 80ms) for punchy retention.",
    bassBoost: 0,
    midCut: 0,
    presenceBoost: 0,
    airBoost: 0,
    compression: "none",
    deesser: false,
    denoise: "none",
    highpass: false,
    dynaudnorm: false,
    loudnorm: "none",
    silenceTrim: "fast",
    resample48k: true,
  },
  {
    id: "normal_raw",
    name: "🎵 100% Raw Audio (Pass-Through)",
    tagline: "Untouched Original Audio",
    badge: "Zero Filters",
    description: "Zero processing. Keeps the original file completely untouched as-is without EQ, compression, or silence cuts.",
    bassBoost: 0,
    midCut: 0,
    presenceBoost: 0,
    airBoost: 0,
    compression: "none",
    deesser: false,
    denoise: "none",
    highpass: false,
    dynaudnorm: false,
    loudnorm: "none",
    silenceTrim: "none",
    resample48k: true,
  },
];

interface AudioCleanerTabProps {
  initialFile?: File | null;
  initialSourceLabel?: string | null;
  onSendToTranscribe?: (file: File) => void;
  onOpenHistory?: () => void;
}

export default function AudioCleanerTab({
  initialFile,
  initialSourceLabel,
  onSendToTranscribe,
  onOpenHistory,
}: AudioCleanerTabProps) {
  const ft = useFeatureTitles();
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);

  // Active Preset ID (Default: Reels & Shorts Viral Punch)
  const [activePresetId, setActivePresetId] = useState<string>("reels_fast");

  // DSP Parameters (Default: Reels Viral Punch)
  const [bassBoost, setBassBoost] = useState<number>(1.5);
  const [midCut, setMidCut] = useState<number>(-3.5);
  const [presenceBoost, setPresenceBoost] = useState<number>(5.0);
  const [airBoost, setAirBoost] = useState<number>(3.0);
  const [compression, setCompression] = useState<"none" | "mild" | "heavy">("heavy");
  const [deesser, setDeesser] = useState<boolean>(true);
  const [denoise, setDenoise] = useState<"none" | "mild" | "aggressive">("none");
  const [highpass, setHighpass] = useState<boolean>(true);
  const [dynaudnorm, setDynaudnorm] = useState<boolean>(false);
  const [loudnorm, setLoudnorm] = useState<"youtube_14" | "podcast_16" | "none">("youtube_14");
  const [silenceTrim, setSilenceTrim] = useState<"none" | "moderate" | "fast">("fast");
  const [resample48k, setResample48k] = useState<boolean>(true);

  // Output settings
  const [outputFormat, setOutputFormat] = useState<string>("mp3");
  const [bitrate, setBitrate] = useState<number>(320);

  // UI state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanedResult, setCleanedResult] = useState<{
    audioDataUrl: string;
    durationSeconds: number;
    originalSizeBytes: number;
    cleanedSizeBytes: number;
    filename: string;
    filtersApplied: string[];
    format?: string;
    presetUsed?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore latest cleaned audio from IndexedDB on page load/refresh
  useEffect(() => {
    async function restoreCachedAudio() {
      if (!initialFile && !cleanedResult) {
        const cached = await getLatestAudioByTab("cleaner");
        if (cached) {
          setCleanedResult({
            audioDataUrl: cached.dataUrl,
            durationSeconds: cached.durationSeconds,
            originalSizeBytes: cached.sizeBytes,
            cleanedSizeBytes: cached.sizeBytes,
            filename: `${cached.name}.${cached.format}`,
            format: cached.format,
            filtersApplied: ["Restored from local session storage (IndexedDB)"],
            presetUsed: cached.presetUsed,
          });
        }
      }
    }
    restoreCachedAudio();
  }, [initialFile]);

  // Apply initial preset values
  const applyPreset = (preset: AudioCleanerPreset) => {
    setActivePresetId(preset.id);
    setBassBoost(preset.bassBoost);
    setMidCut(preset.midCut);
    setPresenceBoost(preset.presenceBoost);
    setAirBoost(preset.airBoost);
    setCompression(preset.compression);
    setDeesser(preset.deesser);
    setDenoise(preset.denoise);
    setHighpass(preset.highpass);
    setDynaudnorm(preset.dynaudnorm);
    setLoudnorm(preset.loudnorm);
    setSilenceTrim(preset.silenceTrim);
    setResample48k(preset.resample48k);
  };

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
    }
  }, [initialFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const markCustom = () => {
    if (activePresetId !== "custom") {
      setActivePresetId("custom");
    }
  };

  const handleEnhanceAudio = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("preset", activePresetId);
      formData.append("bassBoost", bassBoost.toString());
      formData.append("midCut", midCut.toString());
      formData.append("presenceBoost", presenceBoost.toString());
      formData.append("airBoost", airBoost.toString());
      formData.append("compression", compression);
      formData.append("deesser", deesser.toString());
      formData.append("denoise", denoise);
      formData.append("highpass", highpass.toString());
      formData.append("dynaudnorm", dynaudnorm.toString());
      formData.append("loudnorm", loudnorm);
      formData.append("silenceTrim", silenceTrim);
      formData.append("resample48k", resample48k.toString());
      formData.append("outputFormat", outputFormat);
      formData.append("bitrate", bitrate.toString());

      const res = await fetch("/api/clean-audio", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to enhance audio");
      }

      setCleanedResult(data);

      // Save to IndexedDB Queue (Max 20 Audio Items FIFO)
      try {
        await saveAudioToQueue({
          name: data.filename.replace(/\.[^/.]+$/, ""),
          sourceTab: "cleaner",
          durationSeconds: data.durationSeconds,
          sizeBytes: data.cleanedSizeBytes,
          dataUrl: data.audioDataUrl,
          format: data.format || outputFormat,
          presetUsed: activePresetId,
        });
      } catch (storageErr) {
        console.warn("Failed to persist in IndexedDB:", storageErr);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
            <h2 className="text-base font-bold text-slate-900">Audio Cleaner &amp; Two-Pass Studio Enhancer</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              Two-Pass Linear EBU R128
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Zero-pumping two-pass loudness normalization, analog vocal warmth, crisp clarity, and safe silence trimming.
            Audios are automatically saved to IndexedDB (up to 20 items) so they persist across page refreshes.
          </p>
        </div>

        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-300 transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <History className="w-3.5 h-3.5 text-amber-600" />
            <span>Audio History (Stack)</span>
          </button>
        )}
      </div>

      {/* Connected Pipeline Notification */}
      {selectedFile && initialSourceLabel && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">
              🔗 Connected Pipeline: Audio auto-loaded from {initialSourceLabel} (&ldquo;{selectedFile.name}&rdquo;)!
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Ready to enhance &amp; clean</span>
        </div>
      )}

      {/* ─── 1-Click Studio Sound Presets ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              1-Click Studio Sound Profiles
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            {activePresetId === "custom"
              ? "Customized Settings Active"
              : `Active: ${CLEANER_PRESETS.find((p) => p.id === activePresetId)?.name}`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CLEANER_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-amber-50/70 border-amber-500 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500"
                    : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {preset.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isSelected
                          ? "bg-amber-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {preset.tagline}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-500">
                  <span>Pacing: {preset.silenceTrim === "fast" ? "⚡ Fast (Reels)" : preset.silenceTrim === "moderate" ? "Tight" : "Natural"}</span>
                  <span className={isSelected ? "text-amber-700 font-bold" : "text-slate-400"}>
                    {isSelected ? "Active ✓" : "Select"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Options */}
        <div className="lg:col-span-6 space-y-4">
          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl bg-slate-50/70 hover:bg-amber-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-colors shadow-2xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
              <FileAudio className="w-5 h-5" />
            </div>
            {selectedFile ? (
              <div>
                <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB &bull; Click to replace file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Upload audio file or use from Studio
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">MP3, WAV, M4A, AAC (Local FFmpeg)</p>
              </div>
            )}
          </div>

          {/* Quick Active Preset Summary */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">Current DSP Signal Chain</span>
              </div>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                <span>{showAdvancedSettings ? "Hide Custom Sliders" : "Customize Sliders & Filters"}</span>
                {showAdvancedSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Summary Tags */}
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                EQ: {bassBoost > 0 ? `+${bassBoost}dB Warmth` : "Flat"} / {presenceBoost > 0 ? `+${presenceBoost}dB Clarity` : "Flat"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Leveling: {dynaudnorm ? "Dynamic" : compression !== "none" ? compression.toUpperCase() : "Linear"}
              </span>
              <span className={`px-2 py-0.5 rounded-md font-medium border ${silenceTrim === "fast" ? "bg-amber-100 text-amber-900 border-amber-300 font-bold" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                Silence Trim: {silenceTrim === "fast" ? "⚡ Fast (Reels)" : silenceTrim === "moderate" ? "Tight (>0.5s)" : "Off (Natural)"}
              </span>
              {deesser && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  ✓ De-Esser Active
                </span>
              )}
              {loudnorm !== "none" && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  Two-Pass {loudnorm === "podcast_16" ? "-16" : "-14"} LUFS
                </span>
              )}
            </div>

            {/* ─── Primary Controls: Silence Cut & Independent Optional Compression ─── */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              {/* 1. Silence Cut Control */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Silence Trimming (Fast Pacing)</span>
                    <span className="text-[10px] text-slate-500">Lambi khamoshi (pauses) ko cut karke video ko fast-paced banayein.</span>
                  </div>
                </div>
                <select
                  value={silenceTrim}
                  onChange={(e) => {
                    setSilenceTrim(e.target.value as any);
                    markCustom();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="fast">⚡ Fast (Reels/Shorts)</option>
                  <option value="moderate">Natural Tight</option>
                  <option value="none">Off (No Silence Cut)</option>
                </select>
              </div>

              {/* 2. Independent Optional Audio Compression Toggle */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900">Audio Compression &amp; Leveling</span>
                      <span className="text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded ml-2 font-semibold">
                        Optional • Not Mandatory
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compression !== "none"}
                      onChange={(e) => {
                        setCompression(e.target.checked ? "mild" : "none");
                        markCustom();
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {compression === "none"
                    ? "Off: Keeps the dynamic volume range untouched (100% natural voice)."
                    : "On: Balances soft and loud passages (smooth vocal leveling)."}
                </p>
                {compression !== "none" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => { setCompression("mild"); markCustom(); }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                        compression === "mild" ? "bg-amber-500 text-slate-950" : "bg-white text-slate-600 border border-slate-300"
                      }`}
                    >
                      Smooth Leveling
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCompression("heavy"); markCustom(); }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                        compression === "heavy" ? "bg-amber-500 text-slate-950" : "bg-white text-slate-600 border border-slate-300"
                      }`}
                    >
                      Punchy Broadcast
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Expandable Custom DSP Sliders & Toggles ─── */}
            {showAdvancedSettings && (
              <div className="pt-3 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                {/* 1. Vocal EQ Sliders */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-800 block">
                    1. Studio 4-Band Vocal EQ
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Chest Warmth (140Hz)</span>
                        <span className="font-bold text-amber-700">{bassBoost > 0 ? "+" : ""}{bassBoost} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-4"
                        max="8"
                        step="0.5"
                        value={bassBoost}
                        onChange={(e) => {
                          setBassBoost(parseFloat(e.target.value));
                          markCustom();
                        }}
                        className="w-full accent-amber-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>De-Box Mud Scoop (380Hz)</span>
                        <span className="font-bold text-amber-700">{midCut > 0 ? "+" : ""}{midCut} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-6"
                        max="2"
                        step="0.5"
                        value={midCut}
                        onChange={(e) => {
                          setMidCut(parseFloat(e.target.value));
                          markCustom();
                        }}
                        className="w-full accent-amber-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Hero Presence Bite (3.3kHz)</span>
                        <span className="font-bold text-amber-700">{presenceBoost > 0 ? "+" : ""}{presenceBoost} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-4"
                        max="8"
                        step="0.5"
                        value={presenceBoost}
                        onChange={(e) => {
                          setPresenceBoost(parseFloat(e.target.value));
                          markCustom();
                        }}
                        className="w-full accent-amber-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Studio Air &amp; Sheen (11kHz)</span>
                        <span className="font-bold text-amber-700">{airBoost > 0 ? "+" : ""}{airBoost} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-4"
                        max="7"
                        step="0.5"
                        value={airBoost}
                        onChange={(e) => {
                          setAirBoost(parseFloat(e.target.value));
                          markCustom();
                        }}
                        className="w-full accent-amber-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Dynamics, Compressor & De-Esser */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-800 block">
                    2. Dynamics, Leveling &amp; De-Esser
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Leveling Mode</label>
                      <select
                        value={dynaudnorm ? "dynamic" : compression}
                        onChange={(e) => {
                          if (e.target.value === "dynamic") {
                            setDynaudnorm(true);
                            setCompression("none");
                          } else {
                            setDynaudnorm(false);
                            setCompression(e.target.value as any);
                          }
                          markCustom();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none"
                      >
                        <option value="none">Linear (No dynamic squash)</option>
                        <option value="mild">Mild (Optical vocal leveling)</option>
                        <option value="heavy">Punchy (Broadcast compression)</option>
                        <option value="dynamic">Dynamic Audio Leveler</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">De-Esser (Sibilance)</label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deesser}
                          onChange={(e) => {
                            setDeesser(e.target.checked);
                            markCustom();
                          }}
                          className="accent-amber-600"
                        />
                        <span className="text-slate-700">Softens harsh &ldquo;S&rdquo; &amp; &ldquo;Sh&rdquo;</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Pacing & Silence Trimming */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-800 block">
                    3. Pacing &amp; Silence Trimmer (Leaves 150–250ms breathing)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Silence Trimming Mode</label>
                      <select
                        value={silenceTrim}
                        onChange={(e) => {
                          setSilenceTrim(e.target.value as any);
                          markCustom();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none"
                      >
                        <option value="none">Off (Keep All Natural Pauses)</option>
                        <option value="moderate">Moderate (Cut pauses &gt;0.5s down to 250ms)</option>
                        <option value="fast">⚡ Fast (Reels/Shorts: Cut &gt;0.35s down to 150ms)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Two-Pass Loudness Target</label>
                      <select
                        value={loudnorm}
                        onChange={(e) => {
                          setLoudnorm(e.target.value as any);
                          markCustom();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none"
                      >
                        <option value="youtube_14">YouTube / Reels Standard (-14 LUFS)</option>
                        <option value="podcast_16">Podcast Standard (-16 LUFS)</option>
                        <option value="none">Off (Original Level)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Real Mic Cleaning */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-800 block">
                    4. Mic Noise &amp; Broadcast Sinc Resampling
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Background Denoise (Real Mics)</label>
                      <select
                        value={denoise}
                        onChange={(e) => {
                          setDenoise(e.target.value as any);
                          markCustom();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none"
                      >
                        <option value="none">None (Clean AI Voice / No Denoise)</option>
                        <option value="mild">Mild (Subtle Hiss Reduction)</option>
                        <option value="aggressive">Aggressive (Heavy Room Noise)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 justify-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={highpass}
                          onChange={(e) => {
                            setHighpass(e.target.checked);
                            markCustom();
                          }}
                          className="accent-amber-600"
                        />
                        <span className="text-slate-700">80Hz High-Pass (Mic Rumble Cut)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resample48k}
                          onChange={(e) => {
                            setResample48k(e.target.checked);
                            markCustom();
                          }}
                          className="accent-amber-600"
                        />
                        <span className="text-slate-700">Broadcast 48,000 Hz Resampling</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Format Bar */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none"
                >
                  <option value="mp3">Mastered MP3 (Lightweight)</option>
                  <option value="wav">Lossless 48kHz WAV (Studio Master)</option>
                </select>
              </div>

              {outputFormat === "mp3" && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">MP3 Bitrate</label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none"
                  >
                    <option value={320}>320 kbps (Maximum Quality)</option>
                    <option value={256}>256 kbps (High Quality)</option>
                    <option value={192}>192 kbps (Standard Quality)</option>
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleEnhanceAudio}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-sm shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Two-Pass Studio Engine...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Enhance &amp; Master Audio</span>
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
        </div>

        {/* Right Column: Audio Preview & Handoff */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Mastered Audio Preview
            </span>
            {cleanedResult && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold font-mono">
                Duration: {Math.round(cleanedResult.durationSeconds)}s
              </span>
            )}
          </div>

          {cleanedResult ? (
            <div className="p-5 rounded-2xl bg-white border border-emerald-300 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Audio Mastered (Saved in Stack)</h4>
                    <p className="text-xs text-slate-500">
                      Duration: {Math.round(cleanedResult.durationSeconds)}s &bull; Format: {(cleanedResult.format || outputFormat).toUpperCase()} &bull; Persisted in IndexedDB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSendToTranscribe && (
                    <button
                      onClick={() =>
                        onSendToTranscribe(
                          dataUrlToFile(cleanedResult.audioDataUrl, cleanedResult.filename)
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Send to {numberedTitle(ft, "transcribe")} ➔</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Full Interactive Player with Scrubber, Live Timing, Speed */}
              <StudioAudioPlayer
                src={cleanedResult.audioDataUrl}
                title={cleanedResult.filename}
                downloadFilename={cleanedResult.filename}
              />

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Studio Processing Applied:</span>
                <div className="flex flex-wrap gap-1.5">
                  {cleanedResult.filtersApplied.map((f, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                    >
                      &check; {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center text-slate-400 h-72">
              <Sparkles className="w-10 h-10 mb-2 stroke-[1.2] text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No enhanced audio yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                Select a profile (like ⚡ Reels &amp; Shorts Viral Rush) and click &ldquo;Enhance &amp; Master Audio&rdquo; to process.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
