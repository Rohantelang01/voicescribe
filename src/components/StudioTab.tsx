"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Download,
  Trash2,
  Split,
  Sliders,
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Wand2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Mic,
  RotateCcw,
  Plus,
  Edit3,
  Cpu,
  Key,
  Merge,
} from "lucide-react";
import { PersonaConfig } from "@/lib/personas";
import { splitScriptIntoSafeParts } from "@/lib/tts-splitter";
import { PipelineVoiceoverPart } from "@/lib/pipeline-store";
import {
  TTSPoolState,
  TTS_MODELS,
  getTTSLimits,
  recordGenerationUsage,
  getRemainingRequests,
} from "@/lib/tts-projects";
import {
  saveBoxesToStorage,
  loadBoxesFromStorage,
  saveAudioToStorage,
  loadAudioFromStorage,
  deleteAudioFromStorage,
  clearAllTTSDataForPersona,
} from "@/lib/tts-audio-store";
import { saveAudioToQueue, saveSrtToQueue } from "@/lib/audio-storage";
import { generateSmartTitle } from "@/lib/title-generator";
import StudioAudioPlayer from "@/components/StudioAudioPlayer";
import { useFeatureTitles } from "@/lib/feature-titles";

export interface ScriptPartBox {
  id: string;
  partNumber: number;
  title: string;
  text: string;
  wordCount: number;
  charCount: number;
  estimatedSeconds: number;
  status: "idle" | "generating" | "completed" | "error";
  overrideModel?: string;
  overrideProjectId?: string;
  error?: string | null;
  audioResult?: {
    audioDataUrl: string;
    durationSeconds: number;
    sampleRate: number;
    sizeBytes: number;
    model: string;
  } | null;
}

interface StudioTabProps {
  poolState: TTSPoolState;
  onUpdatePoolState: (state: TTSPoolState) => void;
  onOpenKeys: () => void;
  persona: PersonaConfig;
  allPersonas: Record<string, PersonaConfig>;
  onSelectPersona: (id: string) => void;
  onOpenPersonaModal: () => void;
  onSendToMerger?: (parts: PipelineVoiceoverPart[]) => void;
  onSendToCleaner?: (dataUrl: string, filename: string) => void;
  onSendToTranscribe?: (dataUrl: string, filename: string, scriptText?: string) => void;
}

export default function StudioTab({
  poolState,
  onUpdatePoolState,
  onOpenKeys,
  persona,
  allPersonas,
  onSelectPersona,
  onOpenPersonaModal,
  onSendToMerger,
  onSendToCleaner,
  onSendToTranscribe,
}: StudioTabProps) {
  const [directorPrompt, setDirectorPrompt] = useState(persona.directorPrompt);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [partBoxes, setPartBoxes] = useState<ScriptPartBox[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [targetWordsPerPart, setTargetWordsPerPart] = useState(360);

  const ft = useFeatureTitles();
  // Split Modal
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [rawScriptInput, setRawScriptInput] = useState("");

  // Server hard cap (/api/tts): isse zyada chars par request reject ho jayegi.
  // Ye Gemini ka error nahi, hamare app ka apna safety guard hai.
  const TTS_CHAR_LIMIT = 15000;
  // Char-budget split isi cap ke thoda neeche kat-ta hai (safety margin),
  // taaki har part 15,000 ke nearest full-stop tak bhara ho.
  const TTS_CHAR_SAFE = 14500;

  // Strip ka driver = PART 1 (pehla box) ka effective model (uske dropdown ka override ya global).
  // Box 1 ka model dropdown badlo → strip ki limits auto badlegi. Koi box nahi → global model.
  const driverModelId =
    partBoxes.length > 0
      ? partBoxes[0].overrideModel || poolState.selectedModel
      : poolState.selectedModel;
  const driverLimits = getTTSLimits(driverModelId);
  const sliderMax = Math.max(450, driverLimits.maxWords);

  // Driver model badla → chunk slider uske default par (user wahan se adjust kar sakta hai)
  useEffect(() => {
    setTargetWordsPerPart(getTTSLimits(driverModelId).targetWords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverModelId]);

  // One-click split preview: Part 1 ka text current setting se kitne parts me katega.
  // Slider (words) + 14,500 char-budget — dono me se jo pehle aaye.
  const splitPreviewCount = useMemo(() => {
    const t = partBoxes.length > 0 ? partBoxes[0].text.trim() : "";
    if (!t) return 0;
    return splitScriptIntoSafeParts(t, targetWordsPerPart, Math.round(targetWordsPerPart * 1.15), TTS_CHAR_SAFE).length;
  }, [partBoxes, targetWordsPerPart]);

  const boxLimits = (box: ScriptPartBox) =>
    getTTSLimits(box.overrideModel || poolState.selectedModel);

  const createEmptyBox = (partNumber: number): ScriptPartBox => ({
    id: `box_${Date.now()}_${partNumber}_${Math.random().toString(36).slice(2, 7)}`,
    partNumber,
    title: `Part ${partNumber}: New script`,
    text: "",
    wordCount: 0,
    charCount: 0,
    estimatedSeconds: 0,
    status: "idle",
    audioResult: null,
  });

  const renumberBoxes = (boxes: ScriptPartBox[]): ScriptPartBox[] =>
    boxes.map((b, i) => ({ ...b, partNumber: i + 1 }));

  // Master Modal & State
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isMastering, setIsMastering] = useState(false);
  const [masterProgress, setMasterProgress] = useState("");
  const [masterSettings, setMasterSettings] = useState({
    mode: "mastered_mp3" as "mastered_mp3" | "raw_wav",
    bitrate: 192,
    noiseReduction: true,
    toneMatch: true,
    loudnessNormalize: true,
    silenceCut: false,
    generateSrt: true,
    scriptStyle: "roman" as "roman" | "devanagari" | "english",
  });

  const [masterResult, setMasterResult] = useState<{
    audioDataUrl: string;
    durationSeconds: number;
    sizeBytes: number;
    filename: string;
    srtContent?: string | null;
    filtersApplied?: string[];
  } | null>(null);

  // Srt Preview Modal
  const [isSrtModalOpen, setIsSrtModalOpen] = useState(false);
  const [copiedSrt, setCopiedSrt] = useState(false);

  // Playback State
  const [playingBoxId, setPlayingBoxId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Batch Generation State
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // Sync director prompt when persona changes
  useEffect(() => {
    setDirectorPrompt(persona.directorPrompt);
    setSelectedTemplateId("");
  }, [persona.id]);

  // Load drafts on mount or persona change
  useEffect(() => {
    async function initDrafts() {
      const savedBoxes = await loadBoxesFromStorage(persona.id);
      if (savedBoxes && savedBoxes.length > 0) {
        // Hydrate audio from IndexedDB
        const hydrated = await Promise.all(
          savedBoxes.map(async (box) => {
            const cachedAudio = await loadAudioFromStorage(box.id);
            if (cachedAudio) {
              return {
                ...box,
                status: "completed" as const,
                audioResult: {
                  audioDataUrl: cachedAudio.audioDataUrl,
                  durationSeconds: cachedAudio.durationSeconds,
                  sampleRate: cachedAudio.sampleRate,
                  sizeBytes: cachedAudio.sizeBytes,
                  model: cachedAudio.model || poolState.selectedModel,
                },
              };
            }
            return box;
          })
        );
        setPartBoxes(hydrated);
      } else {
        // Load default template if empty
        const defaultTemplate = persona.templates[0];
        if (defaultTemplate) {
          const parts = splitScriptIntoSafeParts(
            defaultTemplate.text,
            targetWordsPerPart,
            Math.round(targetWordsPerPart * 1.15),
            TTS_CHAR_SAFE
          );
          const initialBoxes: ScriptPartBox[] = parts.map((p) => ({
            id: `box_${Date.now()}_${p.partNumber}`,
            partNumber: p.partNumber,
            title: p.title,
            text: p.text,
            wordCount: p.wordCount,
            charCount: p.charCount,
            estimatedSeconds: p.estimatedSeconds,
            status: "idle",
            audioResult: null,
          }));
          setPartBoxes(initialBoxes);
          saveBoxesToStorage(persona.id, initialBoxes);
        } else {
          // Koi template nahi — by default ek khaali box rakho taaki user
          // turant likhna/paste karna shuru kar sake.
          const fresh = [createEmptyBox(1)];
          setPartBoxes(fresh);
          saveBoxesToStorage(persona.id, fresh);
        }
      }
    }

    initDrafts();
  }, [persona.id]);

  // Save drafts on change
  useEffect(() => {
    if (partBoxes.length > 0) {
      saveBoxesToStorage(persona.id, partBoxes);
    }
  }, [partBoxes, persona.id]);

  // Handle Template Selection
  const handleTemplateSelect = (templateId: string) => {
    const tmpl = persona.templates.find((t) => t.id === templateId);
    if (!tmpl) return;

    setSelectedTemplateId(templateId);
    const parts = splitScriptIntoSafeParts(
      tmpl.text,
      targetWordsPerPart,
      Math.round(targetWordsPerPart * 1.15),
      TTS_CHAR_SAFE
    );

    const newBoxes: ScriptPartBox[] = parts.map((p) => ({
      id: `box_${Date.now()}_${p.partNumber}`,
      partNumber: p.partNumber,
      title: p.title,
      text: p.text,
      wordCount: p.wordCount,
      charCount: p.charCount,
      estimatedSeconds: p.estimatedSeconds,
      status: "idle",
      audioResult: null,
    }));

    setPartBoxes(newBoxes);
    setMasterResult(null);
  };

  // Handle Manual Script Split
  const handleSplitScript = () => {
    if (!rawScriptInput.trim()) return;

    const parts = splitScriptIntoSafeParts(
      rawScriptInput,
      targetWordsPerPart,
      Math.round(targetWordsPerPart * 1.15),
      TTS_CHAR_SAFE
    );

    // Driver (Part 1) ka model override naye boxes par carry — taaki split
    // jis model ke hisab se hua, generate bhi usi se ho (dropdown me dikhega).
    const carryModel = partBoxes.length > 0 ? partBoxes[0].overrideModel : undefined;
    const carryProject = partBoxes.length > 0 ? partBoxes[0].overrideProjectId : undefined;

    const newBoxes: ScriptPartBox[] = parts.map((p) => ({
      id: `box_${Date.now()}_${p.partNumber}`,
      partNumber: p.partNumber,
      title: p.title,
      text: p.text,
      wordCount: p.wordCount,
      charCount: p.charCount,
      estimatedSeconds: p.estimatedSeconds,
      status: "idle",
      audioResult: null,
      ...(carryModel ? { overrideModel: carryModel } : {}),
      ...(carryProject ? { overrideProjectId: carryProject } : {}),
    }));
    setPartBoxes(newBoxes);
    setMasterResult(null);
    setIsSplitModalOpen(false);
    setRawScriptInput("");
  };

  // Naya khaali box jodo (numbering auto)
  const handleAddBox = () => {
    setPartBoxes((prev) => [...prev, createEmptyBox(prev.length + 1)]);
    setMasterResult(null);
  };

  // Ek box ka lamba script usi jagah multiple safe parts me baanto.
  // Purana audio (agar tha) hat jata hai kyunki text badal gaya.
  // 15,000-char server cap cross ho to char-budget mode: har part 14,500 ke
  // nearest full-stop tak bharta hai (word-target ignore hota hai).
  // Normal case me word-target mode (~360 words/part).
  const handleSplitBox = async (boxId: string) => {
    const idx = partBoxes.findIndex((b) => b.id === boxId);
    if (idx === -1) return;
    const box = partBoxes[idx];
    if (!box.text.trim()) return;

    // DONO constraints ek saath — ek click me poora split:
    // word mode = strip slider, aur hamesha 14,500 char-budget cap (server cap safety).
    // Splitter full-stop boundaries par kat-ta hai, jo limit pehle aaye.
    const wordTarget = targetWordsPerPart;
    const wordMax = Math.round(targetWordsPerPart * 1.15);
    const parts = splitScriptIntoSafeParts(box.text, wordTarget, wordMax, TTS_CHAR_SAFE);
    if (parts.length <= 1) {
      alert(
        "Could not split this script: no sentence endings (. ? ! ।) or paragraph breaks found to cut at. Please add full-stops or line breaks first."
      );
      return;
    }

    await deleteAudioFromStorage(boxId);
    // Box ka model/project override naye parts par carry — split jis model
    // ke hisab se hua, generate bhi usi se ho.
    const splitBoxes: ScriptPartBox[] = parts.map((p) => ({
      id: `box_${Date.now()}_${p.partNumber}_${Math.random().toString(36).slice(2, 7)}`,
      partNumber: p.partNumber,
      title: p.title,
      text: p.text,
      wordCount: p.wordCount,
      charCount: p.charCount,
      estimatedSeconds: p.estimatedSeconds,
      status: "idle",
      audioResult: null,
      ...(box.overrideModel ? { overrideModel: box.overrideModel } : {}),
      ...(box.overrideProjectId ? { overrideProjectId: box.overrideProjectId } : {}),
    }));

    const next = [...partBoxes.slice(0, idx), ...splitBoxes, ...partBoxes.slice(idx + 1)];
    setPartBoxes(renumberBoxes(next));
    setMasterResult(null);
  };

  // Generate Audio for Single Box
  const handleGenerateBox = async (boxId: string) => {
    const box = partBoxes.find((b) => b.id === boxId);
    if (!box || !box.text.trim()) return;

    // Server hard cap: 15,000 chars se upar request pakki fail hogi.
    // Cryptic error ke bajay seedha split offer karo.
    const charLen = box.text.trim().length;
    if (charLen > TTS_CHAR_LIMIT) {
      const ok = confirm(
        `This box has ${charLen.toLocaleString("en-IN")} characters, but the server accepts max 15,000 per request — Generate would fail.\n\nOK = split this box into safe parts first (recommended).\nCancel = stay as-is.`
      );
      if (ok) await handleSplitBox(box.id);
      return;
    }

    const targetProjectId = box.overrideProjectId || poolState.activeProjectId;
    const activeProject =
      poolState.projects.find((p) => p.id === targetProjectId) || poolState.projects[0];

    if (!activeProject || !activeProject.apiKey.trim()) {
      alert("Please enter a Google Cloud Gemini API key in API Settings first!");
      onOpenKeys();
      return;
    }

    const apiKey = activeProject.apiKey.trim();
    const modelToUse = box.overrideModel || poolState.selectedModel;

    setPartBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, status: "generating", error: null } : b))
    );

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: box.text,
          voiceName: persona.baseVoice,
          model: modelToUse,
          apiKey,
          directorPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate voiceover");
      }

      const audioResult = {
        audioDataUrl: data.audioDataUrl,
        durationSeconds: data.durationSeconds,
        sampleRate: data.sampleRate,
        sizeBytes: data.sizeBytes,
        model: data.model,
      };

      await saveAudioToStorage(box.id, audioResult, persona.id, box.text);

      const updatedPool = recordGenerationUsage(
        poolState,
        activeProject.id,
        modelToUse,
        data.usageMetadata?.totalTokenCount || 0,
        data.durationSeconds || 0
      );
      onUpdatePoolState(updatedPool);

      setPartBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId ? { ...b, status: "completed", audioResult } : b
        )
      );

      try {
        const smartName = generateSmartTitle(
          box.text,
          `${persona.name} Part ${box.partNumber}`
        );
        await saveAudioToQueue({
          id: boxId,
          name: smartName,
          sourceTab: "studio",
          durationSeconds: audioResult.durationSeconds,
          sizeBytes: audioResult.sizeBytes,
          dataUrl: audioResult.audioDataUrl,
          format: "wav",
        });
      } catch (err) {
        console.warn("Failed to save box to audio queue:", err);
      }
    } catch (err: any) {
      setPartBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId ? { ...b, status: "error", error: err.message } : b
        )
      );
    }
  };

  // Batch Generate
  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return;
    setIsBatchGenerating(true);

    const pending = partBoxes.filter((b) => !b.audioResult?.audioDataUrl);
    for (const box of pending) {
      await handleGenerateBox(box.id);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    setIsBatchGenerating(false);
  };

  // Playback control
  const togglePlayBox = (boxId: string, audioUrl?: string) => {
    if (!audioUrl) return;

    if (playingBoxId === boxId) {
      audioPlayerRef.current?.pause();
      setPlayingBoxId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play();
        setPlayingBoxId(boxId);
      }
    }
  };

  // Delete Box (aakhiri box delete par ek khaali box wapas — default single box)
  const handleDeleteBox = async (boxId: string) => {
    await deleteAudioFromStorage(boxId);
    setPartBoxes((prev) => {
      const next = prev.filter((b) => b.id !== boxId);
      return next.length > 0 ? renumberBoxes(next) : [createEmptyBox(1)];
    });
  };

  // Reset Studio (default single empty box par wapas)
  const handleResetStudio = async () => {
    if (confirm("Reset studio? This will clear all boxes and audio for this persona.")) {
      const boxIds = partBoxes.map((b) => b.id);
      await clearAllTTSDataForPersona(persona.id, boxIds);
      const fresh = [createEmptyBox(1)];
      setPartBoxes(fresh);
      saveBoxesToStorage(persona.id, fresh);
      setMasterResult(null);
    }
  };

  // Mastering & Concat Audio
  const handleMasterAudio = async () => {
    const readyBoxes = partBoxes.filter((b) => !!b.audioResult?.audioDataUrl);
    if (readyBoxes.length === 0) {
      alert("No generated audio chunks to master!");
      return;
    }

    setIsMastering(true);
    setMasterProgress("1/3: Reading sequential audio chunks...");

    try {
      const partsPayload = readyBoxes.map((b) => ({
        partNumber: b.partNumber,
        title: b.title,
        text: b.text,
        audioDataUrl: b.audioResult!.audioDataUrl,
        durationSeconds: b.audioResult!.durationSeconds,
      }));

      setMasterProgress("2/3: Applying FFmpeg noise reduction & loudness normalizer...");

      const payload = {
        parts: partsPayload,
        options: {
          mode: masterSettings.mode,
          silenceCut: masterSettings.silenceCut,
          noiseReduction: masterSettings.noiseReduction,
          toneMatch: masterSettings.toneMatch,
          loudnessNormalize: masterSettings.loudnessNormalize,
          bitrate: masterSettings.bitrate,
          generateSrt: masterSettings.generateSrt,
          scriptStyle: masterSettings.scriptStyle,
          groqApiKey: poolState.groqApiKey,
        },
        personaName: persona.name,
      };

      const res = await fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mastering failed");
      }

      setMasterProgress("3/3: Mastered audio complete!");
      setMasterResult({
        audioDataUrl: data.audioDataUrl,
        durationSeconds: data.durationSeconds,
        sizeBytes: data.sizeBytes,
        filename: data.filename,
        srtContent: data.srtContent,
        filtersApplied: data.filtersApplied,
      });

      // Automatically store Master audio & optional SRT in Asset Vault
      try {
        const firstPartText = partBoxes[0]?.text || "";
        const masterSmartTitle = generateSmartTitle(firstPartText, `${persona.name} Full Master`);
        await saveAudioToQueue({
          name: `${masterSmartTitle} (Master)`,
          sourceTab: "studio",
          durationSeconds: data.durationSeconds,
          sizeBytes: data.sizeBytes,
          dataUrl: data.audioDataUrl,
          format: masterSettings.mode === "raw_wav" ? "wav" : "mp3",
        });
        if (data.srtContent) {
          await saveSrtToQueue({
            name: `${masterSmartTitle}.srt`,
            sourceTab: "studio",
            srtContent: data.srtContent,
            durationSeconds: data.durationSeconds,
          });
        }
      } catch (vaultErr) {
        console.warn("Failed to save master result to vault:", vaultErr);
      }

      setIsMasterModalOpen(false);
    } catch (err: any) {
      alert(`Mastering Error: ${err.message}`);
    } finally {
      setIsMastering(false);
      setMasterProgress("");
    }
  };

  const totalWords = partBoxes.reduce((acc, b) => acc + b.wordCount, 0);
  const totalDurationEstimate = Math.round(totalWords / 2.2);
  const completedCount = partBoxes.filter((b) => !!b.audioResult?.audioDataUrl).length;

  const activeProject =
    poolState.projects.find((p) => p.id === poolState.activeProjectId) || poolState.projects[0];
  const remainingQuota = activeProject
    ? getRemainingRequests(activeProject, poolState.selectedModel, 10)
    : 0;

  return (
    <div className="space-y-6">
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingBoxId(null)}
        className="hidden"
      />

      {/* Setup: Voice, AI Model, API Project — sabse upar (header se yahan aaya) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs">
        <div className="min-w-0">
          <label className="block text-slate-500 font-semibold mb-1">Voice Character</label>
          <div className="flex items-center gap-1.5">
            <select
              value={persona.id}
              onChange={(e) => onSelectPersona(e.target.value)}
              className="min-w-0 flex-1 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-300 font-bold text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {Object.values(allPersonas).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.avatarEmoji ? `${p.avatarEmoji} ` : ""}{p.name} ({p.baseVoice})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenPersonaModal}
              className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 shrink-0"
              title="Edit or create voices"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <label className="text-slate-500 font-semibold mb-1 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" /> AI Model
          </label>
          <select
            value={poolState.selectedModel}
            onChange={(e) =>
              onUpdatePoolState({ ...poolState, selectedModel: e.target.value as any })
            }
            className="w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.badge}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="text-slate-500 font-semibold mb-1 flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-amber-600" /> API Project ({remainingQuota} left)
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={poolState.activeProjectId}
              onChange={(e) =>
                onUpdatePoolState({ ...poolState, activeProjectId: e.target.value })
              }
              className="min-w-0 flex-1 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {poolState.projects.map((proj) => {
                const rem = getRemainingRequests(proj, poolState.selectedModel, 10);
                return (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} ({rem} left)
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={onOpenKeys}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 shrink-0"
              title="Manage API keys & quotas"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Banner: Dynamic Persona Profile */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-sm shadow-amber-500/20 shrink-0 flex items-center justify-center bg-amber-50 text-3xl">
            {persona.avatarUrl ? (
              <Image
                src={persona.avatarUrl}
                alt={persona.name}
                fill
                className="object-cover"
              />
            ) : (
              <span>{persona.avatarEmoji || "🎙️"}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{persona.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                {persona.perceivedAge}y &bull; Voice: {persona.baseVoice}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{persona.pacingNote}</p>
          </div>
        </div>

        {/* Templates & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {persona.templates && persona.templates.length > 0 && (
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500 shadow-2xs"
            >
              <option value="" disabled>
                Load Preset Template...
              </option>
              {persona.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsSplitModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-300 shadow-2xs"
          >
            <Split className="w-3.5 h-3.5 text-amber-600" />
            <span>Paste & Split Script</span>
          </button>

          <button
            onClick={onOpenPersonaModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer border border-amber-200 shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Customize Character</span>
          </button>
        </div>
      </div>

      {/* Directorial Prompt Accordion */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Voice Directorial Instructions ({persona.name} &bull; Voice: {persona.baseVoice})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>{showPromptEditor ? "Hide Editor" : "View / Edit Prompt"}</span>
            {showPromptEditor ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {showPromptEditor && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
            <textarea
              value={directorPrompt}
              onChange={(e) => setDirectorPrompt(e.target.value)}
              rows={6}
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-amber-500 shadow-2xs"
            />
            <div className="flex justify-between items-center text-[11px] text-slate-500">
              <span>Steers emotion, cadence, pause placement, and vocal presence.</span>
              <button
                onClick={() => setDirectorPrompt(persona.directorPrompt)}
                className="text-amber-700 hover:underline"
              >
                Reset to {persona.name} default
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Production Telemetry & Action Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2 text-slate-600">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>
              Parts: <strong className="text-slate-900 font-bold">{partBoxes.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <FileText className="w-4 h-4 text-amber-600" />
            <span>
              Words: <strong className="text-slate-900 font-bold">{totalWords}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>
              Est. Audio:{" "}
              <strong className="text-slate-900 font-bold">~{Math.round(totalDurationEstimate / 60)} min</strong>{" "}
              ({totalDurationEstimate}s)
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Rendered:{" "}
              <strong className="text-emerald-700 font-bold">
                {completedCount} / {partBoxes.length}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {partBoxes.length > 0 && (
            <button
              onClick={handleResetStudio}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Reset Studio (Clear all boxes & audio)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleBatchGenerate}
            disabled={isBatchGenerating || partBoxes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-slate-300 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{isBatchGenerating ? "Generating All..." : "Batch Generate Pending"}</span>
          </button>

          <button
            onClick={handleAddBox}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-dashed border-slate-400 transition-colors shadow-2xs cursor-pointer"
            title="Add a new empty script box"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Box</span>
          </button>

          {completedCount >= 2 && onSendToMerger && (
            <button
              onClick={() => {
                const ready: PipelineVoiceoverPart[] = partBoxes
                  .filter((b) => !!b.audioResult?.audioDataUrl)
                  .map((b) => ({
                    id: b.id,
                    partNumber: b.partNumber,
                    title: b.title,
                    dataUrl: b.audioResult!.audioDataUrl,
                    durationSeconds: b.audioResult!.durationSeconds,
                  }));
                onSendToMerger(ready);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Merge className="w-3.5 h-3.5" />
              <span>Send {completedCount} Parts to {ft.merger} ➔</span>
            </button>
          )}

          {completedCount === 1 && onSendToCleaner && (
            <button
              onClick={() => {
                const single = partBoxes.find((b) => !!b.audioResult?.audioDataUrl);
                if (single && single.audioResult) {
                  onSendToCleaner(
                    single.audioResult.audioDataUrl,
                    `${persona.id}_part_${single.partNumber}.wav`
                  );
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Send to {ft.cleaner} ➔</span>
            </button>
          )}

          <button
            onClick={() => setIsMasterModalOpen(true)}
            disabled={completedCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Master In Studio</span>
          </button>
        </div>
      </div>

      {/* Master Audio Result Banner */}
      {masterResult && (
        <div className="p-5 rounded-2xl bg-white border border-emerald-300 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Mastered Voiceover Audio Ready
                </h4>
                <p className="text-xs text-slate-600">
                  Duration: {Math.round(masterResult.durationSeconds)}s &bull; Size:{" "}
                  {(masterResult.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onSendToCleaner && (
                <button
                  onClick={() => onSendToCleaner(masterResult.audioDataUrl, masterResult.filename)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>Send to {ft.cleaner} ➔</span>
                </button>
              )}

              {onSendToTranscribe && (
                <button
                  onClick={() =>
                    onSendToTranscribe(
                      masterResult.audioDataUrl,
                      masterResult.filename,
                      partBoxes.map((b) => b.text).join("\n\n")
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Send to {ft.transcribe} ➔</span>
                </button>
              )}

              <a
                href={masterResult.audioDataUrl}
                download={masterResult.filename}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Audio</span>
              </a>

              {masterResult.srtContent && (
                <button
                  onClick={() => setIsSrtModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>View Subtitles (.SRT)</span>
                </button>
              )}
            </div>
          </div>

          <StudioAudioPlayer
            src={masterResult.audioDataUrl}
            title={masterResult.filename}
            downloadFilename={masterResult.filename}
          />

          {masterResult.filtersApplied && masterResult.filtersApplied.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {masterResult.filtersApplied.map((f, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 font-medium shadow-2xs"
                >
                  &check; {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Part Boxes List — Part 1 (driver) sabse upar, uske neeche chunk strip, phir baaki boxes */}
      <div className="space-y-4">
        {partBoxes.map((box, boxIdx) => {
          const hasAudio = !!box.audioResult?.audioDataUrl;
          const isPlayingThis = playingBoxId === box.id;
          const currentBoxModel = box.overrideModel || poolState.selectedModel;
          const currentBoxProjId = box.overrideProjectId || poolState.activeProjectId;
          const bl = getTTSLimits(currentBoxModel);

          return (
            <React.Fragment key={box.id}>
            <div
              className={`p-4 rounded-xl border transition-all ${
                hasAudio
                  ? "bg-white border-amber-300 shadow-xs"
                  : "bg-white border-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-800">
                    {box.partNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{box.title}</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({box.wordCount} words &bull; {box.charCount.toLocaleString("en-IN")} chars &bull; ~{box.estimatedSeconds}s)
                  </span>
                </div>

                {/* Box Actions & Selectors */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Inline Model Selector for Box */}
                  <select
                    value={currentBoxModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartBoxes((prev) =>
                        prev.map((b) =>
                          b.id === box.id ? { ...b, overrideModel: val } : b
                        )
                      );
                    }}
                    className="max-w-full text-[11px] px-2 py-1 rounded bg-slate-50 border border-slate-300 text-slate-700 focus:outline-none"
                    title="TTS Model for this box"
                  >
                    {TTS_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name.replace("Gemini ", "")}
                      </option>
                    ))}
                  </select>

                  {/* Inline Key Selector for Box */}
                  <select
                    value={currentBoxProjId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartBoxes((prev) =>
                        prev.map((b) =>
                          b.id === box.id ? { ...b, overrideProjectId: val } : b
                        )
                      );
                    }}
                    className="max-w-full text-[11px] px-2 py-1 rounded bg-slate-50 border border-slate-300 text-slate-700 focus:outline-none"
                    title="API Key for this box"
                  >
                    {poolState.projects.map((p) => {
                      const rem = getRemainingRequests(p, currentBoxModel, 10);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({rem}/10)
                        </option>
                      );
                    })}
                  </select>

                  {hasAudio && (
                    <button
                      onClick={() => togglePlayBox(box.id, box.audioResult?.audioDataUrl)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                    >
                      {isPlayingThis ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlayingThis ? "Pause" : "Play"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleGenerateBox(box.id)}
                    disabled={box.status === "generating"}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      hasAudio
                        ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300"
                        : "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>
                      {box.status === "generating"
                        ? "Synthesizing..."
                        : hasAudio
                        ? "Re-Generate"
                        : "Generate Voice"}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDeleteBox(box.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    title="Delete box"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chunk Size strip — model select aur input box ke beech me.
                  Part 1 ke model dropdown se linked: dropdown badlo, limits auto badlegi. */}
              {boxIdx === 0 && (
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex flex-wrap justify-between items-center gap-1 text-xs text-slate-700">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Split className="w-3.5 h-3.5 text-amber-600" />
                      Words Per Part <span className="font-normal text-slate-500">(Part 1 • {driverLimits.modelName})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <strong className="text-amber-700 font-bold text-sm">
                        {targetWordsPerPart} words (~{Math.round(targetWordsPerPart / 2.5)}s audio)
                      </strong>
                      <button
                        onClick={() => { if (partBoxes.length > 0) handleSplitBox(partBoxes[0].id); }}
                        disabled={splitPreviewCount <= 1}
                        title={splitPreviewCount > 1 ? `Part 1 ka script ek click me ${splitPreviewCount} parts me baanto` : "Pehle Part 1 me script paste karo"}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>{splitPreviewCount > 1 ? `Split Now (→ ${splitPreviewCount} parts)` : "Split Now"}</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={180}
                    max={sliderMax}
                    step={10}
                    value={Math.min(targetWordsPerPart, sliderMax)}
                    onChange={(e) => setTargetWordsPerPart(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Fast Reel (~180 words)</span>
                    <span className="text-amber-800 font-semibold">{driverLimits.modelName} default (~{driverLimits.targetWords} words)</span>
                    <span>Long-form (~{sliderMax} words)</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    {driverLimits.note} Neeche content paste karo — split isi setting se katega.
                  </p>
                </div>
              )}

              {/* Script Text Area */}
              <div className="pt-3">
                <textarea
                  value={box.text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    const words = newText.trim().split(/\s+/).filter(Boolean).length;
                    setPartBoxes((prev) =>
                      prev.map((b) =>
                        b.id === box.id
                          ? {
                              ...b,
                              text: newText,
                              wordCount: words,
                              charCount: newText.length,
                              estimatedSeconds: Math.round(words / 2.2),
                            }
                          : b
                      )
                    );
                  }}
                  rows={4}
                  placeholder="Yahan apna script likho ya paste karo — jitne chaaho utne words. Safe limit cross hogi to neeche split option aa jayega."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                />
              </div>

              {/* Over-limit warning + optional split (generate block nahi hota).
                  Limit box ke effective model ke hisab se (official docs based). */}
              {box.wordCount > bl.maxWords && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium leading-relaxed">
                    ⚠️ Over the safe limit for {bl.modelName}: <strong>{box.wordCount} words</strong> (safe ~{bl.maxWords} words/part).
                    {bl.note} Split into parts if you like —
                    or ignore this warning and Generate from this box as-is.
                  </span>
                  <button
                    onClick={() => handleSplitBox(box.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    title="Split this box's script into safe multiple parts at sentence boundaries"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Split in multiple parts</span>
                  </button>
                </div>
              )}

              {/* Server hard cap: 15,000 chars se upar Generate pakka fail hoga — split required */}
              {box.charCount > TTS_CHAR_LIMIT && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium leading-relaxed">
                    ⛔ <strong>{box.charCount.toLocaleString("en-IN")} characters</strong> — the server accepts max 15,000 per request,
                    so Generate will fail for this box. Split it into parts first, then use Batch Generate.
                  </span>
                  <button
                    onClick={() => handleSplitBox(box.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    title="Split this box into parts that fit the 15,000 character server limit"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Split to fit limit</span>
                  </button>
                </div>
              )}

              {/* Audio Status Footer & Player */}
              {hasAudio && box.audioResult && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                  <StudioAudioPlayer
                    src={box.audioResult.audioDataUrl}
                    title={`Part ${box.partNumber} - ${box.title}`}
                    downloadFilename={`part_${box.partNumber}_${persona.id}.wav`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-700">Ready ({Math.round(box.audioResult.durationSeconds)}s)</span>
                      <span>&bull;</span>
                      <span className="font-mono text-slate-600">{box.audioResult.model}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onSendToCleaner && (
                        <button
                          onClick={() =>
                            onSendToCleaner(
                              box.audioResult!.audioDataUrl,
                              `part_${box.partNumber}_${persona.id}.wav`
                            )
                          }
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          title="Send this part directly to Audio Cleaner"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Send to {ft.cleaner} ➔</span>
                        </button>
                      )}
                      {onSendToTranscribe && (
                        <button
                          onClick={() =>
                            onSendToTranscribe(
                              box.audioResult!.audioDataUrl,
                              `part_${box.partNumber}_${persona.id}.wav`,
                              box.text
                            )
                          }
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          title="Send this part directly to Audio to SRT"
                        >
                          <FileText className="w-3 h-3 text-slate-600" />
                          <span>Send to {ft.transcribe} ➔</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {box.error && (
                <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{box.error}</span>
                </div>
              )}
            </div>
            </React.Fragment>
          );
        })}

        {/* Add another script box */}
        <button
          onClick={handleAddBox}
          className="w-full p-3 rounded-xl border border-dashed border-slate-300 bg-white/60 hover:bg-white hover:border-emerald-400 text-slate-500 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add another script box</span>
        </button>
      </div>

      {/* Modal 1: Split Long Script */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Split className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Smart Script Chunker & Splitter
                </h3>
              </div>
              <button
                onClick={() => setIsSplitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs">
              {/* Chunk setting Part 1 ke neeche wale slider se aati hai — yahan sirf display */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold">Splitting at ~{targetWordsPerPart} words/part (Part 1 • {driverLimits.modelName})</span>
                <span className="text-[10.5px] text-slate-500">Adjust in slider under Part 1</span>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Paste Full Long Script (Any length — 10 to 60+ minutes)
                </label>
                <textarea
                  value={rawScriptInput}
                  onChange={(e) => setRawScriptInput(e.target.value)}
                  rows={10}
                  placeholder="Paste your full Hindi / Hinglish script here. The smart chunker splits strictly at sentence full-stops (. ? ! ।) to prevent audio quality decay..."
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/70">
              <button
                onClick={() => setIsSplitModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitScript}
                disabled={!rawScriptInput.trim()}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                Split Into Parts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Master Audio Settings */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900">
                  FFmpeg Audio Mastering & Subtitle Export
                </h3>
              </div>
              <button
                onClick={() => setIsMasterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs text-slate-700">
              <p className="text-slate-500 leading-relaxed">
                Parts are joined with a zero-drift sequential algorithm, mic hiss is removed,
                and loudness is calibrated to YouTube / podcast standards.
              </p>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterSettings.noiseReduction}
                    onChange={(e) =>
                      setMasterSettings({ ...masterSettings, noiseReduction: e.target.checked })
                    }
                    className="accent-amber-600"
                  />
                  <span>FFT Noise Reduction (`afftdn`) + 80Hz Highpass Rumble Filter</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterSettings.loudnessNormalize}
                    onChange={(e) =>
                      setMasterSettings({ ...masterSettings, loudnessNormalize: e.target.checked })
                    }
                    className="accent-amber-600"
                  />
                  <span>EBU R128 Loudness Normalization (-14 LUFS)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterSettings.silenceCut}
                    onChange={(e) =>
                      setMasterSettings({ ...masterSettings, silenceCut: e.target.checked })
                    }
                    className="accent-amber-600"
                  />
                  <span>Silence Gap Trimmer (Cuts pauses &gt; 0.5s)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterSettings.generateSrt}
                    onChange={(e) =>
                      setMasterSettings({ ...masterSettings, generateSrt: e.target.checked })
                    }
                    className="accent-amber-600"
                  />
                  <span className="font-semibold text-slate-900">
                    Auto-Generate Romanized Hinglish Subtitles (.SRT 5–8 words)
                  </span>
                </label>
              </div>

              {masterSettings.generateSrt && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-slate-600 font-medium mb-1">
                    Subtitle Script Style
                  </label>
                  <select
                    value={masterSettings.scriptStyle}
                    onChange={(e) =>
                      setMasterSettings({ ...masterSettings, scriptStyle: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none"
                  >
                    <option value="roman">Hinglish (Roman Letters - &ldquo;Namaste dosto...&rdquo;)</option>
                    <option value="devanagari">Pure Hindi (Devanagari - &ldquo;नमस्ते दोस्तों...&rdquo;)</option>
                    <option value="english">English Translation</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/70">
              <span className="text-xs text-slate-500 font-mono break-all">{masterProgress}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMasterModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMasterAudio}
                  disabled={isMastering}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMastering ? "Processing FFmpeg..." : "Start Mastering"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View SRT Subtitles */}
      {isSrtModalOpen && masterResult?.srtContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900">Generated Subtitles (.SRT)</h3>
              </div>
              <button
                onClick={() => setIsSrtModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 bg-slate-50/40 overflow-y-auto">
              <textarea
                readOnly
                value={masterResult.srtContent}
                className="w-full h-80 bg-transparent text-xs font-mono text-slate-800 resize-none focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/70">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(masterResult.srtContent || "");
                  setCopiedSrt(true);
                  setTimeout(() => setCopiedSrt(false), 1500);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedSrt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSrt ? "Copied" : "Copy"}</span>
              </button>

              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(masterResult.srtContent)}`}
                download={`${persona.id}_subtitles.srt`}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .SRT</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
