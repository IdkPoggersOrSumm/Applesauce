import React, { useState, useEffect } from 'react';
import './App.css';

// A universal UI for TurboLearn across platforms. This component
// provides mock backend functionality while retaining the ability to call a
// real local API once available. It features controls for recording,
// transcription and sending prompts to the API, plus preset selection,
// transcript and response display.

const presetsMock = [
  { id: '1', name: 'Summary' },
  { id: '2', name: 'Outline' },
  { id: '3', name: 'Notes' }
];

export default function App() {
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState({
    recording: false,
    transcribing: false,
    sending: false
  });
  const [mock, setMock] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Determine the base URL for API calls. Falls back to localhost if
  // VITE_API_BASE is not defined in the environment.
  const [apiBase] = useState(
    import.meta?.env?.VITE_API_BASE || 'http://127.0.0.1:17600'
  );

  // On mount, load presets either from the mock list or from the backend.
  useEffect(() => {
    if (mock) {
      setPresets(presetsMock);
    } else {
      fetch(`${apiBase}/presets`)
        .then((res) => res.json())
        .then((data) => {
          setPresets(data || []);
        })
        .catch(() => setPresets([]));
    }
  }, [mock, apiBase]);

  // Starts a new recording session. Uses a mock implementation when mock mode
  // is enabled; otherwise it calls the local API.
  const handleRecordStart = async () => {
    setLoading((prev) => ({ ...prev, recording: true }));
    setIsRecording(true);
    setIsPaused(false);
    if (mock) {
      const id = Math.random().toString(36).substring(2, 10);
      setSessionId(id);
      setStatus('Recording started (mock).');
      setLoading((prev) => ({ ...prev, recording: false }));
      return;
    }
    try {
      const res = await fetch(`${apiBase}/record/start`, {
        method: 'POST'
      });
      const json = await res.json();
      setSessionId(json.sessionId || '');
      setStatus('Recording started.');
    } catch (e) {
      setStatus('Failed to start recording.');
    } finally {
      setLoading((prev) => ({ ...prev, recording: false }));
    }
  };

  // Stops the current recording session and saves the audio. When mocking
  // this simply updates the status; otherwise it relies on the backend.
  const handleRecordStop = async () => {
    setLoading((prev) => ({ ...prev, recording: true }));
    setIsRecording(false);
    setIsPaused(false);
    if (mock) {
      setStatus('Recording stopped (mock).');
      setLoading((prev) => ({ ...prev, recording: false }));
      handleTranscribe();
      return;
    }
    try {
      const res = await fetch(`${apiBase}/record/stop`, {
        method: 'POST'
      });
      const json = await res.json();
      setStatus(
        json.pathWav
          ? `Saved recording to ${json.pathWav}`
          : 'Recording stopped.'
      );
      handleTranscribe();
    } catch (e) {
      setStatus('Failed to stop recording.');
    } finally {
      setLoading((prev) => ({ ...prev, recording: false }));
    }
  };

  // Transcribes the most recent audio file. In mock mode it returns dummy
  // content; otherwise it calls the backend to run Whisper.
  const handleTranscribe = async () => {
    setLoading((prev) => ({ ...prev, transcribing: true }));
    if (mock) {
      setTranscript('This is a mock transcript.');
      setStatus('Transcription complete (mock).');
      setLoading((prev) => ({ ...prev, transcribing: false }));
      return;
    }
    try {
      const res = await fetch(`${apiBase}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'small'
        })
      });
      const json = await res.json();
      setTranscript(json.text || '');
      setStatus('Transcription complete.');
    } catch (e) {
      setStatus('Failed to transcribe.');
    } finally {
      setLoading((prev) => ({ ...prev, transcribing: false }));
    }
  };

  // Sends the transcript to the OpenAI API using the selected prompt preset.
  // When mocking this returns a dummy response; otherwise it calls the backend.
  const handleSend = async () => {
    setLoading((prev) => ({ ...prev, sending: true }));
    if (mock) {
      setResponse('This is a mock response from the API.');
      setStatus('Sent to API (mock).');
      setLoading((prev) => ({ ...prev, sending: false }));
      return;
    }
    try {
      const res = await fetch(`${apiBase}/openai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptPresetId: selectedPreset,
          text: transcript
        })
      });
      const json = await res.json();
      setResponse(json.response || '');
      setStatus('Received response.');
    } catch (e) {
      setStatus('Failed to query the API.');
    } finally {
      setLoading((prev) => ({ ...prev, sending: false }));
    }
  };

  // Toggles between mock mode and real backend mode. When disabling mock,
  // presets will be fetched from the backend on the next render.
  const toggleMock = () => {
    setMock((prev) => !prev);
    setStatus('');
    setTranscript('');
    setResponse('');
    setSelectedPreset('');
  };

  const handlePauseResume = () => {
    setIsPaused(prev => !prev);
    setStatus(isPaused ? 'Resuming...' : 'Pausing...');
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
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="menu">
            <button className="menu-item" onClick={() => {/* TODO */}}>Import Audio</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>Import YouTube Audio</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>Import PDF</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>OpenAI API Key</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>Storage</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>Clear Storage</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>OpenAI Prompt</button>
            <button className="menu-item" onClick={() => {/* TODO */}}>Open Quizlet</button>
          </nav>
        </aside>

        <div className={`content-shift ${sidebarOpen ? 'shifted' : ''}`}>
          <div className="main-content">
            {/* Recording controls */}
            <div className="recording-controls grid-3">
              <button
                onClick={handleRecordStart}
                disabled={isRecording}
                className="pill-btn start-btn"
              >
                Start
              </button>
      
              <button
                onClick={handlePauseResume}
                disabled={!isRecording}
                className="pill-btn pause-resume-btn"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
      
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
      
            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                onClick={handleSend}
                disabled={loading.sending || !transcript}
                className="pill-btn start-btn"
              >
                Ask AI
              </button>
            </div>
      
            {/* Console strip */}
            <div className="console-output">Status: {status || "Ready"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}