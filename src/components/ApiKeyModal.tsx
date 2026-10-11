"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  Cpu,
  Plus,
  Trash2,
  Edit2,
  CheckCheck,
} from "lucide-react";
import {
  TTSPoolState,
  TTS_MODELS,
  saveTTSPoolState,
  validateApiKeyUniqueness,
  getRemainingRequests,
  createNewProject,
} from "@/lib/tts-projects";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolState: TTSPoolState;
  onSaveState: (newState: TTSPoolState) => void;
}

export default function ApiKeyModal({
  isOpen,
  onClose,
  poolState,
  onSaveState,
}: ApiKeyModalProps) {
  const [localState, setLocalState] = useState<TTSPoolState>(poolState);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  useEffect(() => {
    setLocalState(poolState);
  }, [poolState, isOpen]);

  if (!isOpen) return null;

  const persistState = (stateToSave: TTSPoolState) => {
    saveTTSPoolState(stateToSave);
    onSaveState(stateToSave);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  const handleKeyChange = (projectId: string, newKey: string) => {
    const error = validateApiKeyUniqueness(projectId, newKey, localState.projects);
    setErrors((prev) => ({ ...prev, [projectId]: error || "" }));

    const updated: TTSPoolState = {
      ...localState,
      projects: localState.projects.map((p) =>
        p.id === projectId ? { ...p, apiKey: newKey } : p
      ),
    };
    setLocalState(updated);

    // Auto-save if no uniqueness conflict
    if (!error) {
      saveTTSPoolState(updated);
      onSaveState(updated);
    }
  };

  const handleGroqKeyChange = (newKey: string) => {
    const updated: TTSPoolState = { ...localState, groqApiKey: newKey };
    setLocalState(updated);
    saveTTSPoolState(updated);
    onSaveState(updated);
  };

  const handleAddProject = () => {
    const count = localState.projects.length + 1;
    const newProj = createNewProject(`Google Cloud Project ${count}`);
    const updated: TTSPoolState = {
      ...localState,
      projects: [...localState.projects, newProj],
    };
    setLocalState(updated);
    persistState(updated);
  };

  const handleDeleteProject = (projectId: string) => {
    if (localState.projects.length <= 1) {
      alert("At least one Google Cloud project entry is required.");
      return;
    }
    const updatedProjects = localState.projects.filter((p) => p.id !== projectId);
    const updatedActiveId =
      localState.activeProjectId === projectId
        ? updatedProjects[0].id
        : localState.activeProjectId;

    const updated: TTSPoolState = {
      ...localState,
      activeProjectId: updatedActiveId,
      projects: updatedProjects,
    };
    setLocalState(updated);
    persistState(updated);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    const updated: TTSPoolState = {
      ...localState,
      projects: localState.projects.map((p) =>
        p.id === projectId ? { ...p, name: newName.trim() || p.name } : p
      ),
    };
    setLocalState(updated);
    persistState(updated);
  };

  const handleSave = () => {
    const hasAnyError = Object.values(errors).some(
      (e) => Boolean(e && e.trim().length > 0)
    );
    if (hasAnyError) return;

    persistState(localState);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">API Keys & Model Quotas</h3>
                {savedSuccess && (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold animate-in fade-in">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                100% Client-side &bull; Saved locally in your browser LocalStorage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Section 1: Groq API Key */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-900">Groq API Key (Whisper Large v3)</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                Free Tier (8h/Day)
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Powers rapid transcription and audio-to-SRT. Get a free API key at{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-amber-600 font-semibold underline hover:text-amber-700"
              >
                console.groq.com
              </a>{" "}
              (2,000 requests/day on the free tier).
            </p>
            <div className="relative">
              <input
                type={showGroqKey ? "text" : "password"}
                value={localState.groqApiKey || ""}
                onChange={(e) => handleGroqKeyChange(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-3 pr-10 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Section 2: Gemini TTS Projects Pool */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Google Gemini API Keys Pool</span>
                <p className="text-xs text-slate-500">
                  Add multiple Google Cloud projects to maximize free quota pools across models.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddProject}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add API Key</span>
              </button>
            </div>

            <div className="space-y-3">
              {localState.projects.map((proj, idx) => {
                const isKeyVisible = showKeys[proj.id] || false;
                const err = errors[proj.id];
                const activeModel = localState.selectedModel;
                const remaining = getRemainingRequests(proj, activeModel, 10);
                const isEditingThisName = editingNameId === proj.id;

                return (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <span className="w-5 h-5 rounded-md bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                          {idx + 1}
                        </span>

                        {isEditingThisName ? (
                          <input
                            type="text"
                            defaultValue={proj.name}
                            onBlur={(e) => {
                              handleRenameProject(proj.id, e.target.value);
                              setEditingNameId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameProject(proj.id, (e.target as HTMLInputElement).value);
                                setEditingNameId(null);
                              }
                            }}
                            autoFocus
                            className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-amber-400 text-slate-900 focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className="text-xs font-bold text-slate-800">{proj.name}</span>
                            <button
                              type="button"
                              onClick={() => setEditingNameId(proj.id)}
                              className="text-slate-400 hover:text-slate-600 opacity-60 group-hover:opacity-100"
                              title="Rename project"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {localState.activeProjectId === proj.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300 shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-600 shrink-0">
                          Quota:{" "}
                          <strong className={remaining > 0 ? "text-emerald-700" : "text-rose-600"}>
                            {remaining} / 10
                          </strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...localState, activeProjectId: proj.id };
                            setLocalState(updated);
                            persistState(updated);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded font-semibold border transition-colors cursor-pointer shrink-0 ${
                            localState.activeProjectId === proj.id
                              ? "bg-amber-500 border-amber-600 text-white"
                              : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
                          }`}
                        >
                          Select
                        </button>

                        {localState.projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(proj.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Delete this key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type={isKeyVisible ? "text" : "password"}
                        value={proj.apiKey}
                        onChange={(e) => handleKeyChange(proj.id, e.target.value)}
                        placeholder="AIzaSy..."
                        className={`w-full pl-3 pr-10 py-2 rounded-lg bg-white border text-xs font-mono placeholder:text-slate-400 focus:outline-none shadow-2xs ${
                          err
                            ? "border-rose-500 text-rose-800"
                            : "border-slate-300 text-slate-900 focus:border-amber-500"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowKeys((prev) => ({ ...prev, [proj.id]: !isKeyVisible }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {err && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{err}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Model Selector (4 Models) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              Default Gemini TTS Model (Each gives 10 Free RPD per key)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TTS_MODELS.map((m) => {
                const isSelected = localState.selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      const updated = { ...localState, selectedModel: m.id as any };
                      setLocalState(updated);
                      persistState(updated);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-500 shadow-xs"
                        : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{m.name}</div>
                    <div className="text-[10px] text-amber-700 font-semibold">{m.badge}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{m.speedNote}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <span className="text-xs text-slate-500">
            {localState.projects.filter((p) => !!p.apiKey.trim()).length} configured keys saved in browser
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-xs shadow-amber-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
