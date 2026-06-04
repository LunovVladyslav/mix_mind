---
tags: [piano, keys, synth, pads, Rhodes, organ, leads]
channel_types: [instrument]
genres: [all]
priority: 7
---

# Keys, Synths & Pads

## Piano
- Low octaves: 27-250 Hz (warmth and body)
- Mud zone: 200-400 Hz (often cut in full mix)
- Presence: 2-5 kHz (note attack)
- String noise/air: 8-16 kHz

**Chain:** EQ (HP@60Hz, cut 300Hz) → Comp/VCA (light, ratio 2:1) → [Exciter if dull]

## Synth Leads
- Bright synths can dominate 1-5 kHz
- Often compete with vocals → cut 2-4kHz on synth if vocal present
- **Chain:** EQ → Comp/VCA tight → Exciter/Digital (crisp presence) → Limiter

## Pads/Atmosphere
- Should sit BEHIND mix, not compete
- HP filter aggressive: eq_hp_freq 200-400Hz (remove low energy competition)
- LP filter: eq_lp_on:1, eq_lp_freq: 8000-12000 (keep pads dark/back)
- Light Comp/VCA: ratio 2:1, medium settings
- Correlation can be low (0.2-0.5) for wide pads — this is intentional

## Rhodes/Electric Piano
- Rich upper harmonics 2-5 kHz
- Warmth 200-500 Hz
- Exciter/Tube works beautifully: freq 1000-2000, drive 1-2, mix 20%
