"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scissors,
  FileText,
  Upload,
  Copy,
  Check,
  Download,
  Sparkles,
  Sliders,
  ArrowRight,
} from "lucide-react";
import { enforceSrtLimits } from "@/lib/srt-chunker";

interface SrtCleanerTabProps {
  initialSrt?: string | null;
}

export default function SrtCleanerTab({ initialSrt }: SrtCleanerTabProps) {
  const [rawSrt, setRawSrt] = useState(initialSrt || "");
  const [cleanedSrt, setCleanedSrt] = useState("");
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(8);
  const [minWordsPerLine, setMinWordsPerLine] = useState(5);
  const [ignoreDuration, setIgnoreDuration] = useState(true);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialSrt) {
      setRawSrt(initialSrt);
      setCleanedSrt("");
    }
  }, [initialSrt]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawSrt(text || "");
      };
      reader.readAsText(file);
    }
  };

  const handleCleanAndRechunk = () => {
    if (!rawSrt.trim()) return;

    const result = enforceSrtLimits(rawSrt, {
      maxWordsPerLine,
      minWordsPerLine,
      targetWordsPerLine: Math.min(maxWordsPerLine, minWordsPerLine + 1),
      ignoreDuration,
    });

    setCleanedSrt(result);
  };

  const rawCuesCount = (rawSrt.match(/-->/g) || []).length;
  const cleanedCuesCount = (cleanedSrt.match(/-->/g) || []).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">SRT Subtitle Cleaner & Re-Chunker</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Client-side Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lambe, awkward subtitle paragraphs ko Shorts/Reels/TikTok ke liye clean 5–8 words per cue
            me split karein.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            <span>Upload .SRT File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {rawSrt && initialSrt && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">
              🔗 Connected Pipeline: Subtitle transcript auto-loaded from Step 4 Audio to SRT ({rawCuesCount} cues)!
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Ready to clean &amp; re-chunk</span>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Max Words / Cue:</span>
            <input
              type="number"
              min={4}
              max={15}
              value={maxWordsPerLine}
              onChange={(e) => setMaxWordsPerLine(parseInt(e.target.value, 10) || 8)}
              className="w-16 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-300 text-center text-amber-800 font-bold focus:outline-none focus:border-amber-500"
            />
            <span className="text-slate-400 text-[11px]">(Recommended: 5–8 words)</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={ignoreDuration}
              onChange={(e) => setIgnoreDuration(e.target.checked)}
              className="accent-amber-600"
            />
            <span className="font-medium">Shorts Word-Count Focus (Skip strict 2s duration)</span>
          </label>
        </div>

        <button
          onClick={handleCleanAndRechunk}
          disabled={!rawSrt.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Re-Chunk & Format Subtitles</span>
        </button>
      </div>

      {/* Side-by-Side Editor Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Raw SRT */}
        <div className="flex flex-col h-[520px] rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs">
            <span className="font-semibold text-slate-700">Raw / Original SRT</span>
            {rawCuesCount > 0 && (
              <span className="text-slate-500 text-[11px]">{rawCuesCount} cues</span>
            )}
          </div>
          <div className="flex-1 p-3 bg-slate-50/30">
            <textarea
              value={rawSrt}
              onChange={(e) => setRawSrt(e.target.value)}
              placeholder="Paste existing .srt file text here or click 'Upload .SRT File'..."
              className="w-full h-full bg-transparent text-xs font-mono text-slate-800 resize-none focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Cleaned Output SRT */}
        <div className="flex flex-col h-[520px] rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Re-Chunked Reels/Shorts SRT</span>
              {cleanedCuesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                  {cleanedCuesCount} cues
                </span>
              )}
            </div>

            {cleanedSrt && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cleanedSrt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 shadow-2xs cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>

                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(cleanedSrt)}`}
                  download="cleaned-subtitles.srt"
                  className="flex items-center gap-1 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>
          <div className="flex-1 p-3 bg-slate-50/30">
            {cleanedSrt ? (
              <textarea
                value={cleanedSrt}
                onChange={(e) => setCleanedSrt(e.target.value)}
                className="w-full h-full bg-transparent text-xs font-mono text-slate-800 resize-none focus:outline-none leading-relaxed"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <Scissors className="w-10 h-10 mb-2 stroke-[1.2] text-slate-300" />
                <p className="text-xs font-medium text-slate-600">Cleaned subtitles will appear here</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click &ldquo;Re-Chunk & Format Subtitles&rdquo; to process.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
