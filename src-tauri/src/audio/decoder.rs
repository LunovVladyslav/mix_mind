// MixMind — Audio Decoder
// Decodes WAV and MP3 files using symphonia, resamples to 48kHz if needed.

use anyhow::{anyhow, Result};
use rubato::{FftFixedIn, Resampler};
use std::path::Path;
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Decoded audio ready for analysis
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AudioBuffer {
    /// Per-channel samples, samples[0] = left, samples[1] = right
    pub samples:      Vec<Vec<f32>>,
    pub sample_rate:  u32,
    pub channels:     u8,
    pub duration_secs: f32,
}

const TARGET_SAMPLE_RATE: u32 = 48_000;

/// Decode a WAV or MP3 file to an AudioBuffer.
/// Always resamples to 48kHz. Converts to stereo if mono.
pub fn decode_file(path: &Path) -> Result<AudioBuffer> {
    log::info!("Decoding: {}", path.display());

    // Open the file
    let file = std::fs::File::open(path)
        .map_err(|e| anyhow!("Cannot open file: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create hint for format detection
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    // Probe the file format
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| anyhow!("Unsupported format: {e}"))?;

    let mut format = probed.format;

    // Find the default audio track
    let track = format.default_track()
        .ok_or_else(|| anyhow!("No audio track found"))?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();

    let file_sample_rate = codec_params.sample_rate.unwrap_or(44_100);
    let file_channels = codec_params.channels.map(|c| c.count()).unwrap_or(2);

    log::info!("Track: {}Hz, {} channels", file_sample_rate, file_channels);

    // Create decoder
    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| anyhow!("Decoder error: {e}"))?;

    // Decode all packets
    let mut raw_samples: Vec<Vec<f32>> = vec![Vec::new(); file_channels.max(2)];

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => {
                log::warn!("Packet error: {e}");
                break;
            }
        };

        if packet.track_id() != track_id { continue; }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(e) => { log::warn!("Decode error: {e}"); continue; }
        };

        // Convert to f32 interleaved, then de-interleave
        let num_ch = decoded.spec().channels.count();
        let num_frames = decoded.frames();

        let mut interleaved = vec![0f32; num_frames * num_ch];
        copy_to_f32(&decoded, &mut interleaved, num_ch, num_frames);

        for frame in 0..num_frames {
            for ch in 0..num_ch.min(2) {
                raw_samples[ch].push(interleaved[frame * num_ch + ch]);
            }
            // If mono input, duplicate to stereo
            if num_ch == 1 {
                raw_samples[1].push(interleaved[frame]);
            }
        }
    }

    // Ensure both channels have data
    if raw_samples[0].is_empty() {
        return Err(anyhow!("No audio data decoded"));
    }
    if raw_samples[1].is_empty() {
        raw_samples[1] = raw_samples[0].clone();
    }

    // Resample to 48kHz if needed
    let samples = if file_sample_rate != TARGET_SAMPLE_RATE {
        log::info!("Resampling {}Hz → {}Hz", file_sample_rate, TARGET_SAMPLE_RATE);
        resample_to_48k(raw_samples, file_sample_rate)?
    } else {
        raw_samples
    };

    let num_samples = samples[0].len();
    let duration_secs = num_samples as f32 / TARGET_SAMPLE_RATE as f32;

    log::info!("Decoded: {} samples, {:.2}s", num_samples, duration_secs);

    Ok(AudioBuffer {
        samples,
        sample_rate: TARGET_SAMPLE_RATE,
        channels: 2,
        duration_secs,
    })
}

/// Copy symphonia AudioBufferRef to a flat f32 interleaved buffer
fn copy_to_f32(buf: &AudioBufferRef, out: &mut [f32], num_ch: usize, num_frames: usize) {
    match buf {
        AudioBufferRef::F32(b) => {
            for frame in 0..num_frames {
                for ch in 0..num_ch {
                    out[frame * num_ch + ch] = b.chan(ch)[frame];
                }
            }
        }
        AudioBufferRef::S16(b) => {
            for frame in 0..num_frames {
                for ch in 0..num_ch {
                    out[frame * num_ch + ch] = b.chan(ch)[frame] as f32 / 32768.0;
                }
            }
        }
        AudioBufferRef::S24(b) => {
            for frame in 0..num_frames {
                for ch in 0..num_ch {
                    out[frame * num_ch + ch] = b.chan(ch)[frame].inner() as f32 / 8_388_608.0;
                }
            }
        }
        AudioBufferRef::S32(b) => {
            for frame in 0..num_frames {
                for ch in 0..num_ch {
                    out[frame * num_ch + ch] = b.chan(ch)[frame] as f32 / 2_147_483_648.0;
                }
            }
        }
        AudioBufferRef::F64(b) => {
            for frame in 0..num_frames {
                for ch in 0..num_ch {
                    out[frame * num_ch + ch] = b.chan(ch)[frame] as f32;
                }
            }
        }
        _ => {
            // For any other format, fill with silence
            out.fill(0.0);
        }
    }
}

/// Resample all channels to 48kHz using rubato FftFixedIn
fn resample_to_48k(input: Vec<Vec<f32>>, from_rate: u32) -> Result<Vec<Vec<f32>>> {
    let chunk_size = 1024;
    let mut resampler = FftFixedIn::<f32>::new(
        from_rate as usize,
        TARGET_SAMPLE_RATE as usize,
        chunk_size,
        2, // sub-chunks
        2, // channels
    )?;

    let num_input = input[0].len();
    let mut output: Vec<Vec<f32>> = vec![Vec::new(); 2];

    let mut pos = 0;
    while pos + chunk_size <= num_input {
        let chunk: Vec<&[f32]> = input.iter()
            .map(|ch| &ch[pos..pos + chunk_size])
            .collect();

        let out = resampler.process(&chunk, None)?;
        for (ch, samples) in out.iter().enumerate() {
            output[ch].extend_from_slice(samples);
        }
        pos += chunk_size;
    }

    // Handle remaining samples
    if pos < num_input {
        let padded: Vec<Vec<f32>> = input.iter()
            .map(|ch| {
                let mut v = ch[pos..].to_vec();
                v.resize(chunk_size, 0.0);
                v
            })
            .collect();

        let chunk: Vec<&[f32]> = padded.iter().map(|c| c.as_slice()).collect();
        let out = resampler.process(&chunk, None)?;
        for (ch, samples) in out.iter().enumerate() {
            output[ch].extend_from_slice(samples);
        }
    }

    Ok(output)
}
