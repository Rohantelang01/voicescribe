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

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("studio");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [poolState, setPoolState] = useState<TTSPoolState | null>(null);

  // Dynamic Personas State
  const [allPersonas, setAllPersonas] = useState<Record<string, PersonaConfig>>(DEFAULT_PERSONAS);
  const [activePersonaId, setActivePersonaId] = useState<string>(DEFAULT_PERSONA_ID);

  // Connected Studio Pipeline State
  const [pipelineVoiceoverParts, setPipelineVoiceoverParts] = useState<PipelineVoiceoverPart[]>([]);
  const [pipelineAudioFile, setPipelineAudioFile] = useState<File | null>(null);
  const [pipelineAudioSource, setPipelineAudioSource] = useState<string | null>(null);
  const [pipelineSrt, setPipelineSrt] = useState<string | null>(null);

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
        Initializing Audio Studio...
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

  const handleSendAudioToTranscribe = (audioDataUrlOrFile: string | File, filename?: string) => {
    if (typeof audioDataUrlOrFile === "string") {
      const file = dataUrlToFile(audioDataUrlOrFile, filename || "cleaned_audio.mp3");
      setPipelineAudioFile(file);
    } else {
      setPipelineAudioFile(audioDataUrlOrFile);
    }
    setPipelineAudioSource("Audio Cleaner");
    setActiveTab("transcribe");
  };

  const handleSendSrtToCleaner = (srtContent: string) => {
    setPipelineSrt(srtContent);
    setActiveTab("srt-cleaner");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-900">
      {/* Header with Quick Dropdowns */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenKeys={() => setIsKeyModalOpen(true)}
        poolState={poolState}
        onUpdatePoolState={setPoolState}
        activePersona={activePersona}
        allPersonas={allPersonas}
        onSelectPersona={setActivePersonaId}
        onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
      />

      {/* Studio Workspace with Persistent Left Sidebar Asset Vault */}
      <div className="flex-1 flex overflow-hidden">
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

        {/* Main Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto">
          {activeTab === "studio" && (
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
          )}

          {activeTab === "merger" && (
            <AudioMergerTab
              initialVoiceoverParts={pipelineVoiceoverParts}
              onSendToCleaner={handleSendAudioToCleaner}
              onSendToTranscribe={handleSendAudioToTranscribe}
            />
          )}

          {activeTab === "cleaner" && (
            <AudioCleanerTab
              initialFile={pipelineAudioFile}
              initialSourceLabel={pipelineAudioSource}
              onSendToTranscribe={handleSendAudioToTranscribe}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
            />
          )}

          {activeTab === "transcribe" && (
            <AudioToSrtTab
              poolState={poolState}
              onOpenKeys={() => setIsKeyModalOpen(true)}
              initialFile={pipelineAudioFile}
              initialSourceLabel={pipelineAudioSource}
              initialSrt={pipelineSrt}
              onSendToSrtCleaner={handleSendSrtToCleaner}
            />
          )}

          {activeTab === "srt-cleaner" && (
            <SrtCleanerTab initialSrt={pipelineSrt} />
          )}
        </main>
      </div>

      {/* Footer / System Status */}
      <footer className="border-t border-slate-200 bg-white/90 py-4 text-xs text-slate-500">
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
