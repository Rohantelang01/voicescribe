"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Upload,
  FileAudio,
  FileText,
  Copy,
  Check,
  Download,
  AlertCircle,
  Sliders,
  Sparkles,
  RefreshCw,
  Cpu,
  Languages,
  Key,
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  Code,
  Smartphone,
  Monitor,
  CheckCircle2,
  Edit3,
  FolderArchive,
} from "lucide-react";
import { TTSPoolState, getRemainingRequests } from "@/lib/tts-projects";
import { parseSrtCues, cuesToSrt, formatSrtTime, SrtCue } from "@/lib/srt-chunker";
import { splitAudioToChunks, ChunkDecodeError } from "@/lib/audio-chunker";
import { saveAudioToQueue, saveSrtToQueue } from "@/lib/audio-storage";
import { generateSmartTitle } from "@/lib/title-generator";
import { numberedTitle, useFeatureTitles } from "@/lib/feature-titles";

export interface ChunkStatusItem {
  index: number;
  offsetSec: number;
  durationSec: number;
  status: "pending" | "processing" | "done" | "error";
  cuesCount?: number;
}

export interface UploadProgressState {
  stage: "idle" | "uploading" | "slicing" | "processing" | "transcribing" | "merging" | "formatting" | "finalizing" | "done" | "error";
  percent: number;
  loadedMB: number;
  totalMB: number;
  elapsedSec: number;
  totalChunks: number;
  currentChunkIndex: number;
  chunksList: ChunkStatusItem[];
  currentStepIndex?: number;
  stepDetail: string;
  smartTitle?: string;
}

export type ScriptStyleType = "auto" | "manual";

interface ScriptModeOption {
  id: ScriptStyleType;
  label: string;
  badge: string;
  desc: string;
  icon: string;
}

const SCRIPT_MODE_OPTIONS: ScriptModeOption[] = [
  {
    id: "auto",
    label: "Auto Detect",
    badge: "Recommended",
    desc: "Auto-detects the spoken language and transcribes exactly as spoken.",
    icon: "✨",
  },
  {
    id: "manual",
    label: "Manual Select",
    badge: "All Languages",
    desc: "Choose the language manually. The engine transcribes in that language.",
    icon: "🌐",
  },
];

// Whisper-supported languages (subset of 99+ — most used first)
const MANUAL_LANGUAGES = [
  { code: "hi", label: "Hindi — हिंदी" },
  { code: "en", label: "English" },
  { code: "hinglish", label: "Hinglish (Roman) — Namaste doston" },
  { code: "bn", label: "Bengali — বাংলা" },
  { code: "mr", label: "Marathi — मराठी" },
  { code: "te", label: "Telugu — తెలుగు" },
  { code: "ta", label: "Tamil — தமிழ்" },
  { code: "gu", label: "Gujarati — ગુજરાતી" },
  { code: "kn", label: "Kannada — ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam — മലയാളം" },
  { code: "pa", label: "Punjabi — ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu — اردو" },
  { code: "es", label: "Spanish — Español" },
  { code: "fr", label: "French — Français" },
  { code: "de", label: "German — Deutsch" },
  { code: "ar", label: "Arabic — العربية" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ne", label: "Nepali — नेपाली" },
  { code: "sa", label: "Sanskrit — संस्कृतम्" },
  { code: "or", label: "Odia — ଓଡ଼ିଆ" },
  { code: "as", label: "Assamese — অসমীয়া" },
];

type EngineId =
  | "groq-whisper-turbo"
  | "groq-whisper-v3"
  | "gemini-3.5-transcribe"
  | "gemini-3.1-flash-lite"
  | "gemini-3.5-flash-lite"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-flash"
  | "gemini-3.5-flash"
  | "gemini-3-flash"
  | "gemini-3.6-flash"
  | "gemini-3.7-flash"
  | "gemini-3.8-flash"
  | "gemini-1.5-flash";

const ENGINE_LABELS: Record<string, string> = {
  "groq-whisper-turbo": "Groq Whisper Large v3 Turbo",
  "groq-whisper-v3": "Groq Whisper Large v3",
  "gemini-3.5-transcribe": "Google Gemini 3.5 Transcribe (Dedicated STT • Low Quota)",
  "gemini-3.1-flash-lite": "Google Gemini 3.1 Flash Lite (High Quota • Recommended)",
  "gemini-3.5-flash-lite": "Google Gemini 3.5 Flash Lite (High Quota)",
  "gemini-2.5-flash-lite": "Google Gemini 2.5 Flash Lite",
  "gemini-2.5-flash": "Google Gemini 2.5 Flash",
  "gemini-3.5-flash": "Google Gemini 3.5 Flash",
  "gemini-3-flash": "Google Gemini 3 Flash",
  "gemini-3.6-flash": "Google Gemini 3.6 Flash",
  "gemini-3.7-flash": "Google Gemini 3.7 Flash",
  "gemini-3.8-flash": "Google Gemini 3.8 Flash",
  "gemini-1.5-flash": "Google Gemini 1.5 Flash (Legacy → 2.5 Lite)",
};

interface AudioToSrtTabProps {
  poolState: TTSPoolState;
  onOpenKeys: () => void;
  initialFile?: File | null;
  initialSourceLabel?: string | null;
  initialSrt?: string | null;
  initialScript?: string | null;
  onSendToSrtCleaner?: (srtContent: string, audioFile?: File | null, audioLabel?: string | null, scriptText?: string | null) => void;
  onManualFileSelect?: () => void;
}

function formatClock(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export default function AudioToSrtTab({
  poolState,
  onOpenKeys,
  initialFile,
  initialSourceLabel,
  initialSrt,
  initialScript,
  onSendToSrtCleaner,
  onManualFileSelect,
}: AudioToSrtTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const [engine, setEngine] = useState<EngineId>("groq-whisper-turbo");
  const [selectedProjectId, setSelectedProjectId] = useState(poolState.activeProjectId);
  const [scriptStyle, setScriptStyle] = useState<ScriptStyleType>("auto");
  const [language, setLanguage] = useState("hi");
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(8);
  const [minWordsPerLine, setMinWordsPerLine] = useState(5);
  const [ignoreDuration, setIgnoreDuration] = useState(true);
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<UploadProgressState>({
    stage: "idle",
    percent: 0,
    loadedMB: 0,
    totalMB: 0,
    elapsedSec: 0,
    totalChunks: 1,
    currentChunkIndex: 0,
    chunksList: [],
    currentStepIndex: 0,
    stepDetail: "",
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [srtResult, setSrtResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timingMeta, setTimingMeta] = useState<{
    coveragePct: number;
    largestGapSec: number;
    largestGapAt: number;
    retried: boolean;
    estimated: boolean;
  } | null>(null);
  // Server-confirmed exact upload size (browser -> /api/transcribe -> Groq/Gemini).
  // Groq response me bytes wapas nahi aata, isliye backend audioBuffer.length report karta hai.
  const [uploadMeta, setUploadMeta] = useState<{
    bytes: number;
    mb: number;
    display: string;
    fileName?: string;
  } | null>(null);
  const [scriptFixState, setScriptFixState] = useState<{
    needed: boolean;
    fixed: boolean;
    changed: number;
  } | null>(null);
  const [fixingUrdu, setFixingUrdu] = useState(false);
  const [showSyncFix, setShowSyncFix] = useState(false);
  const [useChunking, setUseChunking] = useState(false);
  const ft = useFeatureTitles();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Synchronized Live Preview State ───
  const [viewMode, setViewMode] = useState<"sync-preview" | "raw-srt">("sync-preview");
  const [canvasMode, setCanvasMode] = useState<"reel" | "landscape">("reel");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [editingCueId, setEditingCueId] = useState<number | null>(null);
  const [vaultSaved, setVaultSaved] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Sync selectedFile with audioUrl
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      setIsPlaying(false);
      setCurrentTime(0);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioUrl(null);
    }
  }, [selectedFile]);

  // Lambi audio (>2.5 min) par chunking auto-ON — beech ka miss rokta hai
  useEffect(() => {
    if (duration > 150) setUseChunking(true);
  }, [duration]);

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
      setSrtResult(null);
    }
  }, [initialFile]);

  useEffect(() => {
    // Echo-guard: jo SRT already display par hai use dobara mat thopo.
    // (Send-to-cleaner pipelineSrt wapas aata hai — bina guard ke fresh result
    // stale shared value se clobber ho jata.)
    if (initialSrt && initialSrt !== srtResult) {
      setSrtResult(initialSrt);
      setViewMode("sync-preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSrt]);

  // Linked ground-truth script (Studio se aayi ho to) — cleaner ko forward hogi.
  const [contextScript, setContextScript] = useState<string | null>(initialScript || null);
  useEffect(() => {
    const incoming = initialScript || null;
    if (incoming !== contextScript) setContextScript(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScript]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Parse SRT cues dynamically
  const cues: SrtCue[] = useMemo(() => {
    if (!srtResult) return [];
    return parseSrtCues(srtResult);
  }, [srtResult]);

  // Find currently active cue based on currentTime
  const activeCueIndex = useMemo(() => {
    if (!cues.length) return -1;
    return cues.findIndex((c) => currentTime >= c.start && currentTime <= c.end);
  }, [cues, currentTime]);

  const currentCue = activeCueIndex !== -1 ? cues[activeCueIndex] : null;

  // Auto-scroll transcript list to active cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeCueIndex, autoScroll]);

  const activeProject =
    poolState.projects.find((p) => p.id === selectedProjectId) ||
    poolState.projects.find((p) => p.id === poolState.activeProjectId) ||
    poolState.projects[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setUploadMeta(null);
      // Bahar se file aayi = studio script ab stale hai
      onManualFileSelect?.();
      setProgressState({ stage: "idle", percent: 0, loadedMB: 0, totalMB: 0, elapsedSec: 0, totalChunks: 1, currentChunkIndex: 0, chunksList: [], currentStepIndex: 0, stepDetail: "" });
    }
  };

  // Step 4+5 (shared): formatting → smart title → vault save → done.
  // Shared by single-pass (XHR) and chunked (fetch).
  const finalizeTranscription = async (
    srtText: string,
    timing: {
      coveragePct: number;
      largestGapSec: number;
      largestGapAt: number;
      retried: boolean;
      estimated: boolean;
    } | null,
    sourceAudioFile?: File | null
  ) => {
    // Stop every elapsed timer here — otherwise "Done (Ns)" keeps counting forever.
    if (timerRef.current) clearInterval(timerRef.current);
    setSrtResult(srtText);
    if (timing) setTimingMeta(timing);

    const isHinglishFx = scriptStyle === "manual" && language === "hinglish";
    const effectiveScriptFx = isHinglishFx ? "roman" : scriptStyle === "auto" ? "auto" : "manual";

    // Step 4: Formatting
    setProgressState((prev) => ({
      ...prev,
      stage: "formatting",
      currentStepIndex: 4,
      stepDetail: "Formatting subtitle cues & applying word limits...",
    }));

    // Smart title from spoken text only (never cue numbers/timestamps).
    const parsedCues = parseSrtCues(srtText);
    const spokenText = parsedCues.map((c) => c.text).join(" ");
    const smartTitle = generateSmartTitle(spokenText, "Audio Subtitles");

    // Step 5: Vault Save
    setProgressState((prev) => ({
      ...prev,
      stage: "finalizing",
      currentStepIndex: 5,
      stepDetail: `Saving "${smartTitle}" to Asset Vault...`,
      smartTitle,
    }));

    // 1. Save SRT to Asset Vault (IndexedDB 20 SRTs FIFO)
    try {
      await saveSrtToQueue({
        name: smartTitle,
        sourceTab: "audio-to-srt",
        cuesCount: parsedCues.length,
        srtContent: srtText,
        scriptStyle: effectiveScriptFx,
        filename: `${smartTitle.toLowerCase().replace(/\s+/g, "-")}.srt`,
      });
    } catch (storageErr) {
      console.warn("Failed to persist SRT to Asset Vault:", storageErr);
    }

    // 2. Also persist audio in Asset Vault — File -> base64 dataUrl (independent of SRT save)
    const audioTarget = sourceAudioFile || selectedFile;
    if (audioTarget && audioTarget instanceof Blob) {
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(audioTarget);
        });
        const ext = audioTarget.name?.split(".").pop()?.toLowerCase() || "mp3";
        await saveAudioToQueue({
          name: smartTitle,
          sourceTab: "audio-to-srt",
          durationSeconds: duration,
          sizeBytes: audioTarget.size,
          dataUrl,
          format: ext,
        });
      } catch (audioSaveErr) {
        console.warn("Audio vault save skipped:", audioSaveErr);
      }
    }

    setVaultSaved(true);

    setProgressState((prev) => ({
      ...prev,
      stage: "done",
      percent: 100,
      currentStepIndex: 5,
      stepDetail: "All steps complete! Live Sync Preview active.",
      smartTitle,
    }));
    setViewMode("sync-preview");
  };

  const handleManualSaveToVault = async () => {
    if (!srtResult) return;
    const parsedCues = parseSrtCues(srtResult);
    const spokenText = parsedCues.map((c) => c.text).join(" ");
    const smartTitle = generateSmartTitle(spokenText, "Audio Subtitles");

    try {
      await saveSrtToQueue({
        name: smartTitle,
        sourceTab: "audio-to-srt",
        cuesCount: parsedCues.length,
        srtContent: srtResult,
        filename: `${smartTitle.toLowerCase().replace(/\s+/g, "-")}.srt`,
      });

      if (selectedFile && selectedFile instanceof Blob) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(selectedFile);
        });
        const ext = selectedFile.name?.split(".").pop()?.toLowerCase() || "mp3";
        await saveAudioToQueue({
          name: smartTitle,
          sourceTab: "audio-to-srt",
          durationSeconds: duration,
          sizeBytes: selectedFile.size,
          dataUrl,
          format: ext,
        });
      }
      setVaultSaved(true);
      setTimeout(() => setVaultSaved(false), 2500);
    } catch (e) {
      console.warn("Manual save to vault failed:", e);
    }
  };

  // Long audio: transcribe in 60s WAV chunks, then merge with offsets.
  // Small chunks stop Whisper from dropping middle sections.
  const transcribeChunked = async (
    file: File,
    baseParams: { engine: EngineId; effectiveScript: string; effectiveLang: string }
  ) => {
    const totalMB = parseFloat((file.size / 1024 / 1024).toFixed(1));
    setProgressState({
      stage: "slicing",
      percent: 0,
      loadedMB: 0,
      totalMB,
      elapsedSec: 0,
      totalChunks: 0,
      currentChunkIndex: 0,
      chunksList: [],
      currentStepIndex: 1,
      stepDetail: "Detecting speech pauses & slicing audio into 60s chunks...",
    });

    const { chunks, totalDuration } = await splitAudioToChunks(file, 60);

    const initialChunks: ChunkStatusItem[] = chunks.map((ch, i) => ({
      index: i + 1,
      offsetSec: ch.offsetSec,
      durationSec: ch.durationSec,
      status: "pending",
    }));

    setProgressState((prev) => ({
      ...prev,
      stage: "transcribing",
      percent: 0,
      totalChunks: chunks.length,
      currentChunkIndex: 1,
      chunksList: initialChunks,
      stepDetail: `Prepared ${chunks.length} chunks (~60s each). Starting Whisper transcription...`,
    }));

    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setProgressState((prev) => ({
        ...prev,
        elapsedSec: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
      }));
    }, 100);

    const merged: SrtCue[] = [];
    let confirmedBytes = 0;
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      const chunkNumber = i + 1;

      setProgressState((prev) => ({
        ...prev,
        stage: "transcribing",
        currentChunkIndex: chunkNumber,
        percent: Math.round((i / chunks.length) * 100),
        chunksList: prev.chunksList.map((item, idx) =>
          idx === i ? { ...item, status: "processing" } : item
        ),
        stepDetail: `Transcribing Chunk ${chunkNumber}/${chunks.length} (${formatClock(ch.offsetSec)} ➔ ${formatClock(ch.offsetSec + ch.durationSec)})...`,
      }));

      const fd = new FormData();
      fd.append("audio", new File([ch.blob], ch.fileName, { type: "audio/wav" }));
      fd.append("engine", baseParams.engine);
      fd.append("scriptStyle", baseParams.effectiveScript);
      fd.append("groqApiKey", poolState.groqApiKey || "");
      fd.append("geminiApiKey", activeProject?.apiKey || "");
      fd.append("language", baseParams.effectiveLang);
      fd.append("maxWordsPerLine", maxWordsPerLine.toString());
      fd.append("minWordsPerLine", minWordsPerLine.toString());
      fd.append("ignoreDuration", ignoreDuration.toString());
      fd.append("prompt", customPrompt);
      fd.append("durationSeconds", ch.durationSec.toString());

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgressState((prev) => ({
          ...prev,
          chunksList: prev.chunksList.map((item, idx) =>
            idx === i ? { ...item, status: "error" } : item
          ),
        }));
        throw new Error(data.error || `Chunk ${chunkNumber}/${chunks.length} failed (${res.status})`);
      }
      // Server-confirmed exact bytes for this chunk (fallback: local blob size)
      confirmedBytes +=
        typeof data?.upload?.bytes === "number" ? data.upload.bytes : ch.blob.size;
      if (!data.srtContent || !String(data.srtContent).includes("-->")) {
        throw new Error(`No speech found in chunk ${chunkNumber} — please retry`);
      }
      const chunkCues = parseSrtCues(String(data.srtContent));
      for (const c of chunkCues) {
        merged.push({ ...c, start: c.start + ch.offsetSec, end: c.end + ch.offsetSec });
      }

      setProgressState((prev) => ({
        ...prev,
        percent: Math.round((chunkNumber / chunks.length) * 100),
        chunksList: prev.chunksList.map((item, idx) =>
          idx === i ? { ...item, status: "done", cuesCount: chunkCues.length } : item
        ),
        stepDetail:
          chunkNumber === chunks.length
            ? `All ${chunks.length} chunks transcribed! Merging subtitles...`
            : `Chunk ${chunkNumber}/${chunks.length} done (${chunkCues.length} cues). Starting Chunk ${chunkNumber + 1}...`,
      }));
    }

    setProgressState((prev) => ({
      ...prev,
      stage: "merging",
      percent: 100,
      stepDetail: `Merging all ${chunks.length} chunks into synchronized subtitle file...`,
    }));

    merged.sort((a, b) => a.start - b.start);
    const mergedSrt = cuesToSrt(merged);

    // Chunked path: server-confirmed total bytes (sum of per-chunk upload.bytes)
    const chunkedMB = Math.round((confirmedBytes / 1024 / 1024) * 100) / 100;
    setUploadMeta({
      bytes: confirmedBytes,
      mb: chunkedMB,
      display: chunkedMB >= 1 ? `${chunkedMB} MB` : `${Math.round(confirmedBytes / 1024)} KB`,
      fileName: file.name,
    });

    // Client-side coverage (merge ke baad)
    let covered = 0;
    let curEnd = -1;
    let lg = 0;
    let lgAt = 0;
    for (const c of merged) {
      if (curEnd >= 0 && c.start > curEnd) {
        const gap = c.start - curEnd;
        if (gap > lg) {
          lg = gap;
          lgAt = curEnd;
        }
      }
      if (c.end > curEnd) {
        covered += c.end - Math.max(c.start, curEnd < 0 ? c.start : curEnd);
        curEnd = c.end;
      }
    }
    await finalizeTranscription(
      mergedSrt,
      {
        coveragePct: Math.round(Math.min(1, covered / Math.max(1, totalDuration)) * 100),
        largestGapSec: Math.round(lg * 10) / 10,
        largestGapAt: Math.round(lgAt * 10) / 10,
        retried: false,
        estimated: baseParams.engine.startsWith("gemini"),
      },
      file
    );
    // Urdu mis-detection can also occur in the first chunk — show the banner.
    if (
      /[\u0600-\u06FF]/.test(mergedSrt) &&
      (baseParams.effectiveLang === "auto" || baseParams.effectiveLang === "hi")
    ) {
      setScriptFixState({ needed: true, fixed: false, changed: 0 });
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first.");
      return;
    }

    if (engine.startsWith("groq") && !poolState.groqApiKey?.trim()) {
      setError("Groq API Key is required for Whisper. Please add your Groq key in API Settings.");
      onOpenKeys();
      return;
    }

    if (engine.startsWith("gemini") && (!activeProject || !activeProject.apiKey.trim())) {
      setError("Gemini API Key is required for Gemini Transcribe. Please select a project with a key.");
      onOpenKeys();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTimingMeta(null);
    setUploadMeta(null);
    setScriptFixState(null);

    const totalFileSizeMB = parseFloat((selectedFile.size / 1024 / 1024).toFixed(1));
    setProgressState({
      stage: "uploading",
      percent: 0,
      loadedMB: 0,
      totalMB: totalFileSizeMB,
      elapsedSec: 0,
      totalChunks: 1,
      currentChunkIndex: 1,
      chunksList: [],
      currentStepIndex: 1,
      stepDetail: `Preparing audio (${totalFileSizeMB} MB) for transcription...`,
    });

    try {
      // Resolve effective script + language for backend (backward compatible)
      const isHinglish = scriptStyle === "manual" && language === "hinglish";
      const effectiveScript = isHinglish ? "roman" : scriptStyle === "auto" ? "auto" : "manual";
      const effectiveLang =
        scriptStyle === "auto" ? "auto" : isHinglish ? "hi" : language;

      // Long audio uses the chunked path (60s WAV chunks). Above 2.5 min or 8MB,
      // or when the user enabled the toggle. Decode failure falls back to single-pass.
      const doChunk = useChunking || selectedFile.size > 8 * 1024 * 1024;
      if (doChunk) {
        try {
          await transcribeChunked(selectedFile, { engine, effectiveScript, effectiveLang });
          setIsProcessing(false);
          return;
        } catch (chunkErr) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (chunkErr instanceof ChunkDecodeError) {
            console.warn("Chunking unavailable, single-pass fallback:", chunkErr.message);
          } else {
            setError(chunkErr instanceof Error ? chunkErr.message : "Chunked transcription failed");
            setProgressState((prev) => ({ ...prev, stage: "error", stepDetail: "Transcription error occurred" }));
            setIsProcessing(false);
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("engine", engine);
      formData.append("scriptStyle", effectiveScript);
      formData.append("groqApiKey", poolState.groqApiKey || "");
      formData.append("geminiApiKey", activeProject?.apiKey || "");
      formData.append("language", effectiveLang);
      formData.append("maxWordsPerLine", maxWordsPerLine.toString());
      formData.append("minWordsPerLine", minWordsPerLine.toString());
      formData.append("ignoreDuration", ignoreDuration.toString());
      formData.append("prompt", customPrompt);
      if (duration > 0 && isFinite(duration)) {
        formData.append("durationSeconds", duration.toString());
      }

      const xhr = new XMLHttpRequest();
      let startTime = Date.now();
      const sendStart = performance.now(); // REAL measured upload time (no estimated %)
      let progressEvents = 0;

      const singleList: ChunkStatusItem[] = [
        {
          index: 1,
          offsetSec: 0,
          durationSec: duration > 0 && isFinite(duration) ? duration : 60,
          status: "processing",
        },
      ];

      setProgressState({
        stage: "uploading",
        percent: 0,
        loadedMB: 0,
        totalMB: totalFileSizeMB,
        elapsedSec: 0,
        totalChunks: 1,
        currentChunkIndex: 1,
        chunksList: singleList,
        currentStepIndex: 1,
        stepDetail: `Sending audio (${totalFileSizeMB} MB) to Whisper...`,
      });

      // Show only REAL browser progress events — no animations or estimates
      xhr.upload.onprogress = (e) => {
        progressEvents++;
        if (e.lengthComputable) {
          const rawPct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          const loadedMB = parseFloat((e.loaded / 1024 / 1024).toFixed(1));
          setProgressState((prev) => ({
            ...prev,
            stage: "uploading",
            percent: Math.round(rawPct * 0.45),
            loadedMB,
            totalMB: totalFileSizeMB,
            stepDetail: `Uploading: ${loadedMB} MB / ${totalFileSizeMB} MB (${rawPct}%)`,
          }));
        }
      };

      // When upload finishes and server starts processing
      xhr.upload.onload = () => {
        const uploadSecs = (performance.now() - sendStart) / 1000;
        setProgressState((prev) => ({
          ...prev,
          stage: "transcribing",
          percent: 50,
          loadedMB: totalFileSizeMB,
          currentStepIndex: 3,
          stepDetail: `Audio delivered (${totalFileSizeMB} MB in ${uploadSecs.toFixed(1)}s). Whisper AI is generating word timestamps...`,
        }));

        startTime = Date.now();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          const sec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
          setProgressState((prev) => ({
            ...prev,
            elapsedSec: sec,
          }));
        }, 100);
      };

      xhr.onload = async () => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const cuesCount = parseSrtCues(data.srtContent || "").length;
            setProgressState((prev) => ({
              ...prev,
              percent: 100,
              chunksList: prev.chunksList.map((item) => ({
                ...item,
                status: "done",
                cuesCount,
              })),
            }));
            // Server-confirmed exact upload size (fallback: local file size)
            if (data?.upload && typeof data.upload.bytes === "number") {
              setUploadMeta(data.upload);
            } else if (selectedFile) {
              const mb = Math.round((selectedFile.size / 1024 / 1024) * 100) / 100;
              setUploadMeta({
                bytes: selectedFile.size,
                mb,
                display: mb >= 1 ? `${mb} MB` : `${Math.round(selectedFile.size / 1024)} KB`,
                fileName: selectedFile.name,
              });
            }
            await finalizeTranscription(data.srtContent, data.timing || null, selectedFile);
            if (data.scriptFix) setScriptFixState(data.scriptFix);
          } catch (parseErr: any) {
            setError("Failed to parse transcription response");
            setProgressState((prev) => ({ ...prev, stage: "error", stepDetail: "Failed to parse response" }));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            setError(errData.error || `Transcription failed (${xhr.status})`);
          } catch {
            setError(`Transcription failed (${xhr.status})`);
          }
          setProgressState((prev) => ({ ...prev, stage: "error", stepDetail: "Transcription error occurred" }));
        }
        setIsProcessing(false);
      };

      xhr.onerror = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setError("Network error: Please check your internet connection.");
        setProgressState((prev) => ({ ...prev, stage: "error" }));
        setIsProcessing(false);
      };

      xhr.open("POST", "/api/transcribe");
      xhr.send(formData);
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(err.message || "An unexpected error occurred");
      setProgressState((prev) => ({ ...prev, stage: "error" }));
      setIsProcessing(false);
    }
  };

  // Audio Playback Transport Handlers
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn("Playback error:", e));
    }
  };

  const seekTo = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(seconds, duration || 9999));
    setCurrentTime(audioRef.current.currentTime);
  };

  const seekCueAndPlay = (cue: SrtCue) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = cue.start;
    setCurrentTime(cue.start);
    audioRef.current.play().then(() => setIsPlaying(true));
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextRate = speeds[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleUpdateCueText = (cueId: number, newText: string) => {
    const updated = cues.map((c, i) => ((c.id || i + 1) === cueId ? { ...c, text: newText } : c));
    const newSrt = cuesToSrt(updated);
    setSrtResult(newSrt);
  };

  // If the backend could not auto-fix: Urdu lines to Devanagari (one click).
  const fixUrduScript = async () => {
    if (!srtResult || fixingUrdu) return;
    const hasGroq = !!poolState.groqApiKey?.trim();
    const hasGemini = !!activeProject?.apiKey?.trim();
    if (!hasGroq && !hasGemini) {
      setError("A Groq or Gemini API key is required for this fix. Add it in API Settings.");
      onOpenKeys();
      return;
    }
    setFixingUrdu(true);
    setError(null);
    try {
      const res = await fetch("/api/transform-srt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srt: srtResult,
          task: "custom",
          customInstruction:
            "Convert ONLY the lines written in Perso-Arabic/Urdu script into Hindi Devanagari script with the SAME meaning. Lines already in Devanagari or English must stay EXACTLY unchanged.",
          script: "",
          provider: hasGroq ? "groq" : "gemini",
          model: hasGroq ? "openai/gpt-oss-20b" : "gemini-3.1-flash-lite",
          groqApiKey: poolState.groqApiKey || "",
          geminiApiKey: activeProject?.apiKey || "",
          maxWordsPerLine,
          minWordsPerLine,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Urdu fix fail ho gaya");
      setSrtResult(data.srtContent);
      setScriptFixState({ needed: true, fixed: true, changed: data.transformedCount || 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Urdu fix fail ho gaya");
    }
    setFixingUrdu(false);
  };

  // Sync Fix: constant offset vs progressive drift need different repairs.
  const transformAllCues = (fn: (c: SrtCue) => SrtCue) => {
    if (!cues.length) return;
    setSrtResult(cuesToSrt(cues.map(fn)));
  };
  // Shift all cues together (for constant delay).
  const shiftSync = (deltaSec: number) =>
    transformAllCues((c) => ({
      ...c,
      start: Math.max(0, c.start + deltaSec),
      end: Math.max(0.2, c.end + deltaSec),
    }));
  // Stretch or shrink the whole timeline (for gradually growing drift).
  const stretchSync = (factor: number) =>
    transformAllCues((c) => ({ ...c, start: c.start * factor, end: c.end * factor }));
  // Redistribute across the full duration by word count (instant fix for AI drift).
  const retimeProportional = () => {
    if (!cues.length) return;
    const totalDur = duration > 0 ? duration : cues[cues.length - 1].end;
    if (totalDur <= 0) return;
    const totalWords =
      cues.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0) || 1;
    let t = 0;
    const out = cues.map((c) => {
      const w = c.text.split(/\s+/).filter(Boolean).length || 1;
      const nc = { ...c, start: t, end: t + (w / totalWords) * totalDur };
      t = nc.end;
      return nc;
    });
    out[out.length - 1].end = totalDur;
    setSrtResult(cuesToSrt(out));
  };

  const cuesCount = cues.length;

  return (
    <div className="space-y-6">
      {/* Tool Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Audio to SRT &amp; Live Synchronized Preview</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Live Reel Sync Player
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Transcribe audio and verify every word and timestamp against the audio in the live preview.
          </p>
        </div>
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
          <span className="text-[11px] text-amber-700 font-medium">Ready to transcribe &amp; verify</span>
        </div>
      )}

      {/* Hidden audio element for Live Sync Playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration || 0);
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Settings */}
        <div className="lg:col-span-5 space-y-4">
          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl bg-slate-50/70 hover:bg-amber-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-colors shadow-2xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.mp4,.mov"
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
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB &bull; Click to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-700">Upload an audio or video file</p>
                <p className="text-[11px] text-slate-400 mt-0.5">MP3, WAV, M4A, MP4 (Max 25MB)</p>
              </div>
            )}
          </div>

          {/* Engine & Settings */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Transcription Engine</label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="groq-whisper-turbo">
                  Groq Whisper Large v3 Turbo (Ultra Fast • 2-5s • Word Timestamps)
                </option>
                <option value="groq-whisper-v3">
                  Groq Whisper Large v3 (Maximum Accuracy • 99+ Languages)
                </option>
                <optgroup label="Gemini — Dedicated Transcribe (quota bahut kam)">
                  <option value="gemini-3.5-transcribe">
                    Gemini 3.5 Transcribe (Plain STT • ~1 RPM / 25 RPD)
                  </option>
                </optgroup>
                <optgroup label="Gemini — Flash (high quota, seedha SRT)">
                  <option value="gemini-3.1-flash-lite">
                    Gemini 3.1 Flash Lite (15 RPM / 500 RPD • Recommended)
                  </option>
                  <option value="gemini-3.5-flash-lite">
                    Gemini 3.5 Flash Lite (15 RPM / 500 RPD)
                  </option>
                  <option value="gemini-2.5-flash-lite">
                    Gemini 2.5 Flash Lite (10 RPM / 20 RPD)
                  </option>
                  <option value="gemini-2.5-flash">
                    Gemini 2.5 Flash (5 RPM / 20 RPD)
                  </option>
                  <option value="gemini-3.5-flash">
                    Gemini 3.5 Flash (5 RPM / 20 RPD)
                  </option>
                  <option value="gemini-3-flash">
                    Gemini 3 Flash (5 RPM / 20 RPD)
                  </option>
                  <option value="gemini-3.6-flash">
                    Gemini 3.6 Flash (5 RPM / 20 RPD)
                  </option>
                  <option value="gemini-3.7-flash">
                    Gemini 3.7 Flash (5 RPM / 20 RPD)
                  </option>
                  <option value="gemini-3.8-flash">
                    Gemini 3.8 Flash (5 RPM / 20 RPD)
                  </option>
                </optgroup>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Groq: all 2 models • Gemini: quota models only. If transcription fails, try Flash Lite.
              </p>
            </div>

            {/* Language Mode — sirf 2 options: Auto vs Manual */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-amber-600" />
                  <span>Language</span>
                </label>
                <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {scriptStyle === "auto" ? "Auto Detect" : "Manual Select"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SCRIPT_MODE_OPTIONS.map((opt) => {
                  const isSelected = scriptStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setScriptStyle(opt.id);
                        if (opt.id === "auto") setLanguage("auto");
                        else setLanguage("hi");
                      }}
                      className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-2xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </span>
                        <span
                          className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                            isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-tight">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Manual language dropdown — sirf manual mode me */}
              {scriptStyle === "manual" && (
                <div className="mt-2">
                  <label className="block text-slate-600 font-semibold mb-1 text-[11px]">
                    Manual language (output will use this)
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500"
                  >
                    {MANUAL_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Chunked transcription toggle — prevents missing middle sections in long audio */}
            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={useChunking}
                onChange={(e) => setUseChunking(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                <span className="font-semibold text-slate-700">60s chunks</span>
                <span className="block text-[10.5px] text-slate-500 leading-snug mt-0.5">
                  For audio over 2.5 min, Whisper may drop 10–40s in the middle (known issue). Small chunks prevent this.
                  {duration > 150 ? " Your file is long — auto ON." : " Auto ON for files over 8MB."}
                </span>
              </span>
            </label>

            {/* Advanced Model Context & Vocabulary Biasing */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
                className="w-full px-3 py-2 text-left flex items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI Prompt Conditioning &amp; Custom Vocabulary</span>
                </span>
                <span className="text-[10px] text-amber-600 font-bold">{showAdvancedPrompt ? "Hide ▲" : "View / Edit ▼"}</span>
              </button>
              {showAdvancedPrompt && (
                <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    This context prompt teaches the models the script and correct spellings. Add brand names or technical terms from your audio here:
                  </p>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full p-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Effective: <b>{scriptStyle === "auto" ? "auto" : language}</b> • empty = no bias</span>
                    <button
                      type="button"
                      onClick={() => setCustomPrompt("")}
                      className="text-amber-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Word Limits */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-600" />
                <span>Max Words / Subtitle Cue</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={maxWordsPerLine}
                  onChange={(e) => setMaxWordsPerLine(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-500">words</span>
              </div>
            </div>

            {/* Live Upload Progress & Stage Monitor Card */}
            {progressState.stage !== "idle" && (
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-500/10 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {progressState.stage === "uploading" ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    ) : progressState.stage === "transcribing" || progressState.stage === "slicing" ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    ) : progressState.stage === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : progressState.stage === "error" ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    )}
                    <span className="font-bold text-slate-900">
                      {progressState.stage === "slicing" && "🔪 Slicing 60s Chunks..."}
                      {progressState.stage === "uploading" && `📤 Uploading (${progressState.percent}%)`}
                      {progressState.stage === "transcribing" &&
                        (progressState.totalChunks > 1
                          ? `🤖 Chunk ${progressState.currentChunkIndex}/${progressState.totalChunks} Transcribing`
                          : "🤖 Whisper AI Transcribing...")}
                      {progressState.stage === "merging" && "🔗 Merging Chunks..."}
                      {progressState.stage === "formatting" && "⏱️ Aligning Word Timestamps..."}
                      {progressState.stage === "finalizing" && "💾 Syncing to Vault..."}
                      {progressState.stage === "done" && "✅ Subtitles Ready & Saved to Vault!"}
                      {progressState.stage === "error" && "❌ Transcription Error"}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-700 font-semibold">
                    {progressState.stage === "done" ? (
                      <span className="text-emerald-700 font-bold">Done ({progressState.elapsedSec}s)</span>
                    ) : (
                      <span className="text-amber-800 font-bold">⏱️ {progressState.elapsedSec}s</span>
                    )}
                  </div>
                </div>

                {/* Real Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      progressState.stage === "done"
                        ? "bg-emerald-500"
                        : progressState.stage === "error"
                        ? "bg-rose-500"
                        : "bg-gradient-to-r from-amber-500 to-emerald-500"
                    }`}
                    style={{
                      width: `${progressState.percent}%`,
                    }}
                  />
                </div>

                {/* Real Chunk Progress Badges */}
                {progressState.totalChunks > 1 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {progressState.chunksList.map((ch) => (
                      <span
                        key={ch.index}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-medium transition-colors ${
                          ch.status === "done"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                            : ch.status === "processing"
                            ? "bg-amber-200 text-amber-950 border border-amber-400 font-bold animate-pulse"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                        title={`Chunk ${ch.index}: ${formatClock(ch.offsetSec)} - ${formatClock(ch.offsetSec + ch.durationSec)}`}
                      >
                        {ch.status === "done"
                          ? `✓ #${ch.index}`
                          : ch.status === "processing"
                          ? `⚡ #${ch.index}`
                          : `#${ch.index}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Single Audio Stream</span>
                    <span className="font-mono font-bold text-amber-700">{progressState.percent}%</span>
                  </div>
                )}

                {/* Live Step Detail Notice */}
                {progressState.stepDetail && (
                  <p className="text-[11px] text-slate-600 font-medium italic">
                    &bull; {progressState.stepDetail}
                  </p>
                )}

                {progressState.smartTitle && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-900 font-medium pt-1 border-t border-amber-200/50">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Saved to Vault: <b>&ldquo;{progressState.smartTitle}&rdquo;</b></span>
                  </div>
                )}
              </div>
            )}

            {/* Transcribe Button */}
            <button
              onClick={handleTranscribe}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-sm shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transcribing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Subtitles (.SRT)</span>
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

        {/* Right Column: Synchronized Preview Player & SRT Output */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex flex-col h-[600px] rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            {/* Top Bar: Tabs & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 gap-2">
            {/* View Mode Toggle: Live Sync vs Raw SRT */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
              <button
                onClick={() => setViewMode("sync-preview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "sync-preview"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>Live Sync Preview</span>
              </button>

              <button
                onClick={() => setViewMode("raw-srt")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "raw-srt"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code className="w-3.5 h-3.5 text-slate-500" />
                <span>Raw .SRT Code</span>
              </button>
            </div>

            {/* Actions: Save to Vault, Copy, Download */}
            {srtResult && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleManualSaveToVault}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-300 shadow-2xs cursor-pointer"
                  title="Save or Re-sync SRT and Audio to Asset Vault"
                >
                  {vaultSaved ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>{vaultSaved ? "Saved to Vault" : "Save to Vault"}</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(srtResult);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-300 shadow-2xs cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>

                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(srtResult)}`}
                  download={selectedFile ? `${selectedFile.name.replace(/\.[^/.]+$/, "")}.srt` : "subtitles.srt"}
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .SRT</span>
                </a>
              </div>
            )}
          </div>

          {/* Sync Health + Sync Fix strip */}
          {srtResult && cues.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-200 bg-white">
              {scriptFixState?.needed && !scriptFixState.fixed && (
                <div className="mb-2 p-2.5 rounded-xl bg-orange-50 border border-orange-300 text-orange-900 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    ⚠️ Urdu script detected at the start (Whisper auto-detect glitch — Hindi audio was read as Urdu).
                  </span>
                  <button
                    type="button"
                    onClick={fixUrduScript}
                    disabled={fixingUrdu}
                    className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    {fixingUrdu ? "Fixing..." : "Convert to Hindi (Devanagari)"}
                  </button>
                </div>
              )}
              {scriptFixState?.fixed && (
                <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                  Urdu→Hindi script auto-fix applied{scriptFixState.changed > 0 ? ` (${scriptFixState.changed} cues)` : ""} — timestamps unchanged.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {uploadMeta && (
                  <span
                    title={`Exact uploaded audio size: ${uploadMeta.bytes.toLocaleString("en-IN")} bytes${uploadMeta.fileName ? ` (${uploadMeta.fileName})` : ""} — Groq/Gemini response me bytes wapas nahi aata, ye server-confirmed size hai.`}
                    className="px-2 py-0.5 rounded-full border font-semibold bg-sky-50 text-sky-700 border-sky-200"
                  >
                    ⬆️ {uploadMeta.display} uploaded ({uploadMeta.bytes.toLocaleString("en-IN")} bytes)
                  </span>
                )}
                {timingMeta && (
                  <span
                    className={`px-2 py-0.5 rounded-full border font-semibold ${
                      timingMeta.coveragePct < 85 || timingMeta.largestGapSec > 15
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : timingMeta.estimated
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {timingMeta.coveragePct < 85 || timingMeta.largestGapSec > 15
                      ? `Coverage ${timingMeta.coveragePct}% • largest gap ${timingMeta.largestGapSec}s @ ${formatClock(timingMeta.largestGapAt)}`
                      : timingMeta.estimated
                      ? "AI-estimated timestamps"
                      : `Coverage ${timingMeta.coveragePct}% • Word timestamps`}
                    {timingMeta.retried ? " • auto-retry applied" : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSyncFix(!showSyncFix)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  🔧 Sync Fix {showSyncFix ? "▲" : "▼"}
                </button>
              </div>
              {showSyncFix && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Start correct + end wrong = <b>drift</b> → Re-time or Stretch. Everything shifted = <b>offset</b> → −/+ seconds.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={retimeProportional}
                      title="Redistribute across the full audio duration by word count (instant fix for AI drift)"
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                    >
                      ⚖️ Proportional Re-time
                    </button>
                    <button type="button" onClick={() => shiftSync(-0.5)} className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">−0.5s</button>
                    <button type="button" onClick={() => shiftSync(0.5)} className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">+0.5s</button>
                    <button type="button" onClick={() => shiftSync(-0.1)} className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">−0.1s</button>
                    <button type="button" onClick={() => shiftSync(0.1)} className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">+0.1s</button>
                    <button type="button" onClick={() => stretchSync(0.99)} title="Shrink timeline by 1% (if subtitles run late)" className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">0.99x</button>
                    <button type="button" onClick={() => stretchSync(1.01)} title="Stretch timeline by 1% (if subtitles run early)" className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">1.01x</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {srtResult && cues.length > 0 ? (
              viewMode === "sync-preview" ? (
                /* ─── LIVE SYNC PREVIEW MODE ─── */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Mock Video Screen Overlay */}
                  <div className="relative w-full h-56 sm:h-64 bg-slate-950 flex flex-col items-center justify-between p-4 overflow-hidden border-b border-slate-800 select-none">
                    {/* Background Visualizer / Grid */}
                    <div className="absolute inset-0 opacity-15 flex items-center justify-center pointer-events-none">
                      <div className="w-full h-full bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
                    </div>

                    {/* Top Screen Controls */}
                    <div className="relative z-10 w-full flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {currentCue ? `Cue #${currentCue.id || activeCueIndex + 1} of ${cues.length}` : "Waiting for speech..."}
                        </span>
                      </div>

                      {/* Screen Format Toggle */}
                      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                        <button
                          onClick={() => setCanvasMode("reel")}
                          className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                            canvasMode === "reel" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>9:16 Reel</span>
                        </button>
                        <button
                          onClick={() => setCanvasMode("landscape")}
                          className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                            canvasMode === "landscape" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <Monitor className="w-3 h-3" />
                          <span>16:9 Video</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Subtitle Cue Overlay (Mockup Screen) */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-lg px-4 text-center my-2">
                      {currentCue ? (
                        <div className="space-y-2 animate-in zoom-in-95 duration-100">
                          <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {formatClock(currentCue.start)} ➔ {formatClock(currentCue.end)}
                          </span>
                          <h3 className="text-xl sm:text-2xl font-black text-amber-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] tracking-wide uppercase leading-tight font-sans">
                            {currentCue.text}
                          </h3>
                        </div>
                      ) : (
                        <div className="text-slate-600 text-xs font-mono">
                          {isPlaying ? "[ Silence / Pause ]" : "Click Play ▶ to test subtitle synchronization"}
                        </div>
                      )}
                    </div>

                    {/* Bottom Sound Spectrum Animation */}
                    <div className="relative z-10 w-full flex items-center justify-center gap-1 h-3 opacity-60">
                      {[...Array(24)].map((_, i) => (
                        <span
                          key={i}
                          className="w-1 bg-amber-400/80 rounded-full transition-all duration-75"
                          style={{
                            height: isPlaying ? `${Math.max(3, Math.sin(i * 0.5 + currentTime * 8) * 12 + 6)}px` : "3px",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Audio Transport Bar */}
                  <div className="p-3 bg-slate-900 border-b border-slate-800 text-white flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      {/* Play/Pause */}
                      <button
                        onClick={togglePlay}
                        disabled={!audioUrl}
                        className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold transition-transform active:scale-95 shadow-sm shadow-amber-500/20 cursor-pointer"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>

                      {/* Restart */}
                      <button
                        onClick={() => seekTo(0)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                        title="Restart from beginning"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Scrubber Range */}
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          step={0.05}
                          value={currentTime}
                          onChange={(e) => seekTo(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span className="text-amber-400 font-bold">{formatClock(currentTime)}</span>
                          <span>{formatClock(duration)}</span>
                        </div>
                      </div>

                      {/* Speed & Mute */}
                      <button
                        onClick={cycleSpeed}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-400 border border-slate-700 cursor-pointer shrink-0"
                      >
                        {playbackRate}x
                      </button>

                      <button
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.muted = !isMuted;
                            setIsMuted(!isMuted);
                          }
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Interactive Karaoke Cue List (Click to seek audio) */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-slate-50/50">
                    <div className="flex items-center justify-between px-1 mb-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        Interactive Transcript ({cues.length} Cues &bull; Click any cue to test audio)
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          className="accent-amber-600 rounded"
                        />
                        <span>Auto-scroll to active cue</span>
                      </label>
                    </div>

                    {cues.map((cue, idx) => {
                      const isActive = activeCueIndex === idx;
                      return (
                        <div
                          key={cue.id || idx}
                          ref={isActive ? activeCueRef : null}
                          onClick={() => seekCueAndPlay(cue)}
                          className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isActive
                              ? "bg-amber-100/80 border-amber-500 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500 scale-[1.01]"
                              : "bg-white hover:bg-slate-100/70 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isActive ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {isActive ? "▶" : idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${isActive ? "font-bold text-slate-950" : "text-slate-800"}`}>
                                {cue.text}
                              </p>
                              <span className="text-[10px] font-mono text-slate-400">
                                {formatClock(cue.start)} ➔ {formatClock(cue.end)} ({((cue.end - cue.start)).toFixed(1)}s)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                                Speaking
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ─── RAW .SRT CODE VIEW ─── */
                <div className="flex-1 p-4 bg-slate-50/40 overflow-y-auto">
                  <textarea
                    value={srtResult}
                    onChange={(e) => setSrtResult(e.target.value)}
                    className="w-full h-full bg-transparent text-xs font-mono text-slate-800 resize-none focus:outline-none leading-relaxed font-normal"
                  />
                </div>
              )
            ) : isProcessing ? (
              /* ─── 100% REAL CHUNK-BASED PIPELINE PROGRESS DASHBOARD ─── */
              <div className="h-full flex flex-col justify-between p-6 sm:p-7 bg-slate-950 text-white select-none overflow-y-auto">
                {/* 1. Header with Model, File & Real Live Timing */}
                <div className="space-y-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute" />
                        <span className="w-3 h-3 rounded-full bg-amber-500 relative" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                        {progressState.totalChunks > 1
                          ? `Chunked Transcription Active (${progressState.totalChunks} Chunks)`
                          : "AI Speech-to-Text Transcription Active"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-amber-400 font-mono text-xs font-bold shadow-xs">
                        ⏱️ {progressState.elapsedSec.toFixed(1)}s elapsed
                      </span>
                    </div>
                  </div>

                  {/* Badges / Specs row */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                      File: <b className="text-white">{selectedFile?.name || "audio.mp3"}</b> ({(selectedFile ? selectedFile.size / 1024 / 1024 : 0).toFixed(1)} MB)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 border border-slate-800 font-semibold">
                      Model: {ENGINE_LABELS[engine] || engine}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-emerald-300 border border-slate-800">
                      Total Audio: ~{Math.round(duration || 0)}s
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                      {progressState.totalChunks > 1 ? `${progressState.totalChunks} Chunks (Silence Cut)` : "Single Chunk"}
                    </span>
                  </div>

                  {/* 100% Real Progress Bar based on Chunks */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="text-slate-300 font-medium">
                        {progressState.totalChunks > 1
                          ? `Progress: ${progressState.chunksList.filter((c) => c.status === "done").length} of ${progressState.totalChunks} chunks transcribed`
                          : progressState.stepDetail}
                      </span>
                      <span className="text-amber-400 font-bold text-xs">
                        {progressState.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300"
                        style={{
                          width: `${progressState.percent}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Visual Chunk-by-Chunk Real Status Grid */}
                <div className="py-4 flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-3">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] font-mono">
                      {progressState.totalChunks > 1 ? "Audio Chunks Pipeline (60s Slices)" : "Audio Stream Status"}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      Active: Chunk {progressState.currentChunkIndex || 1} / {progressState.totalChunks || 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {progressState.chunksList && progressState.chunksList.length > 0 ? (
                      progressState.chunksList.map((ch) => {
                        const isDone = ch.status === "done";
                        const isProcessing = ch.status === "processing";
                        const isError = ch.status === "error";

                        return (
                          <div
                            key={ch.index}
                            className={`p-3 rounded-xl border transition-all ${
                              isDone
                                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                                : isProcessing
                                ? "bg-amber-950/40 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/40 shadow-xs"
                                : isError
                                ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
                                : "bg-slate-900/40 border-slate-800/80 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    isDone
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                      : isProcessing
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                                      : "bg-slate-800 text-slate-500"
                                  }`}
                                >
                                  {isDone ? "✓" : ch.index}
                                </span>
                                <div>
                                  <h4 className="text-xs font-bold text-white">
                                    Chunk #{ch.index}
                                  </h4>
                                  <p className="text-[10px] font-mono text-slate-400">
                                    {formatClock(ch.offsetSec)} ➔ {formatClock(ch.offsetSec + ch.durationSec)} ({Math.round(ch.durationSec)}s)
                                  </p>
                                </div>
                              </div>

                              <div>
                                {isDone && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                    {ch.cuesCount ? `${ch.cuesCount} cues` : "Done ✓"}
                                  </span>
                                )}
                                {isProcessing && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                                    Transcribing...
                                  </span>
                                )}
                                {ch.status === "pending" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                                    Queued
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-xs">
                        {progressState.stepDetail || "Preparing audio stream..."}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 text-center pt-1 font-mono">
                    &bull; {progressState.stepDetail}
                  </p>
                </div>

                {/* 3. Live Sound Frequency Equalizer Animation */}
                <div className="pt-3 border-t border-slate-800 flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1 h-5">
                    {[...Array(28)].map((_, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-75"
                        style={{
                          height: `${Math.max(3, Math.sin(i * 0.45 + progressState.elapsedSec * 7) * 12 + 6)}px`,
                          opacity: 0.85,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Groq Whisper LPU Engine &bull; Zero Hallucination 60s Chunk Pipeline
                  </p>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <FileText className="w-10 h-10 mb-2.5 stroke-[1.2] text-slate-300" />
                <p className="text-xs font-semibold text-slate-700">No subtitles generated yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Upload an audio file and click &ldquo;Generate Subtitles&rdquo;. The live preview
                  and audio sync player will activate here once subtitles are ready.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Next Step Pipeline Action Card */}
        {srtResult && onSendToSrtCleaner && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                  NEXT PIPELINE STEP
                </span>
                <span className="text-xs font-bold text-slate-900">
                  Step 5: {numberedTitle(ft, "srt-cleaner")}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Subtitles generated with acoustic word timestamps! Now polish formatting, create viral 1-3 word reels captions, or fix spelling in SRT Cleaner.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onSendToSrtCleaner(srtResult, selectedFile, initialSourceLabel || "Transcribe tab", contextScript)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm shadow-amber-500/20"
              >
                <Scissors className="w-4 h-4" />
                <span>Proceed to Step 5: {numberedTitle(ft, "srt-cleaner")} ➔</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
