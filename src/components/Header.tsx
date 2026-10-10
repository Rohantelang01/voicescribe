"use client";

import React from "react";
import Image from "next/image";
import { Mic, FileText, Sparkles, Merge, Key, Scissors, Cpu, User, History } from "lucide-react";
import { PersonaConfig } from "@/lib/personas";
import { TTSPoolState, TTS_MODELS, getRemainingRequests } from "@/lib/tts-projects";

export type ActiveTab = "studio" | "transcribe" | "cleaner" | "merger" | "srt-cleaner";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenKeys: () => void;
  onOpenHistory?: () => void;
  poolState: TTSPoolState;
  onUpdatePoolState: (state: TTSPoolState) => void;
  activePersona: PersonaConfig;
  allPersonas: Record<string, PersonaConfig>;
  onSelectPersona: (personaId: string) => void;
  onOpenPersonaModal: () => void;
}

export default function Header({
  activeTab,
  onTabChange,
  onOpenKeys,
  onOpenHistory,
  poolState,
  onUpdatePoolState,
  activePersona,
  allPersonas,
  onSelectPersona,
  onOpenPersonaModal,
}: HeaderProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "studio", label: "1. Voiceover Studio", icon: <Mic className="w-4 h-4" /> },
    { id: "merger", label: "2. Audio Merger", icon: <Merge className="w-4 h-4" /> },
    { id: "cleaner", label: "3. Audio Cleaner", icon: <Sparkles className="w-4 h-4" /> },
    { id: "transcribe", label: "4. Audio to SRT", icon: <FileText className="w-4 h-4" /> },
    { id: "srt-cleaner", label: "5. SRT Cleaner", icon: <Scissors className="w-4 h-4" /> },
  ];

  const activeProject =
    poolState.projects.find((p) => p.id === poolState.activeProjectId) || poolState.projects[0];
  const hasGeminiKey = poolState.projects.some((p) => !!p.apiKey.trim());
  const hasGroqKey = !!poolState.groqApiKey?.trim();
  const remaining = activeProject
    ? getRemainingRequests(activeProject, poolState.selectedModel, 10)
    : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-2.5 gap-3">
          {/* Top Row: Logo & Quick Switchers */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-sm shadow-amber-500/30">
                🎙️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-slate-900">Audio Studio</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Open Source
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  FFmpeg Audio Engine &bull; Multi-Key Gemini TTS &bull; Groq Whisper
                </p>
              </div>
            </div>

            {/* Mobile API Keys Button */}
            <button
              onClick={onOpenKeys}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>Keys</span>
            </button>
          </div>

          {/* Direct Quick Selectors: Persona, Key & Model */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Quick Character Picker */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1 shadow-2xs">
              <span className="text-sm pl-1">{activePersona.avatarEmoji || "🎙️"}</span>
              <select
                value={activePersona.id}
                onChange={(e) => onSelectPersona(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-1 text-xs"
              >
                {Object.values(allPersonas).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.baseVoice})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenPersonaModal}
                className="p-1 text-slate-400 hover:text-amber-700 rounded hover:bg-slate-200/60"
                title="Edit or create personas"
              >
                <User className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Gemini Project / Key Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <select
                value={poolState.activeProjectId}
                onChange={(e) =>
                  onUpdatePoolState({ ...poolState, activeProjectId: e.target.value })
                }
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs"
              >
                {poolState.projects.map((proj) => {
                  const rem = getRemainingRequests(proj, poolState.selectedModel, 10);
                  return (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({rem}/10)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Model Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              <select
                value={poolState.selectedModel}
                onChange={(e) =>
                  onUpdatePoolState({ ...poolState, selectedModel: e.target.value as any })
                }
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs"
              >
                {TTS_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.replace("Gemini ", "")}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Stack History Modal Button */}
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300 text-xs font-bold text-amber-900 transition-colors shadow-2xs cursor-pointer"
                title="View saved local audios (Max 20 queue in IndexedDB)"
              >
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>Audio Stack</span>
              </button>
            )}

            {/* Full Keys Config Modal Button */}
            <button
              onClick={onOpenKeys}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="Add unlimited Gemini keys & Groq key"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>Keys</span>
              {(!hasGeminiKey || !hasGroqKey) && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-amber-500 text-white shadow-xs shadow-amber-500/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === "studio" && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-amber-600 text-amber-50" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {activePersona.name.split(" ")[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
