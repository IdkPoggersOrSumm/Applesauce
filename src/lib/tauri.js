// src/lib/tauri.js
// Safe wrappers around Tauri invoke so your app won't crash in a plain browser tab.

export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

let _cachedInvoke = null;

/** Lazy-load invoke (Tauri v2). In a browser tab, throw a friendly error. */
async function getInvoke() {
  if (!isTauri) {
    return async () => {
      throw new Error(
        "Tauri API not available in the web preview. Run `npm run tauri dev` and use the desktop window."
      );
    };
  }
  if (_cachedInvoke) return _cachedInvoke;
  const { invoke } = await import("@tauri-apps/api/core"); // v2 path
  _cachedInvoke = invoke;
  return _cachedInvoke;
}

/** Always pass an args object so future TS ports are painless. */
async function tauriInvoke(cmd, args = {}) {
  const invoke = await getInvoke();
  return invoke(cmd, args);
}

/* ------------------------------------------------------------------ */
/*                App-specific commands (match Rust names)             */
/* ------------------------------------------------------------------ */

/** Recording controls (Rust: *_cmd; no struct args) */
export const startRecording  = () => tauriInvoke("start_recording_cmd", {});
export const pauseRecording  = () => tauriInvoke("pause_recording_cmd", {});
export const resumeRecording = () => tauriInvoke("resume_recording_cmd", {});
export const stopRecording   = () => tauriInvoke("stop_recording_cmd", {});

/** Frontend → Rust file save (Rust: save_audio_base64; NOT a struct param) */
export const saveAudioBase64 = (base64Data, extHint) =>
  tauriInvoke("save_audio_base64", { base64Data, extHint });

/** Transcription (Rust signature: fn transcribe_latest_cmd(args: TranscribeArgs)) */
export const transcribeLatest = (sessionId, model) =>
  tauriInvoke("transcribe_latest_cmd", {
    args: { session_id: sessionId ?? null, model: model ?? null },
  });

/** File imports (Rust: fn ..._cmd(args: Import...Args)) */
export const importAudioFile    = (path) => tauriInvoke("import_audio_file_cmd",    { args: { path } });
export const importYoutubeAudio = (url)  => tauriInvoke("import_youtube_audio_cmd", { args: { url } });
export const importPdfFile      = (path) => tauriInvoke("import_pdf_file_cmd",      { args: { path } });

/** Storage (Rust: *_cmd; no struct args) */
export const openStorageDir  = () => tauriInvoke("open_storage_dir_cmd", {});
export const clearStorageDir = () => tauriInvoke("clear_storage_dir_cmd", {});

/** API key / prompt (Rust: fn ..._cmd(args: ...Args)) */
export const saveApiKey      = (value) => tauriInvoke("save_api_key_cmd",       { args: { value } });
export const readApiKey      = ()        => tauriInvoke("read_api_key_cmd",      {});
export const setPromptPreset = (value)  => tauriInvoke("set_prompt_preset_cmd",  { args: { value } });
export const getPromptPreset = ()        => tauriInvoke("get_prompt_preset_cmd", {});

/** External (Rust: *_cmd; no struct args) */
export const openQuizlet     = ()        => tauriInvoke("open_quizlet_cmd", {});
