#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Default)]
struct AppState {
    session_id: Option<String>,
    is_recording: bool,
    is_paused: bool,
    last_wav: Option<String>,
}

#[derive(Serialize)]
struct StartResponse {
    session_id: String,
    first_chunk: String, // placeholder for symmetry with your UI
}

#[derive(Serialize)]
struct StopResponse {
    message: String,
    final_wav: Option<String>,
}

#[derive(Serialize)]
struct TranscribeResponse {
    text: String,
}

// === Commands ===

#[tauri::command]
fn start_recording(state: tauri::State<Mutex<AppState>>) -> Result<StartResponse, String> {
    let mut s = state.lock().map_err(|_| "state lock error".to_string())?;
    let id = Uuid::new_v4().to_string();
    s.session_id = Some(id.clone());
    s.is_recording = true;
    s.is_paused = false;
    Ok(StartResponse {
        session_id: id,
        first_chunk: String::from("stub"),
    })
}

#[tauri::command]
fn pause_recording(state: tauri::State<Mutex<AppState>>) -> Result<String, String> {
    let mut s = state.lock().map_err(|_| "state lock error".to_string())?;
    if !s.is_recording {
        return Err("not recording".into());
    }
    s.is_paused = true;
    Ok("paused".into())
}

#[tauri::command]
fn resume_recording(state: tauri::State<Mutex<AppState>>) -> Result<String, String> {
    let mut s = state.lock().map_err(|_| "state lock error".to_string())?;
    if !s.is_recording {
        return Err("not recording".into());
    }
    s.is_paused = false;
    Ok("recording".into())
}

#[tauri::command]
fn stop_recording(state: tauri::State<Mutex<AppState>>) -> Result<StopResponse, String> {
    let mut s = state.lock().map_err(|_| "state lock error".to_string())?;
    if !s.is_recording {
        return Err("not recording".into());
    }
    s.is_recording = false;
    s.is_paused = false;

    // Stub: pretend we saved a WAV file
    s.last_wav = Some("C:/temp/applesauce_last.wav".into());

    Ok(StopResponse {
        message: "stopped".into(),
        final_wav: s.last_wav.clone(),
    })
}

#[tauri::command]
fn transcribe_latest(
    state: tauri::State<Mutex<AppState>>,
    _session_id: String,
    _model: Option<String>,
) -> Result<TranscribeResponse, String> {
    let s = state.lock().map_err(|_| "state lock error".to_string())?;
    if s.last_wav.is_none() {
        return Ok(TranscribeResponse {
            text: "No audio found to transcribe (stub).".into(),
        });
    }
    // Stub transcription text
    Ok(TranscribeResponse {
        text: "This is a stub transcript from the backend.".into(),
    })
}

#[tauri::command]
fn import_audio_file(_path: String) -> Result<String, String> {
    Ok("import_audio_file stub ok".into())
}

#[tauri::command]
fn import_youtube_audio(_url: String) -> Result<String, String> {
    Ok("import_youtube_audio stub ok".into())
}

#[tauri::command]
fn import_pdf_file(_path: String) -> Result<String, String> {
    Ok("import_pdf_file stub ok".into())
}

#[tauri::command]
fn open_storage_dir() -> Result<String, String> {
    Ok("open_storage_dir stub ok".into())
}

#[tauri::command]
fn clear_storage_dir() -> Result<String, String> {
    Ok("clear_storage_dir stub ok".into())
}

#[tauri::command]
fn save_api_key(_value: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn read_api_key() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
fn set_prompt_preset(_value: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn get_prompt_preset() -> Result<Option<String>, String> {
    Ok(Some("Summary".into()))
}

#[tauri::command]
fn open_quizlet() -> Result<(), String> {
    // In a fuller setup, use tauri-plugin-opener; this is a no-op stub for now.
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            start_recording,
            pause_recording,
            resume_recording,
            stop_recording,
            transcribe_latest,
            import_audio_file,
            import_youtube_audio,
            import_pdf_file,
            open_storage_dir,
            clear_storage_dir,
            save_api_key,
            read_api_key,
            set_prompt_preset,
            get_prompt_preset,
            open_quizlet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
