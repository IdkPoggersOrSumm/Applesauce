// src-tauri/src/main.rs
// Tauri v2 command surface for Applesauce.
// - Recording commands backed by recorder.rs (cpal + hound).
// - Stubs for imports/transcribe/storage/API key/prompt/quizlet.
// - save_audio_base64 persists audio blobs from the web UI into Downloads/ApplesauceCache.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod recorder;

use recorder::{
  pause_recording, resume_recording, start_recording, stop_recording, storage_dir, RecorderState,
};

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State}; // Manager needed for app_handle.path()

// For save_audio_base64
use std::{fs, path::PathBuf};
use base64::{engine::general_purpose, Engine as _};
use chrono::Local;

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

/* --------------------------- Recording commands --------------------------- */

#[tauri::command]
fn start_recording_cmd(state: State<SharedState>) -> Result<StartResponse, String> {
  let mut lock = state.recorder.lock().unwrap();
  start_recording(&mut *lock)
    .map(|(sid, _wav)| StartResponse {
      session_id: sid,
      first_chunk: "".into(),
    })
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

/* -------- Save audio from frontend (base64 data URL) to Downloads -------- */

#[tauri::command]
fn save_audio_base64(
  app_handle: tauri::AppHandle,
  base64_data: String,
  ext_hint: Option<String>,
) -> Result<String, String> {
  let ext = ext_hint.unwrap_or_else(|| "webm".to_string());

  // Decode data URL or raw base64
  let cleaned = base64_data.split(',').last().unwrap_or(&base64_data);
  let bytes = general_purpose::STANDARD
    .decode(cleaned)
    .map_err(|e| format!("Failed to decode audio: {e}"))?;

  // Unique filename
  let ts = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let filename = format!("recording_{ts}.{ext}");

  // 1) Try OS-native Downloads/ApplesauceCache
  let mut target_dir: Option<PathBuf> = None;
  match app_handle.path().download_dir() {
    Ok(mut d) => {
      d.push("ApplesauceCache");
      if let Err(e) = fs::create_dir_all(&d) {
        eprintln!("[save_audio_base64] create Downloads dir failed: {e}");
      } else {
        target_dir = Some(d);
      }
    }
    Err(e) => eprintln!("[save_audio_base64] download_dir unavailable: {e}"),
  }

  // 2) Fallback to app private data dir if needed
  if target_dir.is_none() {
    match app_handle.path().app_data_dir() {
      Ok(mut d) => {
        d.push("ApplesauceCache");
        if let Err(e) = fs::create_dir_all(&d) {
          eprintln!("[save_audio_base64] create app_data_dir failed: {e}");
          return Err(format!("Both download_dir and app_data_dir failed: {e}"));
        }
        target_dir = Some(d);
      }
      Err(e) => {
        eprintln!("[save_audio_base64] app_data_dir unavailable: {e}");
        return Err("No writable directory available".into());
      }
    }
  }

  let dir = target_dir.unwrap();
  let filepath = dir.join(&filename);

  // Write file
  fs::write(&filepath, bytes).map_err(|e| format!("write failed: {e}"))?;

  println!("[save_audio_base64] Saved to: {}", filepath.to_string_lossy());

  Ok(filepath.to_string_lossy().to_string())
}

/* ------------------------------ Transcription ----------------------------- */

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
  Ok(TranscribeOut {
    text: "Transcription placeholder (implement Whisper integration)".into(),
  })
}

/* ----------- Imports / Storage / API key / Prompt (now use storage_dir) ----------- */

#[derive(Deserialize)]
struct ImportAudioArgs {
  path: String,
}
#[tauri::command]
fn import_audio_file_cmd(args: ImportAudioArgs) -> Result<String, String> {
  // TODO: validate + copy into storage_dir()/session if desired
  Ok(format!("Imported audio: {}", args.path))
}

#[derive(Deserialize)]
struct ImportYoutubeArgs {
  url: String,
}
#[tauri::command]
fn import_youtube_audio_cmd(args: ImportYoutubeArgs) -> Result<String, String> {
  // TODO: spawn yt-dlp (cross-platform path), then transcribe (use tauri-plugin-shell).
  Ok(format!("(stub) would download: {}", args.url))
}

#[derive(Deserialize)]
struct ImportPdfArgs {
  path: String,
}
#[tauri::command]
fn import_pdf_file_cmd(args: ImportPdfArgs) -> Result<String, String> {
  // TODO: parse PDF -> text -> notes
  Ok(format!("(stub) PDF queued: {}", args.path))
}

#[tauri::command]
fn open_storage_dir_cmd(_app: tauri::AppHandle) -> Result<String, String> {
  let p = storage_dir();
  if let Err(e) = std::fs::create_dir_all(&p) {
    return Err(e.to_string());
  }
  if let Err(e) = open::that(&p) {
    eprintln!("open folder failed: {e}");
  }
  Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn clear_storage_dir_cmd() -> Result<String, String> {
  let p = storage_dir();
  if p.exists() {
    if let Ok(entries) = std::fs::read_dir(&p) {
      for entry in entries.flatten() {
        let _ = std::fs::remove_file(entry.path()); // ignore per-file errors
      }
    }
  }
  Ok("cleared".into())
}

// NOTE: For now, we also store API key & prompt in storage_dir() so your app compiles.
// If you prefer private app data later, we can switch these to app_handle.path().app_data_dir().
#[derive(Deserialize)]
struct SaveApiKeyArgs {
  value: String,
}
#[tauri::command]
fn save_api_key_cmd(args: SaveApiKeyArgs) -> Result<(), String> {
  let p = storage_dir().join("apikey.txt");
  std::fs::create_dir_all(storage_dir()).map_err(|e| e.to_string())?;
  std::fs::write(p, args.value).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_api_key_cmd() -> Result<Option<String>, String> {
  let p = storage_dir().join("apikey.txt");
  if p.exists() {
    let s = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
    Ok(Some(s))
  } else {
    Ok(None)
  }
}

#[derive(Deserialize)]
struct SetPromptArgs {
  value: String,
}
#[tauri::command]
fn set_prompt_preset_cmd(args: SetPromptArgs) -> Result<(), String> {
  let p = storage_dir().join("prompt.txt");
  std::fs::create_dir_all(storage_dir()).map_err(|e| e.to_string())?;
  std::fs::write(p, args.value).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_prompt_preset_cmd() -> Result<Option<String>, String> {
  let p = storage_dir().join("prompt.txt");
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

/* ------------------------------ Tauri entry ------------------------------ */

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
      // Frontend audio save
      save_audio_base64,
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
