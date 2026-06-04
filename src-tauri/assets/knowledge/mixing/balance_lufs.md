---
tags: [lufs, balance, gain, level, master, mixing, loudness]
channel_types: [instrument, drum_bus, bus, send, master]
genres: [all]
priority: 9
---

# Level Balance & LUFS

## Mix Balance Principles

The goal: every channel sits at the right level relative to others AND to the master bus.

## LUFS Reference Points (Integrated)
- Master bus target: depends on genre (see genre files)
- Individual channels are NOT measured to absolute standards — they're relative to master
- A channel at -20 LUFS when master is -14 LUFS = this channel is 6 dB too quiet
- A channel at -8 LUFS when master is -14 LUFS = this channel is 6 dB too loud

## in_gain vs out_gain
- **in_gain** = gain BEFORE the FX chain
  - Use to control how hard you're hitting the compressor
  - Negative in_gain = gentler compression (less GR), preserves dynamics
  - Positive in_gain = drives compressor harder, more color/GR
- **out_gain** = gain AFTER the FX chain  
  - Use to adjust final level output
  - This is your fader equivalent in the plugin chain
  - Use after makeup gain to fine-tune

## Level Decision Rules

Compare channel lufsM to master lufsM:
- Channel 0-3 dB louder than master → reduce out_gain by 1-2 dB
- Channel 4-6 dB louder than master → reduce out_gain by 2-4 dB  
- Channel >6 dB louder than master → reduce out_gain by 4-8 dB AND check if in_gain needs reduction
- Channel 0-3 dB quieter than master → increase out_gain by 1-2 dB
- Channel 4-8 dB quieter than master → increase out_gain by 3-5 dB
- Channel >8 dB quieter than master → increase out_gain by 5-8 dB (may need re-evaluation)

## True Peak Rules
- truePeak > -1.0 dBTP: ALWAYS add Limiter
- truePeak > 0 dBTP: reduce in_gain by at least 3 dB + add Limiter
- truePeak < -6 dBTP: signal may be too quiet, check if headroom is intentional

## Gain Reduction (GR) Interpretation
- GR 0-2 dB: light compression, transparent
- GR 3-6 dB: moderate compression, musical
- GR 7-12 dB: heavy compression, character/color
- GR > 12 dB: extreme, likely over-compressed unless intentional

## RMS Balance Check
- Lead elements (lead vocal, lead synth) should be loudest non-master channels
- Supporting elements 3-6 dB below lead
- Background elements 6-12 dB below lead
- Sub bass should be powerful but not exceeding kick drum level
