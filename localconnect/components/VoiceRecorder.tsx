"use client";

import { useRef, useState } from "react";

export default function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob, seconds: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (elapsed >= 1) onRecorded(blob, elapsed);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied.");
    }
  }

  function stopRecording(cancel = false) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    if (cancel && mediaRecorderRef.current) {
      // Prevent onstop from sending by clearing chunks first.
      chunksRef.current = [];
    }
    mediaRecorderRef.current?.stop();
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 bg-red-light rounded-full px-3 py-2 flex-1">
        <span className="w-2 h-2 rounded-full bg-red flame-flicker" />
        <span className="text-xs text-red font-medium flex-1">
          Recording… {String(Math.floor(seconds / 60)).padStart(1, "0")}:{String(seconds % 60).padStart(2, "0")}
        </span>
        <button
          onClick={() => stopRecording(true)}
          className="text-[11px] text-muted bg-transparent border-none"
        >
          Cancel
        </button>
        <button
          onClick={() => stopRecording(false)}
          className="bg-red text-white border-none rounded-full px-3 py-1 text-[11px] font-medium"
        >
          Send
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={startRecording}
        className="bg-surface2 text-ink border-none rounded-full w-[38px] h-[38px] flex items-center justify-center flex-shrink-0"
        aria-label="Record a voice note"
      >
        🎙️
      </button>
      {error && <span className="text-[10px] text-red">{error}</span>}
    </div>
  );
}
