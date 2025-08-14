// src/lib/tauri.js
// Safe wrappers around Tauri invoke so your app doesn't crash in a web browser.
// This file is JS-only, but structured so it can be ported to TS easily later.

/** True when running inside a Tauri desktop window (not a plain browser tab). */
export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

/**
 * Lazy-initialized invoke function. In a browser tab, it throws a clear error.
 * In Tauri, it dynamically imports @tauri-apps/api/core and calls invoke(cmd, args).
 */
let _cachedInvoke = null;
async function getInvoke() {
  if (!isTauri) {
    // Throw a friendly error when someone clicks a Tauri-only button in the browser preview.
    return async () => {
      throw new Error(
        "Tauri API not available in the web preview. Run `npm run tauri dev` and use the desktop window."
      );
    };
  }
  if (_cachedInvoke) return _cachedInvoke;

  // Dynamically import so bundlers won't explode in the browser.
  const { invoke } = await import("@tauri-apps/api/core");
  _cachedInvoke = invoke;
  return _cachedInvoke;
}

/** Always pass an args object so future TS ports won’t complain. */
async function tauriInvoke(cmd, args = {}) {
  const invoke = await getInvoke();
  return invoke(cmd, args);
}

/* -------------------- App-specific commands -------------------- */
/* These match the command names you registered in src-tauri/src/main.rs.  */
/* All helpers pass {} when no args are required (TS-friendly convention). */

// Recording controls
export const startRecording   = () => tauriInvoke("start_recording", {});
export const pauseRecording   = () => tauriInvoke("pause_recording", {});
export const resumeRecording  = () => tauriInvoke("resume_recording", {});
export const stopRecording    = () => tauriInvoke("stop_recording", {});

// Transcription
export const transcribeLatest = (sessionId, model) =>
  tauriInvoke("transcribe_latest", { sessionId, model });

// File imports (your UI decides how to collect the path/URL)
export const importAudioFile   = (path) => tauriInvoke("import_audio_file",   { path });
export const importYoutubeAudio= (url)  => tauriInvoke("import_youtube_audio", { url });
export const importPdfFile     = (path) => tauriInvoke("import_pdf_file",     { path });

// Storage
export const openStorageDir  = () => tauriInvoke("open_storage_dir", {});
export const clearStorageDir = () => tauriInvoke("clear_storage_dir", {});

// API key / prompt
export const saveApiKey      = (value) => tauriInvoke("save_api_key",      { value });
export const readApiKey      = ()        => tauriInvoke("read_api_key",     {});
export const setPromptPreset = (value) => tauriInvoke("set_prompt_preset", { value });
export const getPromptPreset = ()        => tauriInvoke("get_prompt_preset", {});

// External
export const openQuizlet     = ()        => tauriInvoke("open_quizlet", {});
