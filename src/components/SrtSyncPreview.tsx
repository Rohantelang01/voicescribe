"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  Code,
  Smartphone,
  Monitor,
  FileText,
} from "lucide-react";
import { parseSrtCues, SrtCue } from "@/lib/srt-chunker";

function formatClock(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

interface SrtSyncPreviewProps {
  srtText: string;
  onSrtTextChange: (srt: string) => void;
  audioUrl: string | null;
  audioName?: string | null;
  emptyHint?: string;
}

/**
 * Live Sync Preview (Audio to SRT wali) — ab shared.
 * Audio + SRT word/cue sync check: mock screen, transport bar, karaoke cue list.
 */
export default function SrtSyncPreview({
  srtText,
  onSrtTextChange,
  audioUrl,
  audioName,
  emptyHint,
}: SrtSyncPreviewProps) {
  const [viewMode, setViewMode] = useState<"sync-preview" | "raw-srt">("sync-preview");
  const [canvasMode, setCanvasMode] = useState<"reel" | "landscape">("reel");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Naya SRT aaye to preview mode par lao + transport reset
  useEffect(() => {
    if (srtText) {
      setViewMode("sync-preview");
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [srtText]);

  const cues: SrtCue[] = useMemo(() => parseSrtCues(srtText), [srtText]);

  const activeCueIndex = useMemo(() => {
    if (!cues.length) return -1;
    return cues.findIndex((c) => currentTime >= c.start && currentTime <= c.end);
  }, [cues, currentTime]);

  const currentCue = activeCueIndex !== -1 ? cues[activeCueIndex] : null;

  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeCueIndex, autoScroll]);

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
    const nextRate = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

  return (
    <div className="flex flex-col h-[560px] rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
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

      {/* Top Bar: view toggle */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 gap-2">
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
          <button
            onClick={() => setViewMode("sync-preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === "sync-preview" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-amber-600" />
            <span>Live Sync Preview</span>
          </button>
          <button
            onClick={() => setViewMode("raw-srt")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === "raw-srt" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-slate-500" />
            <span>Raw .SRT Code</span>
          </button>
        </div>
        {cues.length > 0 && (
          <span className="text-[11px] text-slate-500 font-semibold">
            {cues.length} cues{audioName ? ` • ${audioName}` : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {srtText && cues.length > 0 ? (
          viewMode === "sync-preview" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mock screen */}
              <div className="relative w-full h-52 sm:h-56 bg-slate-950 flex flex-col items-center justify-between p-4 overflow-hidden border-b border-slate-800 select-none">
                <div className="absolute inset-0 opacity-15 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-full bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
                </div>
                <div className="relative z-10 w-full flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-[11px] text-slate-300">
                      {currentCue ? `Cue #${currentCue.id || activeCueIndex + 1} of ${cues.length}` : "Waiting for speech..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                    <button
                      onClick={() => setCanvasMode("reel")}
                      className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 cursor-pointer ${
                        canvasMode === "reel" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>9:16 Reel</span>
                    </button>
                    <button
                      onClick={() => setCanvasMode("landscape")}
                      className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 cursor-pointer ${
                        canvasMode === "landscape" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3 h-3" />
                      <span>16:9 Video</span>
                    </button>
                  </div>
                </div>
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
                      {isPlaying ? "[ Silence / Pause ]" : audioUrl ? "Click Play ▶ to test subtitle synchronization" : "Audio lagao, phir Play ▶ dabao"}
                    </div>
                  )}
                </div>
                <div className="relative z-10 w-full flex items-center justify-center gap-1 h-3 opacity-60">
                  {[...Array(24)].map((_, i) => (
                    <span
                      key={i}
                      className="w-1 bg-amber-400/80 rounded-full transition-all duration-75"
                      style={{ height: isPlaying ? `${Math.max(3, Math.sin(i * 0.5 + currentTime * 8) * 12 + 6)}px` : "3px" }}
                    />
                  ))}
                </div>
              </div>

              {/* Transport */}
              <div className="p-3 bg-slate-900 border-b border-slate-800 text-white flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    disabled={!audioUrl}
                    className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 flex items-center justify-center shrink-0 font-bold transition-transform active:scale-95 cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <button onClick={() => seekTo(0)} className="p-1.5 rounded-lg text-slate-400 hover:text-white shrink-0 cursor-pointer" title="Restart">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
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
                  <button onClick={cycleSpeed} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-400 border border-slate-700 cursor-pointer shrink-0">
                    {playbackRate}x
                  </button>
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white cursor-pointer shrink-0"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {!audioUrl && (
                  <p className="text-[10px] text-slate-500">💡 Tip: Left me audio lagao — transformed text audio ke saath sync me dikhega.</p>
                )}
              </div>

              {/* Cue list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-slate-50/50">
                <div className="flex items-center justify-between px-1 mb-1 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Interactive Transcript ({cues.length} Cues • Click = seek + play)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                    <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-amber-600 rounded" />
                    <span>Auto-scroll</span>
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
                          ? "bg-amber-100/80 border-amber-500 shadow-sm ring-1 ring-amber-500 scale-[1.01]"
                          : "bg-white hover:bg-slate-100/70 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isActive ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {isActive ? "▶" : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${isActive ? "font-bold text-slate-950" : "text-slate-800"}`}>{cue.text}</p>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatClock(cue.start)} ➔ {formatClock(cue.end)} ({(cue.end - cue.start).toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase shrink-0">Speaking</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 bg-slate-50/40 overflow-y-auto">
              <textarea
                value={srtText}
                onChange={(e) => onSrtTextChange(e.target.value)}
                className="w-full h-full bg-transparent text-xs font-mono text-slate-800 resize-none focus:outline-none leading-relaxed"
              />
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
            <FileText className="w-10 h-10 mb-2.5 stroke-[1.2] text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No transformed subtitles yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">{emptyHint || "Transform dabao — output yahan live preview ke saath aayega."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
