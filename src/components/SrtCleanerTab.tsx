"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scissors,
  FileText,
  FileAudio,
  Upload,
  Copy,
  Check,
  Download,
  Sparkles,
  Languages,
  ScrollText,
  Cpu,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { TTSPoolState } from "@/lib/tts-projects";
import { saveSrtToQueue } from "@/lib/audio-storage";
import { generateSmartTitle } from "@/lib/title-generator";
import SrtSyncPreview from "@/components/SrtSyncPreview";

// ─── Transform tasks ───
type TaskId =
  | "romanize"
  | "devanagari"
  | "translate-en"
  | "translate-hi"
  | "clean"
  | "captions"
  | "custom";

const TASKS: { id: TaskId; label: string; badge: string; desc: string; icon: string }[] = [
  { id: "romanize", label: "Hindi → Roman", badge: "Reels", desc: "Convert Devanagari Hindi to Roman Hinglish", icon: "💬" },
  { id: "devanagari", label: "Roman → Hindi", badge: "Pure", desc: "Convert Roman script to Devanagari Hindi", icon: "🇮🇳" },
  { id: "translate-en", label: "Translate EN", badge: "English", desc: "Translate subtitles to fluent English", icon: "🇺🇸" },
  { id: "translate-hi", label: "Translate HI", badge: "Hindi", desc: "Translate subtitles to Hindi", icon: "🔁" },
  { id: "clean", label: "Clean + Fix", badge: "Ground Truth", desc: "Fix spelling and typos against ground-truth script", icon: "🧹" },
  { id: "captions", label: "Viral Captions", badge: "Hooks", desc: "Format into punchy, high-retention short captions", icon: "🔥" },
  { id: "custom", label: "Custom", badge: "Prompt", desc: "Apply custom instructions to subtitle text", icon: "✨" },
];

// ─── Text models (quota wale only) ───
const GROQ_TEXT_MODELS = [
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Fast • 30 RPM)" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Best quality • Reasoning)" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B (Multilingual)" },
];

const GEMINI_TEXT_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (15 RPM • Recommended)" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite (15 RPM)" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
];

interface SrtCleanerTabProps {
  poolState: TTSPoolState;
  onOpenKeys: () => void;
  initialSrt?: string | null;
  initialAudioFile?: File | null;
  initialAudioLabel?: string | null;
  initialScript?: string | null;
  initialScriptLabel?: string | null;
  onClearScript?: () => void;
}

const CLEANER_LS_KEY = "audioStudio.srtCleaner.v1";

interface CleanerDraft {
  rawSrt: string;
  script: string;
  output: string;
  task: TaskId;
  provider: "groq" | "gemini";
  groqModel: string;
  geminiModel: string;
  maxWordsPerLine: number;
  minWordsPerLine: number;
}

function loadCleanerDraft(): Partial<CleanerDraft> | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(CLEANER_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function SrtCleanerTab({
  poolState,
  onOpenKeys,
  initialSrt,
  initialAudioFile,
  initialAudioLabel,
  initialScript,
  initialScriptLabel,
  onClearScript,
}: SrtCleanerTabProps) {
  // Mount par FRESH pipeline props ko priority (stale localStorage draft ke upar) —
  // tabs mounted rehte hain, aur reload par props null hote hain (tab draft kaam aata hai).
  const [rawSrt, setRawSrt] = useState(() => initialSrt || loadCleanerDraft()?.rawSrt || "");
  const [audioFile, setAudioFile] = useState<File | null>(initialAudioFile || null);
  const [audioLabel, setAudioLabel] = useState<string | null>(initialAudioLabel || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [script, setScript] = useState(() => initialScript || loadCleanerDraft()?.script || "");

  const [task, setTask] = useState<TaskId>(() => loadCleanerDraft()?.task || "romanize");
  const [customInstruction, setCustomInstruction] = useState("");
  const [provider, setProvider] = useState<"groq" | "gemini">(() => loadCleanerDraft()?.provider || "groq");
  const [groqModel, setGroqModel] = useState(() => loadCleanerDraft()?.groqModel || GROQ_TEXT_MODELS[0].id);
  const [geminiModel, setGeminiModel] = useState(() => loadCleanerDraft()?.geminiModel || GEMINI_TEXT_MODELS[0].id);
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(() => loadCleanerDraft()?.maxWordsPerLine || 8);
  const [minWordsPerLine, setMinWordsPerLine] = useState(() => loadCleanerDraft()?.minWordsPerLine || 5);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [batchProg, setBatchProg] = useState<{ b: number; of: number } | null>(null);
  const [output, setOutput] = useState(() => loadCleanerDraft()?.output || "");
  const [usedModel, setUsedModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const srtInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Pipeline se aaye to auto-fill — lekin jo already screen par hai use mat ponchho
  useEffect(() => {
    if (initialSrt && initialSrt !== rawSrt) {
      setRawSrt(initialSrt);
      setOutput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSrt]);
  useEffect(() => {
    if (initialAudioFile) {
      setAudioFile(initialAudioFile);
      setAudioLabel(initialAudioLabel || initialAudioFile.name);
    }
  }, [initialAudioFile, initialAudioLabel]);
  useEffect(() => {
    if (initialScript && initialScript !== script) setScript(initialScript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScript]);

  // Audio preview URL
  useEffect(() => {
    if (!audioFile) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  // Local autosave — tab switch / reload par kaam bana rahe
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const draft: CleanerDraft = {
          rawSrt,
          script,
          output,
          task,
          provider,
          groqModel,
          geminiModel,
          maxWordsPerLine,
          minWordsPerLine,
        };
        window.localStorage.setItem(CLEANER_LS_KEY, JSON.stringify(draft));
      } catch {
        /* quota ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [rawSrt, script, output, task, provider, groqModel, geminiModel, maxWordsPerLine, minWordsPerLine]);

  const activeProject =
    poolState.projects.find((p) => p.id === poolState.activeProjectId) || poolState.projects[0];

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawSrt((ev.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    setAudioLabel(f.name);
  };

  const handleTransform = async () => {
    if (!rawSrt.trim() || !rawSrt.includes("-->")) {
      setError("Please paste or upload a valid SRT file first.");
      return;
    }
    if (task === "custom" && !customInstruction.trim()) {
      setError("Please provide instructions for the custom task.");
      return;
    }
    if (provider === "groq" && !poolState.groqApiKey?.trim()) {
      setError("Groq API Key is required. Please set it in API Settings.");
      onOpenKeys();
      return;
    }
    if (provider === "gemini" && !activeProject?.apiKey?.trim()) {
      setError("Gemini API Key is required. Please set it in API Settings.");
      onOpenKeys();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setOutput("");
    setUsedModel("");
    setBatchProg(null);
    setProgressMsg("Starting transform...");

    try {
      const res = await fetch("/api/transform-srt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srt: rawSrt,
          task,
          customInstruction,
          script,
          provider,
          model: provider === "groq" ? groqModel : geminiModel,
          groqApiKey: poolState.groqApiKey || "",
          geminiApiKey: activeProject?.apiKey || "",
          projectName: provider === "gemini" ? activeProject?.name || "" : "",
          maxWordsPerLine,
          minWordsPerLine,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      // NDJSON progress stream (naya route) — fallback purana JSON (koi proxy/cache stream na de to)
      let data: Record<string, unknown> | null = null;
      if (contentType.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const msg = JSON.parse(line) as Record<string, unknown>;
            if (msg.type === "progress") {
              const b = msg.batch as number;
              const of = msg.of as number;
              setBatchProg({ b, of });
              setProgressMsg(`Transforming batch ${b}/${of} on ${String(msg.model || "")}...`);
            } else if (msg.type === "error") {
              throw new Error(String(msg.error || "Transform failed"));
            } else if (msg.type === "done") {
              data = msg;
            }
          }
        }
        if (!data) throw new Error("Stream ended without result — please retry");
      } else {
        data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data?.error as string) || `Transform fail (${res.status})`);
      }

      const srtContent = String(data?.srtContent || "");
      if (!srtContent.includes("-->")) throw new Error("Model ne valid SRT nahi diya — retry karo");
      setOutput(srtContent);
      const identity = data?.identity ? ` • ${String(data.identity)}` : "";
      setUsedModel(`${data?.provider === "groq" ? "Groq" : "Gemini"} • ${String(data?.model || "")}${identity} • ${String(data?.transformedCount)}/${String(data?.cuesCount)} cues`);
      setProgressMsg("");
      setBatchProg(null);

      try {
        const taskLabel = TASKS.find((t) => t.id === task)?.label || task;
        const smartName = generateSmartTitle(srtContent, "Cleaned SRT");
        await saveSrtToQueue({
          name: `${smartName} (${taskLabel})`,
          sourceTab: "srt-cleaner",
          srtContent,
          scriptStyle: task,
          filename: `${smartName.toLowerCase().replace(/\s+/g, "-")}-${task}.srt`,
        });
      } catch (e) {
        console.warn("Vault save skip:", e);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transform fail ho gaya");
      setProgressMsg("");
      setBatchProg(null);
    }
    setIsProcessing(false);
  };

  const rawCues = (rawSrt.match(/-->/g) || []).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">SRT Transformer & Cleaner</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Groq + Gemini Text Models
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Timestamps bilkul same rahenge — sirf text badlega: Roman, Hindi, Translate, Clean, Captions ya Custom.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => srtInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-300 shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            <span>Upload .SRT</span>
          </button>
          <input ref={srtInputRef} type="file" accept=".srt,.txt" onChange={handleSrtUpload} className="hidden" />
        </div>
      </div>

      {initialSrt && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">🔗 Pipeline: SRT auto-loaded ({rawCues} cues){audioFile ? ` + audio "${audioFile.name}"` : ""}{script ? " + studio script" : ""}</span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Ready to transform</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Left: Inputs (SRT + Audio + Script) ─── */}
        <div className="lg:col-span-5 space-y-4">
          {/* SRT input */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" /> Input SRT
              </span>
              {rawCues > 0 && <span className="text-slate-500 text-[11px]">{rawCues} cues</span>}
            </div>
            <textarea
              value={rawSrt}
              onChange={(e) => setRawSrt(e.target.value)}
              placeholder="Paste SRT content or click Upload .SRT above..."
              rows={9}
              className="w-full p-3 text-xs font-mono text-slate-800 resize-y focus:outline-none leading-relaxed"
            />
          </div>

          {/* Audio */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <FileAudio className="w-3.5 h-3.5 text-amber-600" /> Reference Audio (Listen & Verify)
              </span>
              <button
                onClick={() => audioInputRef.current?.click()}
                className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
              >
                {audioFile ? "Replace" : "Upload"}
              </button>
              <input ref={audioInputRef} type="file" accept="audio/*,video/*" onChange={handleAudioUpload} className="hidden" />
            </div>
            <div className="p-3">
              {audioUrl && audioFile ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-800 truncate" title={audioFile.name}>
                    🎧 {audioLabel || audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                  <audio controls src={audioUrl} className="w-full h-9" />
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Transferred from pipeline or upload manually (optional for text transformations).</p>
              )}
            </div>
          </div>

          {/* Exact script */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5 text-amber-600" /> Ground Truth Script
              </span>
              {script && initialScript ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  ✅ Auto-filled from Studio {initialScriptLabel ? `• ${initialScriptLabel}` : ""}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
                  Manual paste
                </span>
              )}
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste exact original script here for Clean + Fix task comparison. Automatically populated if routed from Studio."
              rows={5}
              className="w-full p-3 text-xs text-slate-800 resize-y focus:outline-none leading-relaxed"
            />
            {script && (
              <div className="px-3 pb-2.5 flex justify-end">
                <button
                  onClick={() => {
                    setScript("");
                    onClearScript?.();
                  }}
                  className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                >
                  Clear script
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Task + Model + Output ─── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs">
            {/* Task cards */}
            <div>
              <label className="text-slate-700 font-semibold flex items-center gap-1.5 mb-2">
                <Languages className="w-3.5 h-3.5 text-amber-600" /> Transformation Task
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TASKS.map((t) => {
                  const sel = task === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTask(t.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        sel
                          ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </span>
                        <span className={`text-[8.5px] px-1.5 rounded font-bold uppercase ${sel ? "bg-amber-500 text-slate-950" : "bg-slate-200 text-slate-600"}`}>
                          {t.badge}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-tight mt-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom instruction */}
            {task === "custom" && (
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Enter custom transformation instructions, e.g. 'Keep each cue under 5 words and capitalize key terms'..."
                rows={3}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            )}

            {/* Model select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "groq" | "gemini")}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="groq">Groq (GPT-OSS / Qwen)</option>
                  <option value="gemini">Gemini (Flash series)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-amber-600" /> Model
                </label>
                {provider === "groq" ? (
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:outline-none focus:border-amber-500"
                  >
                    {GROQ_TEXT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:outline-none focus:border-amber-500"
                  >
                    {GEMINI_TEXT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Word limits */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-600" /> Max Words / Cue (output)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={maxWordsPerLine}
                  onChange={(e) => setMaxWordsPerLine(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-center focus:outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={minWordsPerLine}
                  onChange={(e) => setMinWordsPerLine(parseInt(e.target.value, 10) || 5)}
                  className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-center focus:outline-none focus:border-amber-500"
                  title="Min words"
                />
              </div>
            </div>

            <button
              onClick={handleTransform}
              disabled={isProcessing || !rawSrt.trim()}
              className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-sm shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressMsg || "Transforming..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Transform SRT (timestamps locked 🔒)</span>
                </>
              )}
            </button>

            {/* Live batch progress (lambi SRT: 439 cues = 15 batches) */}
            {isProcessing && batchProg && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10.5px] font-semibold text-slate-600">
                  <span>{progressMsg}</span>
                  <span>{Math.round((batchProg.b / batchProg.of) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.round((batchProg.b / batchProg.of) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Output + Live Sync Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Transformed SRT</span>
                {usedModel && <span className="text-[10px] text-slate-400 font-mono">{usedModel}</span>}
              </div>
              {output && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(output);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 font-semibold text-slate-700 border border-slate-300 shadow-2xs cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(output)}`}
                    download={`cleaned-${task}.srt`}
                    className="flex items-center gap-1 px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              )}
            </div>
            <SrtSyncPreview
              srtText={output}
              onSrtTextChange={setOutput}
              audioUrl={audioUrl}
              audioName={audioFile?.name}
              emptyHint="Transform dabao — output yahan live preview (Reel screen + karaoke sync) ke saath aayega."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
