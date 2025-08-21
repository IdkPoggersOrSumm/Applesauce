// src/App.tsx
import Recorder from "./components/Recorder";
import "./App.css";

export default function App() {
  return (
    <div className="app-wrapper">
      {/* Top bar */}
      <div className="top-bar">
        <h1>Applesauce</h1>
      </div>

      {/* Main content */}
      <div className="content-area">
        <div className="content-shift shifted">
          <div className="main-content">
            {/* Recording controls go here */}
            <div className="recording-controls">
              <Recorder />
            </div>

            {/* Notes area */}
            <div className="lecture-notes">
              <h2>Lecture Notes</h2>
              <div className="notes-content">
                {/* You can pipe Recorder → transcription results here */}
                Waiting for transcription…
              </div>
            </div>

            {/* Console output */}
            <div className="console-output">Console ready…</div>
          </div>
        </div>
      </div>
    </div>
  );
}
