// src-tauri/src/main.rs
// Tauri v2 command surface for Applesauce.
// - Recording commands backed by recorder.rs (cpal + hound).
// - Stubs for imports/transcribe/storage/API key/prompt/quizlet.
//
// If you change command names here, also update src/lib/tauri.(js|ts).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod recorder;

use recorder::{RecorderState, start_recording, pause_recording, resume_recording, stop_recording, app_data_dir};

use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use anyhow::Result;

struct SharedState {
  // Wrap RecorderState in a Mutex so multiple commands can access it safely.
  recorder: Mutex<RecorderState>,
}

#[derive(Serialize)]
struct StartResponse {
  session_id: String,
  first_chunk: String, // keep shape consistent; not actually used yet
}

#[derive(Serialize)]
struct StopResponse {
  message: String,
  final_wav: Option<String>,
}

// ----- Recording commands -----

#[tauri::command]
fn start_recording_cmd(state: State<SharedState>) -> Result<StartResponse, String> {
  let mut lock = state.recorder.lock().unwrap();
  start_recording(&mut *lock)
    .map(|(sid, _wav)| StartResponse { session_id: sid, first_chunk: "".into() })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn pause_recording_cmd(state: State<SharedState>) -> Result<String, String> {
  let mut lock = state.recorder.lock().unwrap();
  pause_recording(&mut *lock)
    .map(|_| "paused".into())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn resume_recording_cmd(state: State<SharedState>) -> Result<String, String> {
  let mut lock = state.recorder.lock().unwrap();
  resume_recording(&mut *lock)
    .map(|_| "resumed".into())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_recording_cmd(state: State<SharedState>) -> Result<StopResponse, String> {
  let mut lock = state.recorder.lock().unwrap();
  stop_recording(&mut *lock)
    .map(|wav| StopResponse {
      message: "stopped".into(),
      final_wav: Some(wav.to_string_lossy().to_string()),
    })
    .map_err(|e| e.to_string())
}

// ----- Transcription (stub) -----

#[derive(Deserialize)]
#[allow(dead_code)]
struct TranscribeArgs {
  session_id: Option<String>,
  model: Option<String>,
}

#[derive(Serialize)]
struct TranscribeOut {
  text: String,
}

#[tauri::command]
fn transcribe_latest_cmd(_args: TranscribeArgs) -> Result<TranscribeOut, String> {
  // TODO: Call your local Whisper/Python process here (or Rust whisper.cpp).
  // For now, return a placeholder so the UI can proceed.
  Ok(TranscribeOut {
    text: "Transcription placeholder (implement Whisper integration)".into(),
  })
}

// ----- Imports / Storage / API key / Prompt (stubs you can fill later) -----

#[derive(Deserialize)]
struct ImportAudioArgs { path: String }
#[tauri::command]
fn import_audio_file_cmd(args: ImportAudioArgs) -> Result<String, String> {
  // TODO: validate + copy into app_data_dir/session
  Ok(format!("Imported audio: {}", args.path))
}

#[derive(Deserialize)]
struct ImportYoutubeArgs { url: String }
#[tauri::command]
fn import_youtube_audio_cmd(args: ImportYoutubeArgs) -> Result<String, String> {
  // TODO: spawn yt-dlp (cross-platform path), then transcribe.
  // tip: use tauri-plugin-shell to spawn a child process safely.
  Ok(format!("(stub) would download: {}", args.url))
}

#[derive(Deserialize)]
struct ImportPdfArgs { path: String }
#[tauri::command]
fn import_pdf_file_cmd(args: ImportPdfArgs) -> Result<String, String> {
  // TODO: parse PDF -> text -> notes
  Ok(format!("(stub) PDF queued: {}", args.path))
}

#[tauri::command]
fn open_storage_dir_cmd(_app: tauri::AppHandle) -> Result<String, String> {
  let p = app_data_dir();
  if let Err(e) = std::fs::create_dir_all(&p) {
    return Err(e.to_string());
  }
  // Try opening in OS file browser
  if let Err(e) = open::that(&p) {
    eprintln!("open folder failed: {e}");
  }
  Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn clear_storage_dir_cmd() -> Result<String, String> {
  let p = app_data_dir();
  if p.exists() {
    if let Ok(entries) = std::fs::read_dir(&p) {
        for entry in entries {
            if let Ok(entry) = entry {
                let _ = std::fs::remove_file(entry.path()); // ignore per-file errors
            }
        }
    }
  }
  Ok("cleared".into())
}

#[derive(Deserialize)]
struct SaveApiKeyArgs { value: String }
#[tauri::command]
fn save_api_key_cmd(args: SaveApiKeyArgs) -> Result<(), String> {
  let p = app_data_dir().join("apikey.txt");
  std::fs::write(p, args.value).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_api_key_cmd() -> Result<Option<String>, String> {
  let p = app_data_dir().join("apikey.txt");
  if p.exists() {
    let s = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
    Ok(Some(s))
  } else {
    Ok(None)
  }
}

#[derive(Deserialize)]
struct SetPromptArgs { value: String }
#[tauri::command]
fn set_prompt_preset_cmd(args: SetPromptArgs) -> Result<(), String> {
  let p = app_data_dir().join("prompt.txt");
  std::fs::write(p, args.value).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_prompt_preset_cmd() -> Result<Option<String>, String> {
  let p = app_data_dir().join("prompt.txt");
  if p.exists() {
    let s = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
    Ok(Some(s))
  } else {
    Ok(None)
  }
}

#[tauri::command]
fn open_quizlet_cmd() -> Result<(), String> {
  open::that("https://quizlet.com/create-set").map_err(|e| e.to_string())
}

// ----- Tauri app entry -----

fn main() {
  tauri::Builder::default()
    .manage(SharedState {
      recorder: Mutex::new(RecorderState::new()),
    })
    .plugin(tauri_plugin_shell::init()) // optional, safe to keep
    .invoke_handler(tauri::generate_handler![
      // Recording
      start_recording_cmd,
      pause_recording_cmd,
      resume_recording_cmd,
      stop_recording_cmd,
      // Transcription
      transcribe_latest_cmd,
      // Imports / storage / API key / prompt / external
      import_audio_file_cmd,
      import_youtube_audio_cmd,
      import_pdf_file_cmd,
      open_storage_dir_cmd,
      clear_storage_dir_cmd,
      save_api_key_cmd,
      read_api_key_cmd,
      set_prompt_preset_cmd,
      get_prompt_preset_cmd,
      open_quizlet_cmd
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
