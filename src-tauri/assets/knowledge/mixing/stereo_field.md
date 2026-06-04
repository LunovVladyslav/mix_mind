---
tags: [stereo, correlation, width, mono, mid, side, phase]
channel_types: [instrument, drum_bus, bus, master]
genres: [all]
priority: 7
---

# Stereo Field & Correlation

## Correlation Values
- 1.0 = perfect mono (L=R)
- 0.7-0.99 = slightly wide, good mono compatibility
- 0.3-0.69 = wide, some mono loss possible
- 0.0-0.29 = very wide, significant mono loss
- Negative = phase issues, avoid on bass and kick

## Rules by Channel Type
- **Kick/Snare/Bass/808**: correlation should be > 0.8 (keep mono/center)
  - If correlation < 0.5 → narrow the stereo field (HP filter in mid/side)
- **Guitars (double-tracked)**: correlation 0.4-0.7 is fine and intended
- **Pads/Reverb/Chorus**: correlation 0.1-0.5 = healthy width
- **Lead vocal**: correlation 0.7-0.95 (slightly wider is OK, very wide = problem)
- **Master**: correlation should stay above 0.5 for streaming compatibility

## midLevel vs sideLevel
- midLevel >> sideLevel: mono-heavy mix, may sound narrow
- sideLevel >> midLevel: wide but may have mono compatibility issues
- Balance: midLevel should be ~3-6 dB above sideLevel for good balance

## Common Stereo Problems
- Low correlation on bass-heavy channels: LP filter on side channel
- Phase cancellation: check mid/side processing and mono folding
- Too wide master: reduce stereo width with M/S EQ on master
