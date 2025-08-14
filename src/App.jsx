import React, { useState } from "react";
import "./App.css";

import {
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  transcribeLatest,
  importAudioFile,
  importYoutubeAudio,
  importPdfFile,
  openStorageDir,
  clearStorageDir,
  saveApiKey,
  readApiKey,
  setPromptPreset,
  getPromptPreset,
  openQuizlet
} from "./lib/tauri.js"; // NOTE: .js extension (not .ts)

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Recording handlers (Tauri) ---
  const handleRecordStart = async () => {
    setStatus("Starting…");
    try {
      const res = await startRecording();
      setSessionId(res?.session_id || "");
      setIsRecording(true);
      setIsPaused(false);
      setStatus("Recording");
    } catch (e) {
      setStatus(`Failed to start: ${e}`);
      console.error(e);
    }
  };

  const handlePause = async () => {
    if (!isRecording || isPaused) return;
    try {
      await pauseRecording();
      setIsPaused(true);
      setStatus("Paused");
    } catch (e) {
      setStatus(`Pause failed: ${e}`);
      console.error(e);
    }
  };

  const handleResume = async () => {
    if (!isRecording || !isPaused) return;
    try {
      await resumeRecording();
      setIsPaused(false);
      setStatus("Recording");
    } catch (e) {
      setStatus(`Resume failed: ${e}`);
      console.error(e);
    }
  };

  const handleRecordStop = async () => {
    if (!isRecording) return;
    setStatus("Stopping…");
    try {
      const res = await stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setStatus(res?.message || "Stopped");

      // Auto-transcribe after stop if we have a session
      if (sessionId) {
        const t = await transcribeLatest(sessionId, "base");
        setTranscript(t?.text || "");
        setStatus("Transcription complete.");
      } else {
        setStatus("Stopped. (No sessionId to transcribe.)");
      }
    } catch (e) {
      setStatus(`Stop failed: ${e}`);
      console.error(e);
    }
  };

  // --- Sidebar actions (stub/demo wiring) ---
  const onImportAudio = async () => {
    setStatus("Import Audio: not wired to file picker yet.");
    // When you add a file picker, pass its path to:
    // await importAudioFile(chosenPath);
  };

  const onImportYouTube = async () => {
    setStatus("Import YouTube Audio: not wired to URL prompt yet.");
    // Example:
    // const url = prompt("Paste YouTube URL:");
    // if (url) await importYoutubeAudio(url);
  };

  const onImportPDF = async () => {
    setStatus("Import PDF: not wired to file picker yet.");
    // When you add a file picker, pass its path to:
    // await importPdfFile(chosenPath);
  };

  const onApiKey = async () => {
    const existing = await readApiKey();
    const next = window.prompt("Enter OpenAI API key:", existing || "");
    if (next != null) {
      await saveApiKey(next);
      setStatus("API key saved.");
    }
  };

  const onStorage = async () => {
    await openStorageDir();
    setStatus("Opened storage directory.");
  };

  const onClearStorage = async () => {
    await clearStorageDir();
    setStatus("Storage cleared.");
  };

  const onPromptPreset = async () => {
    const current = await getPromptPreset();
    const next = window.prompt("Enter prompt preset name:", current || "");
    if (next != null) {
      await setPromptPreset(next);
      setStatus("Prompt preset saved.");
    }
  };

  const onQuizlet = async () => {
    try {
      await openQuizlet();
      setStatus("Opened Quizlet.");
    } catch (e) {
      setStatus(`Open Quizlet failed: ${e}`);
    }
  };

  return (
    <div className="app-wrapper">
      <header className="top-bar">
        <button
          className="hamburger-btn"
          aria-label="Toggle menu"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <h1>Applesauce</h1>
      </header>

      <div className="content-area">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-title">Settings</div>
          </div>
          <nav className="menu">
            <button className="menu-item" onClick={onImportAudio}>Import Audio</button>
            <button className="menu-item" onClick={onImportYouTube}>Import YouTube Audio</button>
            <button className="menu-item" onClick={onImportPDF}>Import PDF</button>
            <button className="menu-item" onClick={onApiKey}>OpenAI API Key</button>
            <button className="menu-item" onClick={onStorage}>Storage</button>
            <button className="menu-item" onClick={onClearStorage}>Clear Storage</button>
            <button className="menu-item" onClick={onPromptPreset}>OpenAI Prompt</button>
            <button className="menu-item" onClick={onQuizlet}>Open Quizlet</button>
          </nav>
        </aside>

        {/* Main area that shifts when sidebar is open */}
        <div className={`content-shift ${sidebarOpen ? "shifted" : ""}`}>
          <div className="main-content">
            {/* Recording controls (3 columns) */}
            <div className="recording-controls">
              <button
                onClick={handleRecordStart}
                disabled={isRecording}
                className="pill-btn start-btn"
              >
                Start
              </button>

              {!isPaused ? (
                <button
                  onClick={handlePause}
                  disabled={!isRecording || isPaused}
                  className="pill-btn pause-resume-btn"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  disabled={!isRecording || !isPaused}
                  className="pill-btn pause-resume-btn"
                >
                  Resume
                </button>
              )}

              <button
                onClick={handleRecordStop}
                disabled={!isRecording}
                className="pill-btn stop-btn"
              >
                Stop
              </button>
            </div>

            {/* Lecture Notes */}
            <div className="lecture-notes">
              <h2>Lecture Notes</h2>
              <button
                className="copy-notes-btn"
                onClick={() => {
                  navigator.clipboard.writeText(transcript || "");
                  setStatus("Notes copied to clipboard.");
                }}
                title="Copy notes"
              >
                📄
              </button>
              <div className="notes-content">
                {transcript || "— (transcript will appear here) —"}
              </div>
            </div>

            {/* Console strip */}
            <div className="console-output">Status: {status || "Ready"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
