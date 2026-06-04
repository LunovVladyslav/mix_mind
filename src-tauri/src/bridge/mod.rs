// MixMind — Bridge Reader (Shared Memory)
// Reads all active VST plugin instances from the MixMindBridge shared memory block.
// Polls at 60Hz and emits Tauri events on change.

use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

/// Name of the named shared memory block (must match VST plugin)
const SHM_NAME: &str = "MixMindBridge";

/// Magic number that validates this is a MixMind shm block
const MIXMIND_MAGIC: u32 = 0x4D4D4D42;

/// Maximum channels per the protocol
const MAX_CHANNELS: usize = 64;

/// Number of 1/3-octave FFT bands
const FFT_BANDS: usize = 31;

/// Clean Rust struct representing one active channel — safe to send to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelSnapshot {
    pub instance_id:    String,
    pub display_name:   String,
    pub channel_type:   u8,
    pub routing_channel: u8,
    pub order:          u32,
    pub is_active:      bool,
    pub last_update:    u64,
    pub rms_l:          f32,
    pub rms_r:          f32,
    pub peak_l:         f32,
    pub peak_r:         f32,
    pub lufs_m:         f32,
    pub lufs_s:         f32,
    pub true_peak:      f32,
    pub crest_factor:   f32,
    pub gain_reduction: f32,
    pub fft_bands:      Vec<f32>,
    pub correlation:    f32,
    pub mid_level:      f32,
    pub side_level:     f32,
    pub bpm:            f64,
    pub sample_rate:    f32,
    pub is_playing:     bool,
    pub osc_port:       u16,
    /// true if last_update is within the last 500ms
    pub fresh:          bool,
}

/// Main polling loop — runs in a background tokio task.
/// Opens shared memory on each poll (avoids Send issues with Shmem).
pub async fn polling_loop(app: AppHandle) {
    let poll_interval    = Duration::from_millis(16);   // ~60Hz
    let retry_interval   = Duration::from_millis(500);  // retry when not connected
    let mut last_snapshot_ids: Vec<String> = Vec::new();
    let mut was_connected = false;

    loop {
        let channels = read_channels_from_shm();
        let connected = !channels.is_empty() || shm_exists();

        // Emit connection status change
        if connected != was_connected {
            was_connected = connected;
            let _ = app.emit("bridge-status", serde_json::json!({ "connected": connected }));
        }

        // Detect changes in channel data
        let current_ids: Vec<String> = channels.iter()
            .map(|c| format!("{}:{}", c.instance_id, c.last_update))
            .collect();

        if current_ids != last_snapshot_ids {
            last_snapshot_ids = current_ids;
            let _ = app.emit("channels-updated", &channels);
        }

        let interval = if connected { poll_interval } else { retry_interval };
        tokio::time::sleep(interval).await;
    }
}

/// Check if the shared memory block exists and has valid magic
fn shm_exists() -> bool {
    use shared_memory::ShmemConf;
    match ShmemConf::new().os_id(SHM_NAME).allow_raw(true).open() {
        Ok(shmem) => {
            if shmem.len() < 8 { return false; }
            let magic = unsafe { *(shmem.as_ptr() as *const u32).add(1) };
            magic == MIXMIND_MAGIC
        }
        Err(e) => {
            println!("shm_exists open error: {}", e);
            false
        }
    }
}

/// Read channels from shared memory. Opens and closes SHM on each call
/// to avoid storing non-Send types across await points.
fn read_channels_from_shm() -> Vec<ChannelSnapshot> {
    use shared_memory::ShmemConf;

    // Open shared memory (non-async, no await here)
    let shmem = match ShmemConf::new().os_id(SHM_NAME).allow_raw(true).open() {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let min_size = std::mem::size_of::<u32>() * 4 + 48; // header size
    if shmem.len() < min_size {
        return Vec::new();
    }

    let ptr = shmem.as_ptr();

    // Read header fields using volatile reads
    let spinlock = unsafe { std::ptr::read_volatile(ptr as *const u32) };
    let magic    = unsafe { std::ptr::read_volatile((ptr as *const u32).add(1)) };
    let _version = unsafe { std::ptr::read_volatile((ptr as *const u32).add(2)) };
    let slot_count = unsafe { std::ptr::read_volatile((ptr as *const u32).add(3)) };

    if magic != MIXMIND_MAGIC {
        return Vec::new();
    }

    // Skip if locked (but don't stall — just read anyway after brief spin)
    if spinlock != 0 {
        std::hint::spin_loop();
    }

    let slot_count = (slot_count as usize).min(MAX_CHANNELS);

    // Header is: spinlock(4) + magic(4) + version(4) + slot_count(4) + reserved(48) = 64 bytes
    let header_size = 64usize;
    let slot_size = slot_size_bytes();

    if shmem.len() < header_size + slot_count * slot_size {
        println!("shmem len too small! len: {}, expected: {}, slot_count: {}", shmem.len(), header_size + slot_count * slot_size, slot_count);
        return Vec::new();
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut channels = Vec::with_capacity(slot_count);

    for i in 0..slot_count {
        let slot_ptr = unsafe { ptr.add(header_size + i * slot_size) };

        // Read fields from packed struct by known offsets
        let instance_id  = read_c_str(slot_ptr, 0, 64);
        let display_name = read_c_str(slot_ptr, 64, 64);
        let channel_type = unsafe { std::ptr::read_volatile(slot_ptr.add(128)) };
        let routing_channel = unsafe { std::ptr::read_volatile(slot_ptr.add(129)) };
        let order        = unsafe { std::ptr::read_unaligned(slot_ptr.add(130) as *const u32) };
        let is_active    = unsafe { std::ptr::read_volatile(slot_ptr.add(134)) };
        let last_update  = unsafe { std::ptr::read_unaligned(slot_ptr.add(135) as *const u64) };

        if is_active == 0 { continue; }

        let rms_l        = read_f32(slot_ptr, 143);
        let rms_r        = read_f32(slot_ptr, 147);
        let peak_l       = read_f32(slot_ptr, 151);
        let peak_r       = read_f32(slot_ptr, 155);
        let lufs_m       = read_f32(slot_ptr, 159);
        let lufs_s       = read_f32(slot_ptr, 163);
        let true_peak    = read_f32(slot_ptr, 167);
        let crest_factor = read_f32(slot_ptr, 171);
        let gain_red     = read_f32(slot_ptr, 175);

        let mut fft_bands = Vec::with_capacity(FFT_BANDS);
        for b in 0..FFT_BANDS {
            fft_bands.push(read_f32(slot_ptr, 179 + b * 4));
        }

        let correlation  = read_f32(slot_ptr, 179 + FFT_BANDS * 4);
        let mid_level    = read_f32(slot_ptr, 179 + FFT_BANDS * 4 + 4);
        let side_level   = read_f32(slot_ptr, 179 + FFT_BANDS * 4 + 8);
        let bpm          = unsafe { std::ptr::read_unaligned(
            slot_ptr.add(179 + FFT_BANDS * 4 + 12) as *const f64
        )};
        let sample_rate  = read_f32(slot_ptr, 179 + FFT_BANDS * 4 + 20);
        let is_playing   = unsafe { std::ptr::read_volatile(slot_ptr.add(179 + FFT_BANDS * 4 + 24)) };
        let osc_port     = unsafe { std::ptr::read_unaligned(slot_ptr.add(179 + FFT_BANDS * 4 + 25) as *const u16) };

        let fresh = now_ms.saturating_sub(last_update) < 500;

        channels.push(ChannelSnapshot {
            instance_id,
            display_name,
            channel_type,
            routing_channel,
            order,
            is_active: true,
            last_update,
            rms_l, rms_r, peak_l, peak_r,
            lufs_m, lufs_s, true_peak, crest_factor,
            gain_reduction: gain_red,
            fft_bands,
            correlation, mid_level, side_level,
            bpm, sample_rate,
            is_playing: is_playing != 0,
            osc_port,
            fresh,
        });
    }

    // Sort by user-defined order
    channels.sort_by_key(|c| c.order);
    channels
}

/// Calculate slot size from the packed C struct layout
fn slot_size_bytes() -> usize {
    331
}

#[inline]
fn read_f32(base: *const u8, offset: usize) -> f32 {
    unsafe { std::ptr::read_unaligned(base.add(offset) as *const f32) }
}

fn read_c_str(base: *const u8, offset: usize, max_len: usize) -> String {
    let bytes: Vec<u8> = (0..max_len)
        .map(|i| unsafe { std::ptr::read_volatile(base.add(offset + i)) })
        .collect();
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(max_len);
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

/// Public API used by Tauri commands
#[allow(dead_code)]
pub fn get_channels_snapshot() -> Vec<ChannelSnapshot> {
    read_channels_from_shm()
}

pub fn is_connected() -> bool {
    shm_exists()
}

/// Async wrapper for use in commands
pub async fn get_channels_from_shm() -> Vec<ChannelSnapshot> {
    tokio::task::spawn_blocking(read_channels_from_shm)
        .await
        .unwrap_or_default()
}
