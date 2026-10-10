"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Sparkles,
  Save,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Volume2,
} from "lucide-react";
import {
  PersonaConfig,
  GEMINI_VOICES,
  saveSinglePersona,
  deletePersona,
  exportPersonasToJson,
  importPersonasFromJson,
  resetPersonasToDefaults,
} from "@/lib/personas";

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPersona: PersonaConfig;
  allPersonas: Record<string, PersonaConfig>;
  onPersonasChange: (updatedPersonas: Record<string, PersonaConfig>, activeId: string) => void;
}

export default function PersonaModal({
  isOpen,
  onClose,
  currentPersona,
  allPersonas,
  onPersonasChange,
}: PersonaModalProps) {
  const [formData, setFormData] = useState<PersonaConfig>(currentPersona);
  const [isEditingExisting, setIsEditingExisting] = useState(true);
  const [exportJsonUrl, setExportJsonUrl] = useState<string | null>(null);

  useEffect(() => {
    setFormData(currentPersona);
    setIsEditingExisting(!!allPersonas[currentPersona.id]);
  }, [currentPersona, allPersonas, isOpen]);

  if (!isOpen) return null;

  const handleStartNew = () => {
    const newId = `persona_${Date.now()}`;
    const newPersona: PersonaConfig = {
      id: newId,
      name: "New Voice Character",
      title: "Custom Voice Narrator",
      domain: "Explainers & Commentary",
      gender: "Female",
      perceivedAge: "25",
      avatarEmoji: "🎙️",
      baseVoice: "Kore",
      pacingNote: "Natural conversational pace (~145 WPM) with clear diction.",
      directorPrompt: `Speaker: New Voice Character, natural conversational style.

Style: Clear, engaging voice speaking in natural Hinglish or English. Warm and informative.

Voice: Balanced pitch with clear clarity and crisp articulation.

Pacing: Steady flowing pace (~145 WPM). Natural brief pauses at commas and full stops.`,
      templates: [
        {
          id: `template_${Date.now()}`,
          title: "Sample Introductory Script",
          topic: "General",
          text: "Namaste dosto! Aaj hum baat karenge ek bohot hi interesting topic ke baare mein. Dhyan se suniye aur enjoy kijiye!",
        },
      ],
    };
    setFormData(newPersona);
    setIsEditingExisting(false);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Please give this persona a name.");
      return;
    }

    const updated = saveSinglePersona(formData);
    onPersonasChange(updated, formData.id);
    onClose();
  };

  const handleDelete = () => {
    if (formData.id === "arya") {
      alert("Prof. Arya is the default built-in persona and cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${formData.name}"?`)) return;

    const updated = deletePersona(formData.id);
    onPersonasChange(updated, "arya");
    onClose();
  };

  const handleExportJson = () => {
    const jsonStr = exportPersonasToJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    setExportJsonUrl(url);

    const a = document.createElement("a");
    a.href = url;
    a.download = "audio-studio-personas.json";
    a.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const result = importPersonasFromJson(text);
        if (result) {
          alert("Personas imported successfully!");
          onPersonasChange(result, Object.keys(result)[0]);
        } else {
          alert("Invalid persona JSON file.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset all personas to original built-in defaults? Custom personas will be replaced.")) {
      const reset = resetPersonasToDefaults();
      onPersonasChange(reset, "arya");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isEditingExisting ? `Edit Persona: ${formData.name}` : "Create New Persona"}
              </h3>
              <p className="text-xs text-slate-500">
                Customize voice, director prompt, pacing and style for Gemini TTS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNew}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Persona</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Identity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Avatar Emoji</label>
              <input
                type="text"
                value={formData.avatarEmoji || "🎙️"}
                onChange={(e) => setFormData({ ...formData, avatarEmoji: e.target.value })}
                className="w-full text-center text-xl py-1.5 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-slate-600 font-medium mb-1">Persona Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Prof. Arya, Kabir Storyteller"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-medium focus:outline-none"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Perceived Age</label>
              <input
                type="text"
                value={formData.perceivedAge}
                onChange={(e) => setFormData({ ...formData, perceivedAge: e.target.value })}
                placeholder="e.g. 24"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Subtitle / Domain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Persona Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Master of Design & History"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Topic / Domain</label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="e.g. Tech, History, Explainer, Stories"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Base Voice Selection (7 Gemini Voices) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Volume2 className="w-4 h-4 text-amber-600" />
                <span>Base Google Gemini TTS Voice</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Selected: <strong className="text-amber-700">{formData.baseVoice}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GEMINI_VOICES.map((v) => {
                const isSelected = formData.baseVoice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, baseVoice: v.id })}
                    className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-100/60 border-amber-500 shadow-2xs"
                        : "bg-white hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{v.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {v.gender}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{v.tone}</p>
                    <p className="text-[10px] text-amber-800 font-semibold mt-0.5">{v.bestFor}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pacing Note */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Pacing & Speed Description (~WPM)
            </label>
            <input
              type="text"
              value={formData.pacingNote}
              onChange={(e) => setFormData({ ...formData, pacingNote: e.target.value })}
              placeholder="e.g. Steady, flowing pace of around 145-155 WPM..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Director Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium">
                Directorial Prompt (Instructions for Gemini TTS Tone & Emotion)
              </label>
              <span className="text-[11px] text-slate-400">
                Injected before synthesis to steer the voice
              </span>
            </div>
            <textarea
              value={formData.directorPrompt}
              onChange={(e) => setFormData({ ...formData, directorPrompt: e.target.value })}
              rows={8}
              placeholder="Speaker: Prof. Arya, style guidelines, vocal texture..."
              className="w-full p-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium text-xs shadow-2xs transition-colors cursor-pointer"
              title="Download all personas as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium text-xs shadow-2xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs transition-colors cursor-pointer"
              title="Reset to factory personas"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isEditingExisting && formData.id !== "arya" && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 font-medium text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Persona</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
