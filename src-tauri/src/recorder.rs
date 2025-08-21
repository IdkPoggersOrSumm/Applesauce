use anyhow::{anyhow, Result};
use crossbeam_channel::{unbounded, Receiver, Sender};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::{
  fs,
  path::{Path, PathBuf},
  thread,
  time::SystemTime,
};

#[derive(Debug, Clone, Copy)]
pub enum Cmd {
  Pause,
  Resume,
  Stop,
}

#[derive(Debug)]
pub struct RecorderState {
  // Control to the recording thread (if any).
  tx: Option<Sender<Cmd>>,
  // Simple session bookkeeping.
  session_id: Option<String>,
  // Where the last WAV landed (for stop response).
  last_wav: Option<PathBuf>,
  // Are we currently paused? (mirrors the thread’s state)
  paused: bool,
}

// Public API expected by main.rs
impl RecorderState {
  pub fn new() -> Self {
    Self {
      tx: None,
      session_id: None,
      last_wav: None,
      paused: false,
    }
  }
}

/// Returns our recording storage directory:
/// - Prefer the OS-native Downloads folder: <Downloads>/ApplesauceCacheNative
/// - Fallback to a temp dir if Downloads is unavailable
pub fn storage_dir() -> PathBuf {
  if let Some(mut d) = dirs::download_dir() {
    d.push("ApplesauceCacheNative");
    return d;
  }
  // Very unlikely, but if the platform has no Downloads dir:
  let mut d = std::env::temp_dir();
  d.push("ApplesauceCacheNative");
  d
}

// ---- high-level helpers called by Tauri commands ----

pub fn start_recording(state: &mut RecorderState) -> Result<(String, PathBuf)> {
  if state.tx.is_some() {
    return Err(anyhow!("recording already in progress"));
  }

  // Ensure our target folder exists (Downloads/ApplesauceCacheNative).
  let dir = storage_dir();
  fs::create_dir_all(&dir)?;

  let session_id = new_session_id();
  let wav_path = dir.join(format!("{session_id}.wav"));

  // Channel to control the audio thread
  let (tx, rx) = unbounded::<Cmd>();

  // Spawn the audio thread; keep all CPAL types inside this thread.
  let path_clone = wav_path.clone();
  thread::Builder::new()
    .name("recorder".into())
    .spawn(move || {
      if let Err(e) = run_audio_thread(rx, &path_clone) {
        eprintln!("audio thread failed: {e:?}");
      }
    })?;

  state.tx = Some(tx);
  state.session_id = Some(session_id.clone());
  state.last_wav = Some(wav_path.clone());
  state.paused = false;

  Ok((session_id, wav_path))
}

pub fn pause_recording(state: &mut RecorderState) -> Result<()> {
  if let Some(tx) = &state.tx {
    tx.send(Cmd::Pause).map_err(|e| anyhow!(e.to_string()))?;
    state.paused = true;
    Ok(())
  } else {
    Err(anyhow!("no active recording"))
  }
}

pub fn resume_recording(state: &mut RecorderState) -> Result<()> {
  if let Some(tx) = &state.tx {
    tx.send(Cmd::Resume).map_err(|e| anyhow!(e.to_string()))?;
    state.paused = false;
    Ok(())
  } else {
    Err(anyhow!("no active recording"))
  }
}

pub fn stop_recording(state: &mut RecorderState) -> Result<PathBuf> {
  if let Some(tx) = state.tx.take() {
    // Ignore send error if thread already exited
    tx.send(Cmd::Stop).ok();
  } else {
    return Err(anyhow!("no active recording"));
  }
  // We could join the thread or wait for an ACK; for now, return the last path.
  let out = state
    .last_wav
    .clone()
    .ok_or_else(|| anyhow!("no wav produced"))?;
  Ok(out)
}

// ---- audio thread ----

// NOTE: This stub writes silence to WAV, but it’s structured so you can
// drop in CPAL device/stream creation INSIDE this function without making
// the outer `RecorderState` non-Send.
fn run_audio_thread(rx: Receiver<Cmd>, wav_path: &Path) -> Result<()> {
  // Example WAV writer
  let spec = WavSpec {
    channels: 1,
    sample_rate: 16_000,
    bits_per_sample: 16,
    sample_format: SampleFormat::Int,
  };
  let mut writer = WavWriter::create(wav_path, spec)?;

  let mut paused = false;
  let mut running = true;

  while running {
    // Poll for control messages; in a real impl you'd also pull audio frames
    // from CPAL callback into a ring buffer and write here when !paused.
    if let Ok(cmd) = rx.try_recv() {
      match cmd {
        Cmd::Pause => paused = true,
        Cmd::Resume => paused = false,
        Cmd::Stop => {
          running = false;
          continue;
        }
      }
    }
    if !paused {
      let sample: i16 = 0; // silence placeholder
      writer.write_sample(sample)?;
    }
    // Tiny sleep to keep the loop from burning CPU in this stub.
    std::thread::sleep(std::time::Duration::from_millis(10));
  }
  writer.finalize()?;
  Ok(())
}

fn new_session_id() -> String {
  // simple timestamp-based id; feel free to switch to uuid if preferred
  let ts = SystemTime::now()
    .duration_since(SystemTime::UNIX_EPOCH)
    .unwrap()
    .as_millis();
  format!("sess-{ts}")
}
