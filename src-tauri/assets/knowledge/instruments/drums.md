---
tags: [drums, kick, snare, hihat, percussion, transients, punch]
channel_types: [drum_bus, instrument]
genres: [all]
priority: 9
---

# Drums & Percussion Processing

## Frequency Map
- Kick fundamental: 50-80 Hz (body/thump)
- Kick click/attack: 2-5 kHz
- Kick sub tone (808 style): 30-60 Hz
- Snare body: 150-250 Hz
- Snare crack: 5-8 kHz
- Snare wire buzz: 6-12 kHz
- Hi-hat body: 8-12 kHz
- Hi-hat air: 12-18 kHz
- Room/transient: 1-4 kHz

## Common Drum Problems & Solutions

### Kick too boomy (excessive 100-200 Hz)
→ eq_lm_freq: 150, eq_lm_gain: -3 to -6, eq_lm_q: 1.5
→ eq_hp_on: 1, eq_hp_freq: 30-40

### Kick lacking punch
→ eq_m_freq: 3000-5000, eq_m_gain: +2 to +4
→ comp_type: 1 (FET), comp_attack: 10-20ms, comp_release: 80-150ms

### Snare lacking crack
→ eq_hs_freq: 5000, eq_hs_gain: +2 to +4
→ exc_type: 2 (Transistor), exc_freq: 4000, exc_drive: 3-5

### Drums Bus too washy/undefined
→ EQ first: cut 200-400 Hz mud
→ Comp/FET: attack 5-15ms, release 100-200ms, ratio 4:1
→ Parallel compression: comp_mix: 40-60%

## Drum Bus Chain (Standard)
1. EQ: HP@30Hz, cut 200-350Hz (-2 to -4dB), boost 5kHz (+1 to +2dB)
2. Comp/FET: thresh -15 to -20, ratio 4:1, attack 10ms, release 150ms, makeup +3
3. Exciter/Transistor: drive 3-4, freq 5000, mix 30-40%
4. Limiter: thresh -3, ceil -0.5

## Genre-Specific Drums
- **Rock/Metal**: aggressive FET comp, high crest factor ok, tight attack
- **Hip-Hop/Trap**: 808 sub dominant, minimal hi-hat, heavy limiting
- **House/Techno**: punchy kick, clean transient, heavy limiting for loudness
- **Jazz/Soul**: light compression, natural dynamics, opto comp preferred
- **Pop**: tight comp, parallel processing, bright snare
