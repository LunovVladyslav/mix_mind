---
tags: [electronic, house, techno, trance, dubstep, drum_and_bass, edm, ambient, garage]
channel_types: [all]
genres: [house, deep_house, tech_house, techno, trance, progressive_trance, dubstep, drum_and_bass, jungle, breaks, ambient, chillout, garage]
priority: 8
---

# Electronic Music — Mixing & Processing Guide

## Genre Detection Clues
- BPM 120-130, heavy sub kick, 4/4 pattern, hi-hat offbeats → House/Deep House
- BPM 130-145, industrial sounds, minimal melody, heavy kick → Techno
- BPM 128-145, uplifting melody, long reverbs, filtered pads → Trance
- BPM 140-180, heavy bass drop, half-time feel, wobbly bass → Dubstep
- BPM 160-180, breakbeats, Reese bass, jungle chops → Drum & Bass
- BPM 90-110, slow beats, atmospheric pads, melodic → Ambient/Chillout

## Loudness Targets
- Club EDM/House/Techno: -8 to -6 LUFS (maximum loudness for club)
- Streaming EDM: -9 to -11 LUFS  
- Ambient/Chillout: -14 to -16 LUFS
- True Peak: -0.3 to -1.0 dBTP (never exceed)

## Kick Drum (Electronic)
- Sub frequency: 50-70 Hz (sine wave body)
- Punch: 100-200 Hz
- Click/beater: 3-5 kHz
- HP filter: 30-40 Hz (below audible sub)
- Comp/FET: fast attack (1-5ms), release 50-100ms, ratio 4-8:1
- Limiter always on kick bus: thresh -3, ceil -0.5

## Bass Lines / Reese Bass (D&B / Dubstep)
- Sub body: 40-80 Hz (mono only!)
- Growl: 200-600 Hz (this is the movement)
- Harmonics: 1-3 kHz (presence)
- Keep stereo mono below 120 Hz (correlation must be > 0.9)
- Comp/Opto: control dynamics, ratio 3-4:1
- Exciter/Transistor: drive the harmonics for aggression

## Synth Leads (Trance/EDM)
- Often bright 1-8 kHz dominant
- Cut 2-4kHz if competing with vocals
- Comp/VCA: tight, ratio 2-3:1, fast attack
- Exciter/Digital: crisp, modern
- Limiter: always (synth leads can peak hard)

## Pads / Atmosphere
- HP aggressive: 200-500 Hz (keep pads from muddying low end)
- LP: 8-10 kHz (keep pads dark, in background)
- Correlation 0.2-0.5 is fine (pads should be wide)
- Very light comp only

## FX Chain Order (Electronic)
- Kick: EQ(1) → Comp/FET(2) → [Exciter/Transistor if needed](3) → Limiter(4)
- Bass: Comp/Opto(1) → EQ(2) → Exciter(3) → Limiter(4)  
- Leads: EQ(1) → Comp/VCA(2) → Exciter/Digital(3) → Limiter(4)
- Bus/Mix: EQ(1) → Comp/Bus(2) → Exciter/Tape(3) → Limiter/TruePeak(4)

## Master Bus Settings (Club EDM)
- EQ: subtle HP@20Hz, gentle air boost 12-16kHz +1-2dB
- Comp/Bus: ratio 1.5:1, thresh -3 to -6, GR 1-2 dB max
- Limiter: thresh until -8 to -6 LUFS, ceil -0.3 dBTP
