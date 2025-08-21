import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

type Status = "idle" | "recording" | "paused";

export default function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0); // 0..100
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const timerRef = useRef(null as number | null);

  // Media/Audio refs (use assertions to avoid TS “Expected 0 type arguments”)
  const mediaStreamRef = useRef(null as MediaStream | null);
  const mediaRecorderRef = useRef(null as MediaRecorder | null);
  const chunksRef = useRef([] as BlobPart[]);
  const audioCtxRef = useRef(null as AudioContext | null);
  const analyserRef = useRef(null as AnalyserNode | null);
  const sourceNodeRef = useRef(null as MediaStreamAudioSourceNode | null);
  const rafRef = useRef(null as number | null);

  // Start meter render loop
  const startMeter = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128);
        if (v > peak) peak = v;
      }
      setLevel(Math.min(100, Math.round((peak / 128) * 100)));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const stopMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);
  };

  const startTimer = () => {
    const started = Date.now() - elapsed;
    
    timerRef.current = window.setInterval(() => {
      setElapsed(Date.now() - started);
    }, 200) as unknown as number;

  };

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const resetTimer = () => setElapsed(0);

  const setupAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AC();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";

    const mr = new MediaRecorder(stream, {
      mimeType: mime,
      audioBitsPerSecond: 128000,
    });

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current = mr;
  };

  const teardownAudio = () => {
    stopMeter();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    mediaStreamRef.current = null;
    audioCtxRef.current = null;
    sourceNodeRef.current = null;
    analyserRef.current = null;
  };

  const startRecording = async () => {
    await setupAudio();
    chunksRef.current = [];
    mediaRecorderRef.current!.start(250);
    setStatus("recording");
    startTimer();
    startMeter();
    await emit("startWaveform");
  };

  const pauseRecording = async () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      stopTimer();
    }
  };

  const resumeRecording = async () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");
      startTimer();
    }
  };

  const stopRecording = async () => {
    return new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve();

      const finalize = async () => {
        mr.removeEventListener("stop", finalize as any);
        stopTimer();
        resetTimer();

        const mime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        const base64 = await blobToBase64(blob);
        const ext = mime.includes("mp4") || mime.includes("m4a")
          ? "m4a"
          : mime.includes("webm")
          ? "webm"
          : "webm";

        try {
          const savedPath = await invoke<string>("save_audio_base64", {
            base64Data: base64,
            extHint: ext,
          });
          setSavingPath(savedPath);
        } catch (e: any) {
          console.error("Save error:", e);
          setSavingPath(`Save failed: ${String(e)}`);
        }

        teardownAudio();
        setStatus("idle");
        await emit("stopWaveform");
        resolve();
      };

      if (mr.state !== "inactive") {
        mr.addEventListener("stop", finalize as any, { once: true });
        mr.stop();
      } else {
        finalize();
      }
    });
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  useEffect(() => {
    return () => {
      stopTimer();
      stopMeter();
      teardownAudio();
    };
  }, []);

  const seconds = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      {/* Buttons styled with your CSS classes */}
      <button
        className="pill-btn start-btn"
        onClick={startRecording}
        disabled={status !== "idle"}
      >
        Start
      </button>

      <button
        className="pill-btn pause-resume-btn"
        onClick={status === "recording" ? pauseRecording : resumeRecording}
        disabled={status === "idle"}
      >
        {status === "recording" ? "Pause" : "Resume"}
      </button>

      <button
        className="pill-btn stop-btn"
        onClick={stopRecording}
        disabled={status === "idle"}
      >
        Stop & Save
      </button>

      {/* Minimal status/meter readout; adjust layout as you like */}
      <div style={{ gridColumn: "1 / -1", marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        Status: <code>{status}</code> • Elapsed: {mm}:{ss} • Level: {level}
        {savingPath ? ` • Saved: ${savingPath}` : ""}
      </div>
    </>
  );
}
