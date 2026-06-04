---
tags: [lufs, loudness, streaming, mastering, true_peak, limiter]
channel_types: [master]
genres: [all]
priority: 10
---

# Loudness Targets by Platform

## Streaming Platforms (Integrated LUFS)
- Spotify: -14 LUFS (normalizes louder tracks down)
- Apple Music: -16 LUFS  
- YouTube: -14 LUFS
- Tidal: -14 LUFS
- Amazon Music: -14 LUFS
- SoundCloud: no normalization (louder = louder)
- Bandcamp: no normalization

## Broadcast Standards
- EBU R128 (Europe broadcast): -23 LUFS
- ATSC A/85 (US broadcast): -24 LUFS
- Film/Cinema: -27 LUFS

## True Peak Limits
- Streaming: -1.0 dBTP (MANDATORY)
- Broadcast: -3.0 dBTP
- CD: 0 dBFS (no true peak standard, but -0.3 dBTP safe)

## Genre Loudness Tendencies
- EDM/Club: -8 to -6 LUFS (very loud, often for SoundCloud/club use)
- Pop: -9 to -11 LUFS
- Rock: -10 to -12 LUFS  
- Hip-Hop: -9 to -12 LUFS
- R&B/Soul: -12 to -14 LUFS
- Jazz: -14 to -18 LUFS (preserve dynamics)
- Classical: -18 to -23 LUFS (very dynamic)
- Acoustic/Folk: -14 to -16 LUFS

## Master Chain Strategy
1. EQ/slot1: Subtle corrections, high-pass at 20-30Hz, gentle shelf boosts
2. Comp/Bus slot2: Glue compression, 1-3 dB GR max, ratio 1.5-2:1
3. Exciter/Tape slot3: Warmth/air if needed, very subtle (drive 1-2, mix 10-20%)
4. Limiter/TruePeak slot4: Set ceil to -1.0 dBTP, thresh until target LUFS

## LUFS vs RMS
MixMind reports lufsM (momentary/short-term) not integrated.
lufsM will be higher than integrated by ~2-6 dB in typical music.
If lufsM reads -12, integrated LUFS is approximately -14 to -18.
