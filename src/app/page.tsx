"use client";

import React, { useState, useEffect } from "react";
import Header, { ActiveTab } from "@/components/Header";
import ApiKeyModal from "@/components/ApiKeyModal";
import PersonaModal from "@/components/PersonaModal";
import AudioHistoryModal from "@/components/AudioHistoryModal";
import LeftSidebarVault from "@/components/LeftSidebarVault";
import StudioTab from "@/components/StudioTab";
import AudioToSrtTab from "@/components/AudioToSrtTab";
import AudioCleanerTab from "@/components/AudioCleanerTab";
import AudioMergerTab from "@/components/AudioMergerTab";
import SrtCleanerTab from "@/components/SrtCleanerTab";
import { TTSPoolState, loadTTSPoolState } from "@/lib/tts-projects";
import {
  PersonaConfig,
  loadPersonas,
  DEFAULT_PERSONAS,
  DEFAULT_PERSONA_ID,
} from "@/lib/personas";
import { PipelineVoiceoverPart, dataUrlToFile } from "@/lib/pipeline-store";
import {
  savePipelineText,
  savePipelineFiles,
  loadPipelineSession,
} from "@/lib/pipeline-persist";

const VALID_TABS: ActiveTab[] = ["studio", "merger", "cleaner", "transcribe", "srt-cleaner"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("studio");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [poolState, setPoolState] = useState<TTSPoolState | null>(null);

  // Dynamic Personas State
  const [allPersonas, setAllPersonas] = useState<Record<string, PersonaConfig>>(DEFAULT_PERSONAS);
  // Last selected character persist — reload par Arya default nahi, wahi khulega
  const [activePersonaId, setActivePersonaId] = useState<string>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("voicescribe.activePersonaId");
        if (saved) return saved;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_PERSONA_ID;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("voicescribe.activePersonaId", activePersonaId);
    } catch {
      /* ignore */
    }
  }, [activePersonaId]);

  // Connected Studio Pipeline State
  const [pipelineVoiceoverParts, setPipelineVoiceoverParts] = useState<PipelineVoiceoverPart[]>([]);
  const [pipelineAudioFile, setPipelineAudioFile] = useState<File | null>(null);
  const [pipelineAudioSource, setPipelineAudioSource] = useState<string | null>(null);
  const [pipelineSrt, setPipelineSrt] = useState<string | null>(null);
  // SRT Cleaner bundle: exact script (studio se aaye to auto, warna user paste karega)
  const [pipelineScript, setPipelineScript] = useState<string | null>(null);
  const [pipelineScriptLabel, setPipelineScriptLabel] = useState<string | null>(null);
  // SRT Cleaner bundle: SRT ke saath uska audio
  const [pipelineSrtAudio, setPipelineSrtAudio] = useState<File | null>(null);
  const [pipelineSrtAudioLabel, setPipelineSrtAudioLabel] = useState<string | null>(null);

  // Reload-proof session: restore hone tak save mat karo (khaali overwrite se bachao)
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    loadPipelineSession().then((snap) => {
      if (snap) {
        if (snap.srt) setPipelineSrt(snap.srt);
        if (snap.srtAudioLabel) setPipelineSrtAudioLabel(snap.srtAudioLabel);
        if (snap.script) {
          setPipelineScript(snap.script);
          setPipelineScriptLabel(snap.scriptLabel);
        }
        if (snap.audioSource) setPipelineAudioSource(snap.audioSource);
        if (snap.mainAudioFile) setPipelineAudioFile(snap.mainAudioFile);
        if (snap.srtAudioFile) setPipelineSrtAudio(snap.srtAudioFile);
        if (snap.activeTab && (VALID_TABS as string[]).includes(snap.activeTab)) {
          setActiveTab(snap.activeTab as ActiveTab);
        }
      }
      setSessionReady(true);
    });
  }, []);

  // Har pipeline change par session persist (reload ke baad sab wapas)
  useEffect(() => {
    if (!sessionReady) return;
    savePipelineText({
      srt: pipelineSrt,
      srtAudioLabel: pipelineSrtAudioLabel,
      srtAudioName: pipelineSrtAudio?.name || null,
      srtAudioType: pipelineSrtAudio?.type || null,
      script: pipelineScript,
      scriptLabel: pipelineScriptLabel,
      audioSource: pipelineAudioSource,
      audioName: pipelineAudioFile?.name || null,
      audioType: pipelineAudioFile?.type || null,
      activeTab,
    });
    savePipelineFiles(pipelineAudioFile, pipelineSrtAudio);
  }, [
    sessionReady,
    pipelineSrt,
    pipelineSrtAudio,
    pipelineSrtAudioLabel,
    pipelineScript,
    pipelineScriptLabel,
    pipelineAudioFile,
    pipelineAudioSource,
    activeTab,
  ]);

  useEffect(() => {
    const loadedPool = loadTTSPoolState();
    setPoolState(loadedPool);

    const loadedPersonas = loadPersonas();
    setAllPersonas(loadedPersonas);
    if (!loadedPersonas[activePersonaId]) {
      setActivePersonaId(Object.keys(loadedPersonas)[0] || DEFAULT_PERSONA_ID);
    }
  }, []);

  if (!poolState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
        Initializing VoiceScribe...
      </div>
    );
  }

  const activePersona = allPersonas[activePersonaId] || DEFAULT_PERSONAS[DEFAULT_PERSONA_ID];
  const activeProject =
    poolState.projects.find((p) => p.id === poolState.activeProjectId) || poolState.projects[0];

  const handlePersonasChange = (
    updatedPersonas: Record<string, PersonaConfig>,
    newActiveId: string
  ) => {
    setAllPersonas(updatedPersonas);
    setActivePersonaId(newActiveId);
  };

  // ─── Pipeline Handoff Handlers ────────────────────────────────
  const handleSendPartsToMerger = (parts: PipelineVoiceoverPart[]) => {
    setPipelineVoiceoverParts(parts);
    setActiveTab("merger");
  };

  const handleSendAudioToCleaner = (audioDataUrlOrFile: string | File, filename?: string) => {
    if (typeof audioDataUrlOrFile === "string") {
      const file = dataUrlToFile(audioDataUrlOrFile, filename || "studio_voiceover.wav");
      setPipelineAudioFile(file);
    } else {
      setPipelineAudioFile(audioDataUrlOrFile);
    }
    setPipelineAudioSource("Studio / Merger");
    setActiveTab("cleaner");
  };

  const handleSendAudioToTranscribe = (audioDataUrlOrFile: string | File, filename?: string, scriptText?: string) => {
    if (typeof audioDataUrlOrFile === "string") {
      const file = dataUrlToFile(audioDataUrlOrFile, filename || "cleaned_audio.mp3");
      setPipelineAudioFile(file);
    } else {
      setPipelineAudioFile(audioDataUrlOrFile);
    }
    setPipelineAudioSource("Audio Cleaner");
    // Studio se script aayi to rakho, warna purani script stale ho jayegi — clear karo
    setPipelineScript(scriptText || null);
    setPipelineScriptLabel(scriptText ? "Studio voice script" : null);
    setActiveTab("transcribe");
  };

  const handleSendSrtToCleaner = (srtContent: string, audioFile?: File | null, audioLabel?: string | null, scriptText?: string | null) => {
    setPipelineSrt(srtContent);
    setPipelineSrtAudio(audioFile || null);
    setPipelineSrtAudioLabel(audioLabel || null);
    // Linked script bhi saath travel karegi (SRT+audio+script ka package).
    // Koi script nahi aayi to purani clear — dusre context ki stale script chipakna nahi chahiye.
    setPipelineScript(scriptText || null);
    setPipelineScriptLabel(scriptText ? "Linked script" : null);
    setActiveTab("srt-cleaner");
  };

  const handleClearCleanerScript = () => {
    setPipelineScript(null);
    setPipelineScriptLabel(null);
  };

  return (
    <div className="h-dvh bg-slate-50 text-slate-800 flex flex-col overflow-hidden font-sans selection:bg-amber-500/20 selection:text-amber-900">
      {/* Header with logo, tabs + key icon (all pickers live inside tabs now) */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenKeys={() => setIsKeyModalOpen(true)}
        showKeyWarning={
          !poolState.projects.some((p) => !!p.apiKey.trim()) || !poolState.groqApiKey?.trim()
        }
      />

      {/* Studio Workspace: fixed 100% body — vault + content, dono ke apne scroll */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Persistent Left Sidebar Asset Vault (Max 20 Audios & Max 20 SRTs) */}
        <LeftSidebarVault
          currentActiveTab={activeTab}
          onLoadAudioToTab={(item, targetTab) => {
            if (targetTab === "cleaner") {
              handleSendAudioToCleaner(item.dataUrl, `${item.name}.mp3`);
            } else if (targetTab === "transcribe") {
              handleSendAudioToTranscribe(item.dataUrl, `${item.name}.mp3`);
            } else if (targetTab === "merger") {
              setActiveTab("merger");
            }
          }}
          onLoadSrtToTab={(item, targetTab) => {
            if (targetTab === "transcribe") {
              setPipelineSrt(item.srtContent);
              setActiveTab("transcribe");
            } else if (targetTab === "srt-cleaner") {
              setPipelineSrt(item.srtContent);
              setActiveTab("srt-cleaner");
            }
          }}
        />

        {/* Main Content Container — saare tabs MOUNTED rehte hain (hidden),
            taaki tab switch karne par chalti task (transcribe/transform) terminate na ho.
            display:none me timer/XHR/fetch background me chalte rehte hain. */}
        <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto overscroll-contain">
          <div className={activeTab === "studio" ? "" : "hidden"}>
            <StudioTab
              poolState={poolState}
              onUpdatePoolState={setPoolState}
              onOpenKeys={() => setIsKeyModalOpen(true)}
              persona={activePersona}
              allPersonas={allPersonas}
              onSelectPersona={setActivePersonaId}
              onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
              onSendToMerger={handleSendPartsToMerger}
              onSendToCleaner={handleSendAudioToCleaner}
              onSendToTranscribe={handleSendAudioToTranscribe}
            />
          </div>

          <div className={activeTab === "merger" ? "" : "hidden"}>
            <AudioMergerTab
              initialVoiceoverParts={pipelineVoiceoverParts}
              onSendToCleaner={handleSendAudioToCleaner}
              onSendToTranscribe={handleSendAudioToTranscribe}
            />
          </div>

          <div className={activeTab === "cleaner" ? "" : "hidden"}>
            <AudioCleanerTab
              initialFile={pipelineAudioFile}
              initialSourceLabel={pipelineAudioSource}
              onSendToTranscribe={handleSendAudioToTranscribe}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
            />
          </div>

          <div className={activeTab === "transcribe" ? "" : "hidden"}>
            <AudioToSrtTab
              poolState={poolState}
              onOpenKeys={() => setIsKeyModalOpen(true)}
              initialFile={pipelineAudioFile}
              initialSourceLabel={pipelineAudioSource}
              initialSrt={pipelineSrt}
              initialScript={pipelineScript}
              onSendToSrtCleaner={handleSendSrtToCleaner}
              onManualFileSelect={handleClearCleanerScript}
            />
          </div>

          <div className={activeTab === "srt-cleaner" ? "" : "hidden"}>
            <SrtCleanerTab
              poolState={poolState}
              onOpenKeys={() => setIsKeyModalOpen(true)}
              initialSrt={pipelineSrt}
              initialAudioFile={pipelineSrtAudio}
              initialAudioLabel={pipelineSrtAudioLabel}
              initialScript={pipelineScript}
              initialScriptLabel={pipelineScriptLabel}
              onClearScript={handleClearCleanerScript}
              onStartNewProject={() => setActiveTab("studio")}
            />
          </div>
        </main>
      </div>

      {/* Footer / System Status */}
      <footer className="shrink-0 border-t border-slate-200 bg-white/90 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Local FFmpeg Signal Engine Active</span>
            <span>&bull;</span>
            <span>
              Voice Character:{" "}
              <strong className="text-slate-800 font-semibold">{activePersona.name}</strong> ({activePersona.baseVoice})
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>
              Active Project: <strong className="text-slate-700">{activeProject?.name}</strong>
            </span>
            <span>
              TTS Model: <span className="font-mono text-slate-700">{poolState.selectedModel}</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Modal 1: API Keys Configuration Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        poolState={poolState}
        onSaveState={setPoolState}
      />

      {/* Modal 2: Custom Persona Builder Modal */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        currentPersona={activePersona}
        allPersonas={allPersonas}
        onPersonasChange={handlePersonasChange}
        poolState={poolState}
        onOpenKeys={() => setIsKeyModalOpen(true)}
      />

      {/* Modal 3: Local Audio Stack History Modal (Max 20 FIFO) */}
      <AudioHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectForCleaner={handleSendAudioToCleaner}
        onSelectForTranscribe={handleSendAudioToTranscribe}
      />
    </div>
  );
}
