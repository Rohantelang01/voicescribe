"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Mic, FileText, Sparkles, Merge, Key, Scissors, Pencil } from "lucide-react";
import {
  FEATURE_NUMBER,
  FEATURE_ORDER,
  FEATURE_TITLE_MAX_LEN,
  numberedTitle,
  resetFeatureTitles,
  setFeatureTitle,
  useFeatureTitles,
  type FeatureTabId,
} from "@/lib/feature-titles";

export type ActiveTab = "studio" | "transcribe" | "cleaner" | "merger" | "srt-cleaner";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenKeys: () => void;
  /** Keys missing → amber dot on the key icon */
  showKeyWarning?: boolean;
}

export default function Header({
  activeTab,
  onTabChange,
  onOpenKeys,
  showKeyWarning,
}: HeaderProps) {
  const titles = useFeatureTitles();
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  const icons: Record<FeatureTabId, React.ReactNode> = {
    studio: <Mic className="w-4 h-4" />,
    merger: <Merge className="w-4 h-4" />,
    cleaner: <Sparkles className="w-4 h-4" />,
    transcribe: <FileText className="w-4 h-4" />,
    "srt-cleaner": <Scissors className="w-4 h-4" />,
  };
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = FEATURE_ORDER.map(
    (id) => ({ id: id as ActiveTab, label: numberedTitle(titles, id), icon: icons[id] })
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: logo + key icon */}
        <div className="flex items-center justify-between gap-3 pt-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logo.svg"
              alt="VoiceScribe logo"
              width={32}
              height={32}
              className="rounded-lg shadow-sm shadow-amber-500/30 shrink-0"
            />
            <span className="font-bold text-base tracking-tight text-slate-900 truncate">
              VoiceScribe
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              Open Source
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsRenameOpen(true)}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 transition-colors shadow-2xs cursor-pointer"
            title="Rename features (tab titles)"
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={onOpenKeys}
            className="relative p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 transition-colors shadow-2xs cursor-pointer shrink-0"
            title="API keys & quota info"
          >
            <Key className="w-4 h-4 text-amber-600" />
            {showKeyWarning && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" />
            )}
          </button>
          </div>
        </div>

        {/* Row 2: tabs (scrollable on mobile) */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none -mx-1 px-1">
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
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rename Features Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">Rename Features</h3>
              </div>
              <button
                onClick={() => setIsRenameOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Apne hisab se naam rakho — tabs aur saare “Send to…” buttons me turant dikhega.
              </p>
              {FEATURE_ORDER.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center font-bold text-amber-800 shrink-0">
                    {FEATURE_NUMBER[id]}
                  </span>
                  <span className="text-slate-400 shrink-0">{icons[id]}</span>
                  <input
                    value={titles[id]}
                    maxLength={FEATURE_TITLE_MAX_LEN}
                    onChange={(e) => setFeatureTitle(id, e.target.value)}
                    placeholder="Feature title"
                    className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </label>
              ))}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={resetFeatureTitles}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={() => setIsRenameOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
