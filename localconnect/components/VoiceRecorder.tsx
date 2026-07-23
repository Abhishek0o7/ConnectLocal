"use client";

import { useRef, useState } from "react";

const CANDIDATE_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob, seconds: number, mimeType: string) => void;
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        stream.getTracks().forEach((t) => t.stop());
        if (elapsed >= 1 && chunksRef.current.length > 0) onRecorded(blob, elapsed, finalType);
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
