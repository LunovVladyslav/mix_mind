---
tags: [guitar, electric, acoustic, distortion, presence, harmonics]
channel_types: [instrument]
genres: [rock, metal, alternative, indie, folk, acoustic]
priority: 8
---

# Guitar Processing

## Frequency Map
- Guitar low end: 80-150 Hz (body, can be muddy)
- Guitar mud zone: 200-400 Hz (often cut, especially on distorted)
- Guitar warmth: 400-600 Hz (acoustic body)
- Guitar presence: 1-3 kHz (cut-through in mix)
- Guitar bite/attack: 3-5 kHz
- Guitar air/sparkle: 8-12 kHz

## Common Guitar Problems

### Distorted guitar too muddy
→ eq_hp_on: 1, eq_hp_freq: 80-120
→ eq_lm_freq: 250-350, eq_lm_gain: -3 to -5, eq_lm_q: 1.0

### Guitar disappears in mix
→ eq_hm_freq: 2000-4000, eq_hm_gain: +2 to +3
→ exc_type: 1 (Tube), exc_freq: 3000-5000, exc_drive: 2-4, exc_mix: 25-40%

### Acoustic guitar lacks body
→ eq_ls_freq: 150, eq_ls_gain: +1.5 to +3

### Electric guitar too harsh (too much 2-4kHz)
→ eq_m_freq: 2500-3500, eq_m_gain: -2 to -4, eq_m_q: 1.5

## Guitar Chain by Style
**Distorted/Rock:**
1. EQ: HP@80-120Hz, cut 250-350Hz mud, slight boost 3-4kHz
2. Comp/VCA: light compression, ratio 2-3:1, fast attack to tighten
3. Exciter/Tube: presence and harmonics, freq 3000+

**Acoustic/Folk:**
1. EQ: HP@80Hz, slight boost 150Hz body, cut 300-400Hz if boxy
2. Comp/Opto: gentle, ratio 2:1, medium attack (15-30ms)
3. Light Exciter/Tape: warmth, freq 2000-4000, low drive

**Clean Electric:**
1. EQ: HP@60Hz, cut mud 200-300Hz
2. Comp/VCA or Opto: moderate, ratio 3:1
3. Exciter/Tube: presence
