// MixMind — Context Builder
// Assembles the audio analysis data into compact JSON for Claude API calls.

use serde_json::{json, Value};

use crate::bridge::ChannelSnapshot;
use crate::audio::analyzer::AnalysisResult;
use super::prompts::{DAW_CONTEXT_PREFIX, FILE_CONTEXT_PREFIX, monitor_hint};
use super::style_detector::{detect_style, genre_from_str, Genre};

const MAX_CONTEXT_CHARS: usize = 8000; // increased for knowledge injection

/// Build context JSON for DAW mode (multiple channels from VST bridge)
pub fn build_daw_context(
    channels: &[ChannelSnapshot],
    selected_channel: Option<&str>,
    monitor_device: &str,
    user_genre: Option<&str>,
    reference_track: Option<&str>,
) -> String {
    // Session-level info (from first playing channel or master)
    let master = channels.iter().find(|c| c.channel_type == 4);
    let playing = channels.iter().find(|c| c.is_playing);

    let bpm = playing.map(|c| c.bpm as f32).unwrap_or(0.0_f32);

    // Auto-detect genre from master or first playing channel
    let fft_source = master.or(playing);
    let detected = fft_source.map(|c| detect_style(bpm, c.fft_bands.as_slice()));

    // User override takes priority over auto-detection
    let effective_genre = user_genre
        .and_then(|g| genre_from_str(g))
        .or_else(|| detected.as_ref().map(|d| d.genre.clone()))
        .unwrap_or(Genre::Unknown);

    let style_json = json!({
        "genre": effective_genre.display_name(),
        "genreTag": effective_genre.to_kb_tag(),
        "confidence": detected.as_ref().map(|d| d.confidence).unwrap_or(0.0),
        "userSet": user_genre.is_some(),
        "referenceTrack": reference_track,
    });

    let session = json!({
        "bpm": bpm,
        "sampleRate": playing.map(|c| c.sample_rate).unwrap_or(48000.0),
        "isPlaying": playing.is_some(),
        "channelCount": channels.len(),
    });

    // Find the selected channel to get its display_name for related-channel filtering
    let selected_display_name: Option<String> = selected_channel.and_then(|sel_id| {
        channels.iter().find(|c| c.instance_id == sel_id)
            .map(|c| c.display_name.clone())
    });

    let mut instruments = Vec::new();
    let mut drum_buses = Vec::new();
    let mut buses = Vec::new();
    let mut sends = Vec::new();

    for c in channels {
        let is_selected = selected_channel.map(|id| c.instance_id == id).unwrap_or(false);
        let is_master = c.channel_type == 4;
        let is_controllable = c.osc_port > 0;

        if let Some(sel_id) = selected_channel {
            if !is_selected && !is_master {
                // Only include controllable channels that share the same display_name
                // as the selected channel. This prevents AI from seeing Drums MultiFX
                // when the user has Guitars selected.
                if !is_controllable {
                    continue; // skip non-controllable non-selected channels
                }
                // Skip controllable channels from OTHER tracks (different name)
                if let Some(ref sel_name) = selected_display_name {
                    if c.display_name.to_lowercase() != sel_name.to_lowercase() {
                        continue;
                    }
                }
                let _ = sel_id; // suppress unused warning
            }
        }

        let type_name = channel_type_name(c.channel_type);
        let ch_json = json!({
            "id": c.instance_id.clone(),
            "name": c.display_name,
            "type": type_name,
            "isControllable": is_controllable,
            "oscPort": c.osc_port,
            // Explicit target marker so AI never guesses wrong channel
            "isTarget": is_selected && !is_master,
            "levels": {
                "rmsL":         round2(c.rms_l),
                "rmsR":         round2(c.rms_r),
                "peakL":        round2(c.peak_l),
                "peakR":        round2(c.peak_r),
                "lufsM":        round2(c.lufs_m),
                "lufsS":        round2(c.lufs_s),
                "truePeak":     round2(c.true_peak),
                "crestFactor":  round2(c.crest_factor),
                "gainReduction":round2(c.gain_reduction),
            },
            "stereo": {
                "correlation": round2(c.correlation),
                "midLevel":    round2(c.mid_level),
                "sideLevel":   round2(c.side_level),
            },
            "transport": {
                "bpm":       round2(c.bpm as f32),
                "sampleRate":c.sample_rate as u32,
                "isPlaying": c.is_playing,
            },
            "spectrum": compress_fft(&c.fft_bands),
        });

        match c.channel_type {
            0 => instruments.push(ch_json),
            1 => drum_buses.push(ch_json),
            2 => buses.push(ch_json),
            3 => sends.push(ch_json),
            _ => {},
        }
    }

    let master_json = master.map(|m| json!({
        "rmsL":          round2(m.rms_l),
        "rmsR":          round2(m.rms_r),
        "peakL":         round2(m.peak_l),
        "peakR":         round2(m.peak_r),
        "lufsM":         round2(m.lufs_m),
        "lufsS":         round2(m.lufs_s),
        "truePeak":      round2(m.true_peak),
        "crestFactor":   round2(m.crest_factor),
        "gainReduction": round2(m.gain_reduction),
        "correlation":   round2(m.correlation),
        "midLevel":      round2(m.mid_level),
        "sideLevel":     round2(m.side_level),
        "bpm":           round2(m.bpm as f32),
        "sampleRate":    m.sample_rate as u32,
        "isPlaying":     m.is_playing,
        "spectrum":      compress_fft(&m.fft_bands),
    }));

    // Build top-level target hint for AI
    let target_hint = selected_display_name.as_deref().unwrap_or("all channels");

    let mut ctx = json!({
        "mode": "daw_capture",
        // Explicit instruction: which channel the user wants to work on
        "targetChannel": target_hint,
        "mixStyle": style_json,
        "session": session,
        "tracks": {
            "instruments": instruments,
            "drumBuses": drum_buses,
            "groupsAndBuses": buses,
            "sendsAndFX": sends,
        },
        "master": master_json,
    });

    // Add monitor compensation hint if applicable
    if let Some(hint) = monitor_hint(monitor_device) {
        ctx["monitorNote"] = json!(hint);
    }

    let ctx_str = serde_json::to_string(&ctx).unwrap_or_default();
    truncate_context(
        &format!("{}{}", DAW_CONTEXT_PREFIX, ctx_str),
        MAX_CONTEXT_CHARS
    )
}


/// Build context JSON for File mode (single audio file analysis)
pub fn build_file_context(result: &AnalysisResult, filename: &str, monitor_device: &str) -> String {
    let ctx = json!({
        "mode": "file",
        "filename": filename,
        "duration": round2(result.duration_secs),
        "sampleRate": result.sample_rate,
        "loudness": {
            "lufsIntegrated": round2(result.lufs_integrated),
            "lufsRange": round2(result.lufs_range),
            "truePeak": round2(result.true_peak),
            "dynamicRange": round2(result.dynamic_range),
        },
        "tempo": {
            "bpm": round2(result.bpm),
            "confidence": round2(result.bpm_confidence),
        },
        "key": result.key,
        "stereo": {
            "correlation": round2(result.stereo_correlation),
            "msRatio": round2(result.ms_ratio),
        },
        "spectral": {
            "centroid": round2(result.spectral_centroid),
            "profile": compress_fft(&result.fft_profile),
        },
        "transientDensity": round2(result.transient_density),
        "monitorNote": monitor_hint(monitor_device),
    });

    let ctx_str = serde_json::to_string(&ctx).unwrap_or_default();
    truncate_context(
        &format!("{}{}", FILE_CONTEXT_PREFIX, ctx_str),
        MAX_CONTEXT_CHARS
    )
}

/// Round to 2 decimal places for compact JSON
fn round2(x: f32) -> f32 {
    (x * 100.0).round() / 100.0
}

/// Compress FFT bands to integers (saves context space)
/// Rounds to nearest 0.5 dBFS
fn compress_fft(bands: &[f32]) -> Vec<f32> {
    bands.iter().map(|&b| (b * 2.0).round() / 2.0).collect()
}

/// Human-readable channel type name
fn channel_type_name(t: u8) -> &'static str {
    match t {
        0 => "instrument",
        1 => "drum_bus",
        2 => "bus",
        3 => "send",
        4 => "master",
        _ => "unknown",
    }
}

/// Truncate context string to max_chars while preserving valid JSON suffix
fn truncate_context(s: &str, max_chars: usize) -> String {
    if s.len() <= max_chars {
        return s.to_string();
    }
    // Simple truncation — the important fields come first
    let mut out = s[..max_chars - 20].to_string();
    out.push_str("... [truncated]}");
    out
}
