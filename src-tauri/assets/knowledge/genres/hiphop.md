---
tags: [hip_hop, trap, drill, rnb, rap, 808, urban, lo_fi]
channel_types: [all]
genres: [hip_hop, trap, drill, rnb, neo_soul, lo_fi]
priority: 8
---

# Hip-Hop, Trap, R&B — Mixing Guide

## Genre Detection
- BPM 70-100, heavy 808 sub, sparse trap hi-hat patterns → Trap
- BPM 60-80, heavy orchestral samples, boom bap drums → Hip-Hop classic
- BPM 130-145 (half-time feel), dark drill hi-hats, sliding 808 → Drill
- BPM 60-90, soulful chords, smooth vocals, R&B feel → R&B/Neo-Soul

## 808 / Sub Bass
The centerpiece of Trap/Hip-Hop. Must be handled carefully:
- Sub body: 40-80 Hz (this IS the song in trap)
- Keep MONO below 120 Hz — correlation must be > 0.85
- Comp/Opto: gentle, ratio 2:1, slow attack (30-50ms to let sub breathe)
- NO harsh EQ cuts in sub region unless mud is severe
- Exciter/Tape: very subtle harmonics for small speaker translation
  (exc_freq: 800-1200, drive: 1-2, mix: 15-25%)
- Limiter: always on 808, ceil -1.0

## Trap Kick
- Short, punchy, little sustain
- Body: 60-100 Hz
- Attack: 2-4 kHz
- Comp/FET: very fast attack (1-3ms), fast release (50ms), ratio 6:1

## Rap Vocals
- Dry, upfront presence in Trap
- HP@100-120Hz (remove proximity)
- Cut 250-350Hz (mud/boxiness)
- Boost 3-5 kHz presence (+2 to +3 dB)
- Comp/FET or VCA: fast, ratio 4-6:1, heavy compression is stylistic
- Exciter/Transistor: crisp, modern presence
- De-essing recommended at 7-9 kHz

## R&B / Neo-Soul Vocals
- Warmer, smoother than Rap
- HP@80Hz
- Gentle Comp/Opto: ratio 2-3:1, slow attack (20-30ms)
- Exciter/Tube: warm harmonics, freq 2000-4000
- More reverb send vs trap (plate, 1.5-2.5s decay)

## Lo-Fi Hip-Hop
- Intentionally degraded sound is part of the aesthetic
- Vinyl noise, tape saturation = Exciter/Tape/Transformer at higher drive
- HP aggressive on everything
- Low-pass master at 12-15kHz (intentional bandwidth limiting)
- Compression: heavy, Opto style

## Mix Bus / Master Settings (Trap)
- Heavy limiting is expected and stylistic
- Target: -9 to -11 LUFS
- Comp/Bus: ratio 2:1, GR 2-4 dB
- Limiter: aggressive, lim_mode: 1 (Clipper) for character, then lim_mode: 0 for ceiling
