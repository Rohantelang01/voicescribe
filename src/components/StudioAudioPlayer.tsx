"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  FastForward,
} from "lucide-react";

interface StudioAudioPlayerProps {
  src: string;
  title?: string;
  downloadFilename?: string;
  className?: string;
  onEnded?: () => void;
  showDownload?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function StudioAudioPlayer({
  src,
  title,
  downloadFilename = "audio.mp3",
  className = "",
  onEnded,
  showDownload = true,
}: StudioAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    // Reset state when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn("Audio playback error:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md flex flex-col gap-2.5 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        preload="metadata"
      />

      {/* Top bar: Title and Speed / Controls */}
      <div className="flex items-center justify-between text-xs">
        {title ? (
          <span className="font-semibold text-slate-200 truncate max-w-[220px]">
            {title}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-slate-400">Audio Preview</span>
        )}

        <div className="flex items-center gap-2">
          {/* Speed Toggle */}
          <button
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-400 border border-slate-700 cursor-pointer"
            title="Cycle Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Download */}
          {showDownload && (
            <a
              href={src}
              download={downloadFilename}
              className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Download Audio"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Center: Play/Pause, Rewind, Scrubber, Time Display */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold transition-transform active:scale-95 shadow-sm shadow-amber-500/20 cursor-pointer"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Replay Button */}
        <button
          onClick={handleRestart}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          title="Restart from beginning"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Progress Scrubber Bar */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="relative w-full flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Live Timing Indicator */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-amber-400 font-semibold">{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
