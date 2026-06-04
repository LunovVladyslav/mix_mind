// MixMind — Mock Bridge CLI
// Writes simulated VST channel data to shared memory for testing.
// Run with: cargo run --bin mock-bridge
//
// This simulates 3 VST instances (Kick, Bass, Master) with animated values.

use shared_memory::ShmemConf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SHM_NAME: &str = "MixMindBridge";
const MIXMIND_MAGIC: u32 = 0x4D4D4D42;
const MAX_CHANNELS: usize = 64;
const FFT_BANDS: usize = 31;

#[repr(C, packed)]
struct RawChannelSlot {
    instance_id:    [u8; 64],
    display_name:   [u8; 64],
    channel_type:   u8,
    order:          u32,
    is_active:      u8,
    last_update:    u64,
    rms_l:          f32,
    rms_r:          f32,
    peak_l:         f32,
    peak_r:         f32,
    lufs_m:         f32,
    lufs_s:         f32,
    true_peak:      f32,
    crest_factor:   f32,
    gain_reduction: f32,
    fft_bands:      [f32; FFT_BANDS],
    correlation:    f32,
    mid_level:      f32,
    side_level:     f32,
    bpm:            f64,
    sample_rate:    f32,
    is_playing:     u8,
    _pad:           [u8; 3],
}

#[repr(C, packed)]
struct SharedLayout {
    spinlock:   u32,
    magic:      u32,
    version:    u32,
    slot_count: u32,
    _reserved:  [u8; 48],
    slots:      [RawChannelSlot; MAX_CHANNELS],
}

fn main() {
    println!("MixMind Mock Bridge");
    println!("Writing to shared memory: {}", SHM_NAME);
    println!("Press Ctrl+C to stop\n");

    let shm_size = std::mem::size_of::<SharedLayout>();
    println!("SharedLayout size: {} bytes ({:.1} KB)", shm_size, shm_size as f64 / 1024.0);

    // Create shared memory block
    let mut shmem = ShmemConf::new()
        .size(shm_size)
        .os_id(SHM_NAME)
        .create()
        .expect("Failed to create shared memory");

    println!("Shared memory created ✓\n");

    // Initialize the layout
    let layout = unsafe { &mut *(shmem.as_ptr() as *mut SharedLayout) };
    layout.magic = MIXMIND_MAGIC;
    layout.version = 1;
    layout.slot_count = 3;
    layout.spinlock = 0;

    // Channel definitions
    let channels = [
        ("kick-uuid-0001", "Kick Drum",  0u8, 1u32),
        ("bass-uuid-0002", "Bass Guitar", 0u8, 2u32),
        ("master-uuid-03", "Master",      4u8, 99u32),
    ];

    for (i, (id, name, ch_type, order)) in channels.iter().enumerate() {
        let slot = &mut layout.slots[i];
        fill_str(&mut slot.instance_id, id);
        fill_str(&mut slot.display_name, name);
        slot.channel_type = *ch_type;
        slot.order = *order;
        slot.is_active = 1;
        slot.bpm = 120.0;
        slot.sample_rate = 48000.0;
        slot.is_playing = 1;
    }

    println!("Channels initialized:");
    for (_, (_, name, _, _)) in channels.iter().enumerate() {
        println!("  - {}", name);
    }
    println!("\nUpdating at 60Hz...\n");

    let mut t = 0f32;
    let start = std::time::Instant::now();

    loop {
        t = start.elapsed().as_secs_f32();
        let now_ms = unix_ms();

        // Animate values with sine waves (simulates live audio)
        let kick_level = -18.0 + 6.0 * (t * 2.0).sin();
        let bass_level = -22.0 + 4.0 * (t * 1.3).sin();
        let master_level = -14.0 + 2.0 * (t * 0.5).sin();

        layout.spinlock = 1; // Lock

        // Kick slot
        {
            let slot = &mut layout.slots[0];
            slot.last_update = now_ms;
            slot.rms_l = kick_level;
            slot.rms_r = kick_level - 0.5;
            slot.peak_l = kick_level + 6.0;
            slot.peak_r = kick_level + 5.5;
            slot.lufs_m = kick_level - 3.0;
            slot.lufs_s = kick_level - 2.0;
            slot.true_peak = kick_level + 7.0;
            slot.crest_factor = 12.0;
            slot.correlation = 0.95;
            slot.mid_level = kick_level + 1.0;
            slot.side_level = kick_level - 8.0;
            // Low-heavy spectrum for kick
            for b in 0..FFT_BANDS {
                let center_hz = band_hz(b);
                let envelope = if center_hz < 100.0 {
                    kick_level + 6.0
                } else if center_hz < 250.0 {
                    kick_level - 2.0
                } else {
                    kick_level - (center_hz / 250.0).log2() * 8.0
                };
                slot.fft_bands[b] = envelope + (t * (b as f32 + 1.0)).sin() * 1.0;
            }
        }

        // Bass slot
        {
            let slot = &mut layout.slots[1];
            slot.last_update = now_ms;
            slot.rms_l = bass_level;
            slot.rms_r = bass_level - 0.3;
            slot.peak_l = bass_level + 4.0;
            slot.peak_r = bass_level + 3.8;
            slot.lufs_m = bass_level - 2.0;
            slot.lufs_s = bass_level - 1.5;
            slot.true_peak = bass_level + 5.0;
            slot.crest_factor = 8.0;
            slot.correlation = 0.88;
            slot.mid_level = bass_level + 2.0;
            slot.side_level = bass_level - 6.0;
            for b in 0..FFT_BANDS {
                let center_hz = band_hz(b);
                let envelope = if center_hz < 200.0 {
                    bass_level + 4.0
                } else if center_hz < 500.0 {
                    bass_level
                } else {
                    bass_level - (center_hz / 500.0).log2() * 6.0
                };
                slot.fft_bands[b] = envelope + (t * (b as f32 * 0.7 + 0.5)).sin() * 1.5;
            }
        }

        // Master slot
        {
            let slot = &mut layout.slots[2];
            slot.last_update = now_ms;
            slot.rms_l = master_level;
            slot.rms_r = master_level - 0.2;
            slot.peak_l = master_level + 2.0;
            slot.peak_r = master_level + 1.8;
            slot.lufs_m = master_level - 1.0;
            slot.lufs_s = master_level - 0.5;
            slot.true_peak = master_level + 2.5;
            slot.crest_factor = 6.0;
            slot.correlation = 0.75;
            slot.mid_level = master_level + 1.0;
            slot.side_level = master_level - 3.0;
            for b in 0..FFT_BANDS {
                slot.fft_bands[b] = master_level - 2.0 + (t * (b as f32 * 0.3)).sin() * 2.0;
            }
        }

        layout.spinlock = 0; // Unlock

        // Print status every 60 frames (~1 second)
        let frame = (t * 60.0) as u64;
        if frame % 60 == 0 {
            println!("t={:.1}s  Kick: {:.1}dB  Bass: {:.1}dB  Master: {:.1}dB",
                     t, kick_level, bass_level, master_level);
        }

        std::thread::sleep(Duration::from_millis(16)); // ~60Hz
    }
}

fn fill_str(buf: &mut [u8], s: &str) {
    buf.fill(0);
    let bytes = s.as_bytes();
    let len = bytes.len().min(buf.len() - 1);
    buf[..len].copy_from_slice(&bytes[..len]);
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn band_hz(band: usize) -> f32 {
    const CENTERS: [f32; 31] = [
        20.0, 25.0, 31.5, 40.0, 50.0, 63.0, 80.0, 100.0, 125.0, 160.0,
        200.0, 250.0, 315.0, 400.0, 500.0, 630.0, 800.0, 1000.0, 1250.0,
        1600.0, 2000.0, 2500.0, 3150.0, 4000.0, 5000.0, 6300.0, 8000.0,
        10000.0, 12500.0, 16000.0, 20000.0,
    ];
    CENTERS[band.min(30)]
}
