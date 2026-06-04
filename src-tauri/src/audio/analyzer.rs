// MixMind — Audio Analyzer
// Full analysis pipeline: LUFS, FFT, BPM, Key, True Peak, Stereo field.
// Implements ITU-R BS.1770-4 for LUFS measurements.

use anyhow::Result;
use rustfft::{FftPlanner, num_complex::Complex};
use serde::{Deserialize, Serialize};
use std::f32::consts::PI;

use super::decoder::AudioBuffer;

#[allow(dead_code)]
const SAMPLE_RATE: f32 = 48_000.0;

/// Full analysis result for a single audio file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub lufs_integrated:    f32,   // Full-file LUFS
    pub lufs_range:         f32,   // Loudness range (LRA)
    pub true_peak:          f32,   // dBTP (4x oversampled)
    pub dynamic_range:      f32,   // Average crest factor
    pub bpm:                f32,   // Detected tempo
    pub bpm_confidence:     f32,   // 0.0–1.0
    pub key:                String,// e.g. "F minor"
    pub fft_profile:        Vec<f32>, // 31 bands, time-averaged, dBFS
    pub spectral_centroid:  f32,   // Hz
    pub stereo_correlation: f32,   // avg over file
    pub ms_ratio:           f32,   // mid/side energy ratio
    pub transient_density:  f32,   // onsets per beat
    pub duration_secs:      f32,
    pub sample_rate:        u32,
}

/// 1/3-octave band center frequencies (31 bands, 20Hz–20kHz)
const BAND_CENTERS: [f32; 31] = [
    20.0, 25.0, 31.5, 40.0, 50.0, 63.0, 80.0, 100.0, 125.0, 160.0,
    200.0, 250.0, 315.0, 400.0, 500.0, 630.0, 800.0, 1000.0, 1250.0,
    1600.0, 2000.0, 2500.0, 3150.0, 4000.0, 5000.0, 6300.0, 8000.0,
    10000.0, 12500.0, 16000.0, 20000.0,
];

/// Main analysis entry point
pub fn analyze(buf: &AudioBuffer) -> Result<AnalysisResult> {
    let left  = &buf.samples[0];
    let right = &buf.samples[1];
    let sr = buf.sample_rate as f32;

    log::info!("Analyzing {} samples at {}Hz", left.len(), sr);

    // Mix to mono for some analyses
    let mono: Vec<f32> = left.iter().zip(right.iter())
        .map(|(l, r)| (l + r) * 0.5)
        .collect();

    // ── LUFS (ITU-R BS.1770-4) ─────────────────────────────────────────
    let (lufs_integrated, lufs_range) = compute_lufs(left, right, sr);

    // ── True Peak (4x oversampled) ──────────────────────────────────────
    let true_peak = compute_true_peak(left, right);

    // ── Dynamic Range (crest factor) ───────────────────────────────────
    let dynamic_range = compute_crest_factor(&mono);

    // ── FFT Profile (31 bands, time-averaged) ──────────────────────────
    let (fft_profile, spectral_centroid) = compute_fft_profile(&mono, sr);

    // ── Stereo Field ────────────────────────────────────────────────────
    let (stereo_correlation, ms_ratio) = compute_stereo_field(left, right);

    // ── BPM Detection (autocorrelation) ─────────────────────────────────
    let (bpm, bpm_confidence) = detect_bpm(&mono, sr);

    // ── Key Detection (Krumhansl-Schmuckler) ────────────────────────────
    let key = detect_key(&mono, sr);

    // ── Transient Density ───────────────────────────────────────────────
    let transient_density = compute_transient_density(&mono, sr, bpm);

    Ok(AnalysisResult {
        lufs_integrated,
        lufs_range,
        true_peak,
        dynamic_range,
        bpm,
        bpm_confidence,
        key,
        fft_profile,
        spectral_centroid,
        stereo_correlation,
        ms_ratio,
        transient_density,
        duration_secs: buf.duration_secs,
        sample_rate: buf.sample_rate,
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// LUFS — ITU-R BS.1770-4
// ═══════════════════════════════════════════════════════════════════════════

fn compute_lufs(left: &[f32], right: &[f32], sr: f32) -> (f32, f32) {
    // K-weighting filter (two biquad stages)
    // Stage 1: High-shelf pre-filter
    // Stage 2: High-pass filter
    let filtered_l = k_weight_filter(left, sr);
    let filtered_r = k_weight_filter(right, sr);

    let block_size = (0.4 * sr) as usize;   // 400ms blocks
    let hop_size   = (0.1 * sr) as usize;   // 100ms hop (75% overlap)
    let total = filtered_l.len();

    let mut block_lufs: Vec<f32> = Vec::new();

    let mut i = 0;
    while i + block_size <= total {
        let block_l = &filtered_l[i..i + block_size];
        let block_r = &filtered_r[i..i + block_size];

        let mean_sq_l: f32 = block_l.iter().map(|x| x * x).sum::<f32>() / block_size as f32;
        let mean_sq_r: f32 = block_r.iter().map(|x| x * x).sum::<f32>() / block_size as f32;
        let power = mean_sq_l + mean_sq_r;

        // Absolute gate: -70 LUFS
        let lufs = -0.691 + 10.0 * power.max(1e-10).log10();
        if lufs > -70.0 {
            block_lufs.push(lufs);
        }

        i += hop_size;
    }

    if block_lufs.is_empty() {
        return (-100.0, 0.0);
    }

    // Relative gate: -10 LU below absolute-gated mean
    let abs_mean = block_lufs.iter().copied().sum::<f32>() / block_lufs.len() as f32;
    let rel_threshold = abs_mean - 10.0;

    let gated: Vec<f32> = block_lufs.iter().copied()
        .filter(|&l| l > rel_threshold)
        .collect();

    let integrated = if gated.is_empty() {
        abs_mean
    } else {
        gated.iter().copied().sum::<f32>() / gated.len() as f32
    };

    // Loudness Range (LRA): difference between 95th and 10th percentile
    let mut sorted = block_lufs.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p10_idx = (sorted.len() as f32 * 0.10) as usize;
    let p95_idx = (sorted.len() as f32 * 0.95) as usize;
    let lra = if p95_idx > p10_idx {
        sorted[p95_idx] - sorted[p10_idx]
    } else {
        0.0
    };

    (integrated, lra)
}

/// K-weighting filter (simplified biquad implementation)
fn k_weight_filter(input: &[f32], sr: f32) -> Vec<f32> {
    let mut out = input.to_vec();

    // Stage 1: High-shelf (+4dB at high frequencies)
    // Coefficients for 48kHz (from ITU-R BS.1770-4 Annex 1)
    let (b0, b1, b2, a1, a2) = if (sr - 48000.0).abs() < 1.0 {
        (1.53512485958697, -2.69169618940638, 1.19839281085285,
        -1.69065929318241, 0.73248077421585)
    } else {
        // Recalculate for other sample rates
        let f0 = 1681.974450955533;
        let g  = 3.999843853973347;
        let q  = 0.7071752369554196;
        let k  = (PI * f0 / sr).tan();
        let vb = 10f32.powf(g / 20.0);
        let vb_sqrt = vb.sqrt();
        let d = 1.0 + k / q + k * k;
        let b0 = (1.0 + vb_sqrt / q * k + vb * k * k) / d;
        let b1 = 2.0 * (vb * k * k - 1.0) / d;
        let b2 = (1.0 - vb_sqrt / q * k + vb * k * k) / d;
        let a1 = 2.0 * (k * k - 1.0) / d;
        let a2 = (1.0 - k / q + k * k) / d;
        (b0, b1, b2, a1, a2)
    };

    biquad_filter(&mut out, b0, b1, b2, a1, a2);

    // Stage 2: High-pass (100Hz)
    let f0 = 38.13547087602444;
    let q  = 0.5003270373238773;
    let k  = (PI * f0 / sr).tan();
    let d  = k * k + k / q + 1.0;
    let b0h = 1.0 / d;
    let b1h = -2.0 / d;
    let b2h = 1.0 / d;
    let a1h = 2.0 * (k * k - 1.0) / d;
    let a2h = (k * k - k / q + 1.0) / d;

    biquad_filter(&mut out, b0h, b1h, b2h, a1h, a2h);

    out
}

fn biquad_filter(signal: &mut Vec<f32>, b0: f32, b1: f32, b2: f32, a1: f32, a2: f32) {
    let mut x1 = 0f32;
    let mut x2 = 0f32;
    let mut y1 = 0f32;
    let mut y2 = 0f32;

    for sample in signal.iter_mut() {
        let x0 = *sample;
        let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
        *sample = y0;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRUE PEAK (4x oversampled interpolation)
// ═══════════════════════════════════════════════════════════════════════════

fn compute_true_peak(left: &[f32], right: &[f32]) -> f32 {
    let tp_l = channel_true_peak(left);
    let tp_r = channel_true_peak(right);
    let tp_lin = tp_l.max(tp_r);
    linear_to_dbfs(tp_lin)
}

fn channel_true_peak(samples: &[f32]) -> f32 {
    // Simple 4x oversampling via linear interpolation (approximation)
    // For full accuracy, use sinc interpolation, but this is close enough for UI
    let mut peak = 0f32;
    for i in 0..samples.len() - 1 {
        let s0 = samples[i];
        let s1 = samples[i + 1];
        peak = peak.max(s0.abs());
        // Interpolate 3 points between samples
        for k in 1..4 {
            let t = k as f32 / 4.0;
            let interp = s0 + (s1 - s0) * t;
            peak = peak.max(interp.abs());
        }
    }
    peak
}

// ═══════════════════════════════════════════════════════════════════════════
// FFT Profile (31 1/3-octave bands)
// ═══════════════════════════════════════════════════════════════════════════

fn compute_fft_profile(mono: &[f32], sr: f32) -> (Vec<f32>, f32) {
    let fft_size = 4096;
    let hop = 2048;
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(fft_size);

    // Hann window
    let window: Vec<f32> = (0..fft_size)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (fft_size - 1) as f32).cos()))
        .collect();

    let mut band_accum = vec![0f32; 31];
    let mut band_count = vec![0u32; 31];
    let mut _frame_count = 0u32;
    let mut centroid_num = 0f64;
    let mut centroid_den = 0f64;

    let mut pos = 0;
    while pos + fft_size <= mono.len() {
        // Apply window and build complex buffer
        let mut buf: Vec<Complex<f32>> = mono[pos..pos + fft_size].iter()
            .zip(window.iter())
            .map(|(&s, &w)| Complex::new(s * w, 0.0))
            .collect();

        fft.process(&mut buf);

        // Magnitude spectrum (positive frequencies only)
        let mag: Vec<f32> = buf[..fft_size / 2].iter()
            .map(|c| c.norm() * 2.0 / fft_size as f32)
            .collect();

        // Map FFT bins to 1/3-octave bands
        let bin_hz = sr / fft_size as f32;
        for (b, &center) in BAND_CENTERS.iter().enumerate() {
            let lo = center / 2f32.powf(1.0 / 6.0);
            let hi = center * 2f32.powf(1.0 / 6.0);
            let bin_lo = ((lo / bin_hz) as usize).max(1);
            let bin_hi = ((hi / bin_hz) as usize).min(fft_size / 2 - 1);

            if bin_lo > bin_hi { continue; }

            let band_rms: f32 = mag[bin_lo..=bin_hi].iter()
                .map(|&m| m * m)
                .sum::<f32>()
                / (bin_hi - bin_lo + 1) as f32;
            let band_rms = band_rms.sqrt();

            band_accum[b] += linear_to_dbfs(band_rms);
            band_count[b] += 1;
        }

        // Spectral centroid for this frame
        for (bin, &m) in mag.iter().enumerate() {
            let freq = bin as f64 * bin_hz as f64;
            centroid_num += freq * m as f64;
            centroid_den += m as f64;
        }

        _frame_count += 1;
        pos += hop;
    }

    // Average bands over all frames
    let profile: Vec<f32> = band_accum.iter().zip(band_count.iter())
        .map(|(&sum, &count)| if count > 0 { sum / count as f32 } else { -120.0 })
        .collect();

    let centroid = if centroid_den > 0.0 {
        (centroid_num / centroid_den) as f32
    } else {
        1000.0
    };

    (profile, centroid)
}

// ═══════════════════════════════════════════════════════════════════════════
// STEREO FIELD
// ═══════════════════════════════════════════════════════════════════════════

fn compute_stereo_field(left: &[f32], right: &[f32]) -> (f32, f32) {
    let n = left.len().min(right.len()) as f32;

    let sum_lr: f32 = left.iter().zip(right.iter()).map(|(l, r)| l * r).sum();
    let sum_ll: f32 = left.iter().map(|l| l * l).sum();
    let sum_rr: f32 = right.iter().map(|r| r * r).sum();

    let correlation = sum_lr / (sum_ll.sqrt() * sum_rr.sqrt()).max(1e-10);

    // M/S ratio
    let mid_rms: f32 = ((left.iter().zip(right.iter())
        .map(|(l, r)| ((l + r) * 0.5).powi(2))
        .sum::<f32>()) / n).sqrt();

    let side_rms: f32 = ((left.iter().zip(right.iter())
        .map(|(l, r)| ((l - r) * 0.5).powi(2))
        .sum::<f32>()) / n).sqrt();

    let ms_ratio = if side_rms > 1e-10 {
        mid_rms / side_rms
    } else {
        f32::INFINITY
    };

    (correlation.clamp(-1.0, 1.0), ms_ratio)
}

// ═══════════════════════════════════════════════════════════════════════════
// CREST FACTOR
// ═══════════════════════════════════════════════════════════════════════════

fn compute_crest_factor(mono: &[f32]) -> f32 {
    let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
    let peak = mono.iter().map(|s| s.abs()).fold(0f32, f32::max);
    linear_to_dbfs(peak) - linear_to_dbfs(rms)
}

// ═══════════════════════════════════════════════════════════════════════════
// BPM Detection (autocorrelation)
// ═══════════════════════════════════════════════════════════════════════════

fn detect_bpm(mono: &[f32], sr: f32) -> (f32, f32) {
    // Downsample to ~4kHz for efficiency
    let downsample = (sr / 4000.0) as usize;
    let downsampled: Vec<f32> = mono.iter()
        .step_by(downsample.max(1))
        .copied()
        .collect();
    let ds_rate = sr / downsample as f32;

    // Compute onset strength signal (high-pass + rectify)
    let onset: Vec<f32> = compute_onset_strength(&downsampled);

    // Autocorrelation on onset signal
    let min_lag = (ds_rate * 60.0 / 200.0) as usize; // 200 BPM
    let max_lag = (ds_rate * 60.0 / 50.0) as usize;  // 50 BPM
    let max_lag = max_lag.min(onset.len() / 2);

    if min_lag >= max_lag || max_lag == 0 {
        return (120.0, 0.0);
    }

    let mut best_corr = f32::NEG_INFINITY;
    let mut best_lag = min_lag;

    for lag in min_lag..max_lag {
        let corr: f32 = onset[..onset.len() - lag].iter()
            .zip(onset[lag..].iter())
            .map(|(a, b)| a * b)
            .sum();
        if corr > best_corr {
            best_corr = corr;
            best_lag = lag;
        }
    }

    let bpm = 60.0 * ds_rate / best_lag as f32;

    // Confidence: ratio of best to average autocorrelation
    let avg_corr: f32 = (min_lag..max_lag)
        .map(|lag| {
            onset[..onset.len() - lag].iter()
                .zip(onset[lag..].iter())
                .map(|(a, b)| a * b)
                .sum::<f32>()
        })
        .sum::<f32>() / (max_lag - min_lag) as f32;

    let confidence = if avg_corr > 0.0 {
        (best_corr / avg_corr - 1.0).clamp(0.0, 1.0)
    } else {
        0.5
    };

    // Round to nearest 0.5 BPM
    let bpm = (bpm * 2.0).round() / 2.0;

    (bpm, confidence)
}

fn compute_onset_strength(signal: &[f32]) -> Vec<f32> {
    // Simple spectral flux onset detection
    let mut onset = vec![0f32; signal.len()];
    for i in 1..signal.len() {
        let diff = signal[i].abs() - signal[i - 1].abs();
        onset[i] = diff.max(0.0);
    }
    onset
}

// ═══════════════════════════════════════════════════════════════════════════
// Key Detection (Krumhansl-Schmuckler)
// ═══════════════════════════════════════════════════════════════════════════

fn detect_key(mono: &[f32], sr: f32) -> String {
    // Chroma vector — 12 pitch classes
    let chroma = compute_chroma(mono, sr);

    // Krumhansl-Schmuckler key profiles
    let major_profile: [f32; 12] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                                     2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    let minor_profile: [f32; 12] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                                     2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    let note_names = ["C", "C#", "D", "D#", "E", "F",
                      "F#", "G", "G#", "A", "A#", "B"];

    let mut best_corr = f32::NEG_INFINITY;
    let mut best_key = "C major".to_string();

    for root in 0..12 {
        // Rotate profiles to each root
        let maj_corr = pearson_corr(&chroma, &rotate(&major_profile, root));
        let min_corr = pearson_corr(&chroma, &rotate(&minor_profile, root));

        if maj_corr > best_corr {
            best_corr = maj_corr;
            best_key = format!("{} major", note_names[root]);
        }
        if min_corr > best_corr {
            best_corr = min_corr;
            best_key = format!("{} minor", note_names[root]);
        }
    }

    best_key
}

fn compute_chroma(mono: &[f32], sr: f32) -> [f32; 12] {
    let fft_size = 4096;
    let hop = 2048;
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(fft_size);

    let window: Vec<f32> = (0..fft_size)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (fft_size - 1) as f32).cos()))
        .collect();

    let mut chroma = [0f32; 12];
    let mut frame_count = 0u32;

    let mut pos = 0;
    while pos + fft_size <= mono.len() {
        let mut buf: Vec<Complex<f32>> = mono[pos..pos + fft_size].iter()
            .zip(window.iter())
            .map(|(&s, &w)| Complex::new(s * w, 0.0))
            .collect();
        fft.process(&mut buf);

        let bin_hz = sr / fft_size as f32;
        for (bin, c) in buf[..fft_size / 2].iter().enumerate() {
            let freq = bin as f32 * bin_hz;
            if freq < 65.41 || freq > 4186.01 { continue; } // C2 to C8

            // Convert frequency to MIDI note, then to pitch class
            let midi = 69.0 + 12.0 * (freq / 440.0).log2();
            let pitch_class = (midi.round() as i32).rem_euclid(12) as usize;
            chroma[pitch_class] += c.norm();
        }
        frame_count += 1;
        pos += hop;
    }

    if frame_count > 0 {
        for c in chroma.iter_mut() { *c /= frame_count as f32; }
    }
    chroma
}

fn rotate(arr: &[f32; 12], n: usize) -> [f32; 12] {
    let mut out = [0f32; 12];
    for i in 0..12 {
        out[i] = arr[(i + 12 - n) % 12];
    }
    out
}

fn pearson_corr(a: &[f32; 12], b: &[f32; 12]) -> f32 {
    let n = 12.0;
    let mean_a = a.iter().sum::<f32>() / n;
    let mean_b = b.iter().sum::<f32>() / n;

    let num: f32 = a.iter().zip(b.iter())
        .map(|(ai, bi)| (ai - mean_a) * (bi - mean_b))
        .sum();
    let den_a: f32 = a.iter().map(|ai| (ai - mean_a).powi(2)).sum::<f32>().sqrt();
    let den_b: f32 = b.iter().map(|bi| (bi - mean_b).powi(2)).sum::<f32>().sqrt();

    if den_a * den_b < 1e-10 { 0.0 } else { num / (den_a * den_b) }
}

// ═══════════════════════════════════════════════════════════════════════════
// Transient Density
// ═══════════════════════════════════════════════════════════════════════════

fn compute_transient_density(mono: &[f32], sr: f32, bpm: f32) -> f32 {
    if bpm < 40.0 { return 0.0; }

    let beat_samples = (sr * 60.0 / bpm) as usize;
    let threshold = 0.1f32;

    let mut transient_count = 0u32;
    let mut in_transient = false;

    for i in 1..mono.len() {
        let diff = (mono[i].abs() - mono[i - 1].abs()).max(0.0);
        if diff > threshold && !in_transient {
            transient_count += 1;
            in_transient = true;
        } else if diff < threshold * 0.5 {
            in_transient = false;
        }
    }

    let total_beats = mono.len() as f32 / beat_samples as f32;
    if total_beats > 0.0 { transient_count as f32 / total_beats } else { 0.0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

fn linear_to_dbfs(x: f32) -> f32 {
    20.0 * x.max(1e-10).log10()
}
