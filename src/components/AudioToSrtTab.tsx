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
} from "lucide-react";
import { TTSPoolState, getRemainingRequests } from "@/lib/tts-projects";
import { parseSrtCues, cuesToSrt, formatSrtTime, SrtCue } from "@/lib/srt-chunker";
import { saveAudioToQueue, saveSrtToQueue } from "@/lib/audio-storage";
import { generateSmartTitle } from "@/lib/title-generator";

export interface UploadProgressState {
  stage: "idle" | "uploading" | "processing" | "transcribing" | "formatting" | "finalizing" | "done" | "error";
  percent: number;
  loadedMB: number;
  totalMB: number;
  elapsedSec: number;
  currentStepIndex: number;
  stepDetail: string;
  smartTitle?: string;
}

export type ScriptStyleType = "devanagari" | "roman" | "english" | "auto";

interface ScriptStyleOption {
  id: ScriptStyleType;
  label: string;
  badge: string;
  desc: string;
  prompt: string;
  lang: string;
  icon: string;
}

const SCRIPT_STYLE_OPTIONS: ScriptStyleOption[] = [
  {
    id: "devanagari",
    label: "शुद्ध हिंदी (Devanagari)",
    badge: "Pure Hindi",
    desc: "100% शुद्ध हिंदी (नमस्ते दोस्तों...). कोई इंग्लिश मिक्सिंग नहीं।",
    prompt:
      "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है। कृपया सभी शब्दों को केवल शुद्ध देवनागरी लिपि में ही लिखें।",
    lang: "hi",
    icon: "🇮🇳",
  },
  {
    id: "roman",
    label: "रोमन हिंग्लिश (Roman)",
    badge: "Reels / Shorts",
    desc: "बोलचाल की हिंग्लिश (Namaste doston...). वायरल कैप्शन स्टाइल।",
    prompt:
      "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है।",
    lang: "hi",
    icon: "💬",
  },
  {
    id: "english",
    label: "इंग्लिश ट्रांसलेशन (English)",
    badge: "Translate",
    desc: "हिंदी भाषण का अंग्रेजी सबटाइटल्स में अनुवाद (Hello friends...).",
    prompt: "Educational speech audio translated into clear, fluent English subtitles.",
    lang: "en",
    icon: "🇺🇸",
  },
  {
    id: "auto",
    label: "जैसा बोला वैसा (Verbatim)",
    badge: "Code-Switch",
    desc: "हिंदी शब्द देवनागरी में और तकनीकी शब्द अंग्रेजी लेटर्स में।",
    prompt: "नमस्ते, इस ऑडियो में हिंदी और तकनीकी अंग्रेजी शब्दों का स्वाभाविक प्रयोग है।",
    lang: "hi",
    icon: "🌐",
  },
];

interface AudioToSrtTabProps {
  poolState: TTSPoolState;
  onOpenKeys: () => void;
  initialFile?: File | null;
  initialSourceLabel?: string | null;
  initialSrt?: string | null;
  onSendToSrtCleaner?: (srtContent: string) => void;
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
  onSendToSrtCleaner,
}: AudioToSrtTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const [engine, setEngine] = useState<
    "groq-whisper-turbo" | "groq-whisper-v3" | "gemini-2.5-flash" | "gemini-1.5-flash"
  >("groq-whisper-turbo");
  const [selectedProjectId, setSelectedProjectId] = useState(poolState.activeProjectId);
  const [scriptStyle, setScriptStyle] = useState<ScriptStyleType>("devanagari");
  const [language, setLanguage] = useState("hi");
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(8);
  const [minWordsPerLine, setMinWordsPerLine] = useState(5);
  const [ignoreDuration, setIgnoreDuration] = useState(true);
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(
    "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है। कृपया सभी शब्दों को केवल शुद्ध देवनागरी लिपि में ही लिखें।"
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<UploadProgressState>({
    stage: "idle",
    percent: 0,
    loadedMB: 0,
    totalMB: 0,
    elapsedSec: 0,
    currentStepIndex: 0,
    stepDetail: "",
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [srtResult, setSrtResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
      setSrtResult(null);
    }
  }, [initialFile]);

  useEffect(() => {
    if (initialSrt) {
      setSrtResult(initialSrt);
      setViewMode("sync-preview");
    }
  }, [initialSrt]);

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
      setProgressState({ stage: "idle", percent: 0, loadedMB: 0, totalMB: 0, elapsedSec: 0, currentStepIndex: 0, stepDetail: "" });
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

    const totalFileSizeMB = parseFloat((selectedFile.size / 1024 / 1024).toFixed(1));
    setProgressState({
      stage: "uploading",
      percent: 0,
      loadedMB: 0,
      totalMB: totalFileSizeMB,
      elapsedSec: 0,
      currentStepIndex: 1,
      stepDetail: `Uploading audio (${totalFileSizeMB} MB) to server...`,
    });

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("engine", engine);
      formData.append("scriptStyle", scriptStyle);
      formData.append("groqApiKey", poolState.groqApiKey || "");
      formData.append("geminiApiKey", activeProject?.apiKey || "");
      formData.append("language", language);
      formData.append("maxWordsPerLine", maxWordsPerLine.toString());
      formData.append("minWordsPerLine", minWordsPerLine.toString());
      formData.append("ignoreDuration", ignoreDuration.toString());
      formData.append("prompt", customPrompt);

      const xhr = new XMLHttpRequest();
      let startTime = Date.now();

      setProgressState({
        stage: "uploading",
        percent: 0,
        loadedMB: 0,
        totalMB: totalFileSizeMB,
        elapsedSec: 0,
        currentStepIndex: 1,
        stepDetail: `Uploading audio (${totalFileSizeMB} MB) to server...`,
      });

      // Track live upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          const loadedMB = parseFloat((e.loaded / 1024 / 1024).toFixed(1));
          setProgressState((prev) => ({
            ...prev,
            stage: "uploading",
            percent,
            loadedMB,
            totalMB: totalFileSizeMB,
            currentStepIndex: 1,
            stepDetail: `Uploading: ${loadedMB} MB / ${totalFileSizeMB} MB (${percent}%)`,
          }));
        }
      };

      // When upload finishes and server starts processing
      xhr.upload.onload = () => {
        setProgressState((prev) => ({
          ...prev,
          stage: "transcribing",
          percent: 100,
          loadedMB: totalFileSizeMB,
          currentStepIndex: 3,
          stepDetail: "Audio uploaded (100%)! AI model acoustic decoding in progress...",
        }));

        startTime = Date.now();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          const sec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
          let detail = "AI Speech Model transcribing acoustic tokens...";
          if (sec > 4 && sec <= 12) {
            detail = "Recognizing Hindi speech phonetics & words...";
          } else if (sec > 12 && sec <= 24) {
            detail = "Aligning word-level timestamps (start & end offsets)...";
          } else if (sec > 24) {
            detail = "Formatting subtitle segments and syntax...";
          }

          setProgressState((prev) => ({
            ...prev,
            elapsedSec: sec,
            stepDetail: detail,
          }));
        }, 100);
      };

      xhr.onload = async () => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setSrtResult(data.srtContent);

            // Step 4: Formatting
            setProgressState((prev) => ({
              ...prev,
              stage: "formatting",
              currentStepIndex: 4,
              stepDetail: "Formatting subtitle cues & applying word limits...",
            }));

            // Smart Unique Title Generation from Transcript
            const smartTitle = generateSmartTitle(data.srtContent, "Hindi Audio Subtitles");
            const parsedCues = parseSrtCues(data.srtContent);

            // Step 5: Vault Save
            setProgressState((prev) => ({
              ...prev,
              stage: "finalizing",
              currentStepIndex: 5,
              stepDetail: `Saving "${smartTitle}" to Asset Vault...`,
              smartTitle,
            }));

            // Save to Asset Vault (IndexedDB 20 SRTs FIFO)
            try {
              await saveSrtToQueue({
                name: smartTitle,
                sourceTab: "audio-to-srt",
                cuesCount: parsedCues.length,
                srtContent: data.srtContent,
                scriptStyle,
                filename: `${smartTitle.toLowerCase().replace(/\s+/g, "-")}.srt`,
              });

              // Also persist audio in Asset Vault
              if (audioUrl) {
                await saveAudioToQueue({
                  name: smartTitle,
                  sourceTab: "transcribe",
                  durationSeconds: duration,
                  sizeBytes: selectedFile.size,
                  dataUrl: audioUrl,
                  format: "mp3",
                });
              }
            } catch (storageErr) {
              console.warn("Failed to persist SRT to Asset Vault:", storageErr);
            }

            setProgressState((prev) => ({
              ...prev,
              stage: "done",
              percent: 100,
              currentStepIndex: 5,
              stepDetail: "All steps complete! Live Sync Preview active.",
              smartTitle,
            }));
            setViewMode("sync-preview");
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
            Audio ko transcribe karein aur live preview me check karein ki har word aur timestamp audio se
            exactly match ho raha hai ya nahi.
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
                <p className="text-xs font-semibold text-slate-700">Audio ya Video file upload karein</p>
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
                  Groq Whisper Large v3 Turbo (Ultra Fast &bull; 2-5s &bull; Word Timestamps)
                </option>
                <option value="groq-whisper-v3">
                  Groq Whisper Large v3 (Maximum Accuracy &bull; Recommended for Hindi)
                </option>
                <option value="gemini-2.5-flash">
                  Google Gemini 2.5 Flash (Direct Multimodal Subtitles &bull; Zero Hallucination)
                </option>
                <option value="gemini-1.5-flash">
                  Google Gemini 1.5 Flash (Fast Multimodal Subtitles)
                </option>
              </select>
            </div>

            {/* Target Script & Language Selection (2x2 Grid) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-amber-600" />
                  <span>Target Script &amp; Language</span>
                </label>
                <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {scriptStyle === "devanagari"
                    ? "100% शुद्ध हिंदी (No English)"
                    : scriptStyle === "roman"
                    ? "Viral Reels Hinglish"
                    : scriptStyle === "english"
                    ? "English Subtitles"
                    : "Verbatim Code-Switch"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SCRIPT_STYLE_OPTIONS.map((opt) => {
                  const isSelected = scriptStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setScriptStyle(opt.id);
                        setCustomPrompt(opt.prompt);
                        setLanguage(opt.lang);
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
            </div>

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
                    Whisper aur Gemini ko script aur correct spelling sikhaane ke liye yeh context prompt use hota hai. Agar aapke audio me koi brand name ya technical words hain, to yahan likhein:
                  </p>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full p-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Language Code: <b>{language}</b></span>
                    <button
                      type="button"
                      onClick={() => {
                        const found = SCRIPT_STYLE_OPTIONS.find((s) => s.id === scriptStyle);
                        if (found) setCustomPrompt(found.prompt);
                      }}
                      className="text-amber-600 hover:underline font-semibold cursor-pointer"
                    >
                      Reset to default
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
                  min={4}
                  max={12}
                  value={maxWordsPerLine}
                  onChange={(e) => setMaxWordsPerLine(parseInt(e.target.value, 10) || 8)}
                  className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-500">words</span>
              </div>
            </div>

            {/* Live Upload Progress & Stage Monitor Card */}
            {progressState.stage !== "idle" && (
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-500/10 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {progressState.stage === "uploading" ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    ) : progressState.stage === "transcribing" ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    ) : progressState.stage === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : progressState.stage === "error" ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    )}
                    <span className="font-bold text-slate-900">
                      {progressState.stage === "uploading" && `📤 Step 1/5: Uploading Audio (${progressState.percent}%)`}
                      {progressState.stage === "processing" && "⚡ Step 2/5: Audio Ingestion..."}
                      {progressState.stage === "transcribing" && "🤖 Step 3/5: AI Speech Recognition..."}
                      {progressState.stage === "formatting" && "⏱️ Step 4/5: Aligning Timestamps..."}
                      {progressState.stage === "finalizing" && "💾 Step 5/5: Syncing to Vault..."}
                      {progressState.stage === "done" && "✅ Subtitles Ready & Saved to Vault!"}
                      {progressState.stage === "error" && "❌ Transcription Error"}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-700 font-semibold">
                    {progressState.stage === "uploading" ? (
                      <span>{progressState.loadedMB} MB / {progressState.totalMB} MB</span>
                    ) : progressState.stage === "done" ? (
                      <span className="text-emerald-700 font-bold">Done ({progressState.elapsedSec}s)</span>
                    ) : (
                      <span className="text-amber-800 font-bold">⏱️ {progressState.elapsedSec}s</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      progressState.stage === "done"
                        ? "bg-emerald-500 w-full"
                        : progressState.stage === "transcribing"
                        ? "bg-amber-500 w-full animate-pulse"
                        : progressState.stage === "error"
                        ? "bg-rose-500 w-full"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width:
                        progressState.stage === "uploading"
                          ? `${progressState.percent}%`
                          : progressState.stage === "transcribing"
                          ? `${Math.min(95, 35 + progressState.elapsedSec * 2.5)}%`
                          : "100%",
                    }}
                  />
                </div>

                {/* Step Pills Tracker */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className={`p-1.5 rounded-lg border text-center font-medium ${
                    progressState.currentStepIndex > 1
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                      : progressState.currentStepIndex === 1
                      ? "bg-blue-50 border-blue-200 text-blue-800 font-bold animate-pulse"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    1. Upload {progressState.currentStepIndex > 1 ? "✓" : `${progressState.percent}%`}
                  </div>

                  <div className={`p-1.5 rounded-lg border text-center font-medium ${
                    progressState.currentStepIndex > 3
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                      : progressState.currentStepIndex === 3
                      ? "bg-amber-100 border-amber-300 text-amber-900 font-bold animate-pulse"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    2. AI Model {progressState.currentStepIndex > 3 ? "✓" : progressState.currentStepIndex === 3 ? "⟳" : "○"}
                  </div>

                  <div className={`p-1.5 rounded-lg border text-center font-medium ${
                    progressState.currentStepIndex >= 4
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    3. Subtitles {progressState.stage === "done" ? "✓ Ready" : "○"}
                  </div>
                </div>

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
        <div className="lg:col-span-7 flex flex-col h-[640px] rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
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

            {/* Actions: Copy, Send to Cleaner, Download */}
            {srtResult && (
              <div className="flex items-center gap-1.5">
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

                {onSendToSrtCleaner && (
                  <button
                    onClick={() => onSendToSrtCleaner(srtResult)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-2xs cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Send to 5. SRT Cleaner ➔</span>
                  </button>
                )}

                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(srtResult)}`}
                  download={selectedFile ? `${selectedFile.name.replace(/\.[^/.]+$/, "")}.srt` : "subtitles.srt"}
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>

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
              /* ─── FULL-SCREEN MULTI-STEP PIPELINE TRACKER DASHBOARD ─── */
              <div className="h-full flex flex-col justify-between p-6 sm:p-7 bg-slate-950 text-white select-none overflow-y-auto">
                {/* 1. Header Banner with Live Stopwatch & Model Info */}
                <div className="space-y-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute" />
                        <span className="w-3 h-3 rounded-full bg-amber-500 relative" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                        AI Subtitle Generation Pipeline Active
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
                      Model: {engine === "groq-whisper-turbo" ? "Groq Whisper Large v3 Turbo" : engine === "groq-whisper-v3" ? "Groq Whisper Large v3" : "Google Gemini 2.5 Flash"}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-emerald-300 border border-slate-800">
                      Script: {scriptStyle === "devanagari" ? "100% शुद्ध हिंदी (Devanagari)" : scriptStyle === "roman" ? "Reels Hinglish (Roman)" : scriptStyle === "english" ? "English Translation" : "Verbatim"}
                    </span>
                  </div>

                  {/* Overall Pipeline Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Overall Pipeline Progress</span>
                      <span className="text-amber-400 font-bold">
                        {progressState.stage === "uploading"
                          ? `${Math.round(progressState.percent * 0.35)}%`
                          : progressState.stage === "done"
                          ? "100%"
                          : `${Math.min(95, Math.round(35 + progressState.elapsedSec * 2.2))}%`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300"
                        style={{
                          width:
                            progressState.stage === "uploading"
                              ? `${progressState.percent * 0.35}%`
                              : progressState.stage === "done"
                              ? "100%"
                              : `${Math.min(95, 35 + progressState.elapsedSec * 2.2)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. The 5 Pipeline Steps */}
                <div className="space-y-2.5 py-3 flex-1 flex flex-col justify-center max-w-xl mx-auto w-full">
                  {/* Step 1: Upload */}
                  <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                    progressState.currentStepIndex === 1
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-200"
                      : progressState.currentStepIndex > 1
                      ? "bg-slate-900/60 border-emerald-500/30 text-slate-300"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-500"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        progressState.currentStepIndex > 1
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : progressState.currentStepIndex === 1
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-600"
                      }`}>
                        {progressState.currentStepIndex > 1 ? "✓" : "1"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">1. Audio Upload to Server</h4>
                        <p className="text-[11px] text-slate-400">
                          {progressState.currentStepIndex === 1
                            ? `Uploading ${progressState.percent}% (${progressState.loadedMB} MB / ${progressState.totalMB} MB)`
                            : `Upload Completed (${progressState.totalMB} MB transferred)`}
                        </p>
                      </div>
                    </div>
                    {progressState.currentStepIndex === 1 && (
                      <span className="text-xs font-mono font-bold text-blue-400 animate-pulse">
                        {progressState.percent}%
                      </span>
                    )}
                    {progressState.currentStepIndex > 1 && (
                      <span className="text-xs font-semibold text-emerald-400">Done ✓</span>
                    )}
                  </div>

                  {/* Step 2: Audio Ingestion & Decoding */}
                  <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                    progressState.currentStepIndex === 2
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                      : progressState.currentStepIndex > 2
                      ? "bg-slate-900/60 border-emerald-500/30 text-slate-300"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-500"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        progressState.currentStepIndex > 2
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : progressState.currentStepIndex === 2
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-600"
                      }`}>
                        {progressState.currentStepIndex > 2 ? "✓" : "2"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">2. Audio Decoding & Ingestion</h4>
                        <p className="text-[11px] text-slate-400">
                          {progressState.currentStepIndex > 2
                            ? "Audio waveform decoded & primed for AI model"
                            : progressState.currentStepIndex === 2
                            ? "Verifying audio waveform & headers..."
                            : "Waiting for upload to finish..."}
                        </p>
                      </div>
                    </div>
                    {progressState.currentStepIndex > 2 && (
                      <span className="text-xs font-semibold text-emerald-400">Done ✓</span>
                    )}
                  </div>

                  {/* Step 3: AI Speech Recognition */}
                  <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                    progressState.currentStepIndex === 3
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/30"
                      : progressState.currentStepIndex > 3
                      ? "bg-slate-900/60 border-emerald-500/30 text-slate-300"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-500"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        progressState.currentStepIndex > 3
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : progressState.currentStepIndex === 3
                          ? "bg-amber-500/30 text-amber-300 border border-amber-500 animate-pulse"
                          : "bg-slate-800 text-slate-600"
                      }`}>
                        {progressState.currentStepIndex > 3 ? "✓" : "3"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">3. AI Speech-to-Text Recognition</h4>
                          {progressState.currentStepIndex === 3 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse font-mono font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {progressState.currentStepIndex === 3
                            ? progressState.stepDetail
                            : progressState.currentStepIndex > 3
                            ? "Acoustic tokens transcribed with timestamps"
                            : "Queued in AI acoustic model pipeline"}
                        </p>
                      </div>
                    </div>
                    {progressState.currentStepIndex === 3 && (
                      <span className="text-xs font-mono font-bold text-amber-400">
                        ⏱️ {progressState.elapsedSec.toFixed(1)}s
                      </span>
                    )}
                    {progressState.currentStepIndex > 3 && (
                      <span className="text-xs font-semibold text-emerald-400">Done ✓</span>
                    )}
                  </div>

                  {/* Step 4: Subtitle Timing & Word Limits */}
                  <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                    progressState.currentStepIndex === 4
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-200"
                      : progressState.currentStepIndex > 4
                      ? "bg-slate-900/60 border-emerald-500/30 text-slate-300"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-500"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        progressState.currentStepIndex > 4
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : progressState.currentStepIndex === 4
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-600"
                      }`}>
                        {progressState.currentStepIndex > 4 ? "✓" : "4"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">4. Subtitle Timing & Word Limits</h4>
                        <p className="text-[11px] text-slate-400">
                          {progressState.currentStepIndex >= 4
                            ? `Formatting cues to ${minWordsPerLine}-${maxWordsPerLine} words per line`
                            : "Waiting for speech tokens..."}
                        </p>
                      </div>
                    </div>
                    {progressState.currentStepIndex > 4 && (
                      <span className="text-xs font-semibold text-emerald-400">Done ✓</span>
                    )}
                  </div>

                  {/* Step 5: Smart Title & Vault Sync */}
                  <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between transition-all ${
                    progressState.currentStepIndex === 5
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-500"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        progressState.stage === "done"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : progressState.currentStepIndex === 5
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-600"
                      }`}>
                        {progressState.stage === "done" ? "✓" : "5"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">5. Smart Title & Asset Vault Storage</h4>
                        <p className="text-[11px] text-slate-400">
                          {progressState.smartTitle
                            ? `Saved as "${progressState.smartTitle}" in Left Sidebar Vault`
                            : "Auto-saving audio & subtitles to Left Sidebar Vault"}
                        </p>
                      </div>
                    </div>
                    {progressState.stage === "done" && (
                      <span className="text-xs font-semibold text-emerald-400">Done ✓</span>
                    )}
                  </div>
                </div>

                {/* 3. Bottom Sound Frequency Equalizer Animation */}
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
                    Audio stream active &bull; AI model decoding phonetics in real-time
                  </p>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <FileText className="w-10 h-10 mb-2.5 stroke-[1.2] text-slate-300" />
                <p className="text-xs font-semibold text-slate-700">No subtitles generated yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Audio file upload karein aur &ldquo;Generate Subtitles&rdquo; par click karein. Subtitle bante hi yahan
                  live video preview aur audio sync player active ho jayega.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
