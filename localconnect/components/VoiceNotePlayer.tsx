"use client";

import { useRef, useState } from "react";

export default function VoiceNotePlayer({ url, seconds, mine }: { url: string; seconds: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  }

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-none ${
          mine ? "bg-white/20 text-white" : "bg-aurora text-white"
        }`}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className={`flex-1 h-1 rounded-full overflow-hidden ${mine ? "bg-white/20" : "bg-surface2"}`}>
        <div
          className="h-full bg-current transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-[10px] opacity-70 flex-shrink-0">{seconds ? `${seconds}s` : ""}</span>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        className="hidden"
      />
    </div>
  );
}
