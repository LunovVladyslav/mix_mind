---
tags: [bass, 808, sub, low_end, fundamental, warmth]
channel_types: [instrument]
genres: [all]
priority: 8
---

# Bass Processing

## Frequency Map
- Sub bass: 20-60 Hz (felt, not always heard)
- Bass fundamental: 60-120 Hz (body/weight)
- Bass midrange: 200-500 Hz (mud zone — often cut)
- Bass character: 700-1200 Hz (growl/presence)
- Bass string noise: 2-4 kHz (attack definition)
- Bass harmonics: 3-8 kHz (clarity in small speakers)

## Common Bass Problems

### Bass too muddy (boominess 150-300 Hz)
→ eq_lm_freq: 200-250, eq_lm_gain: -3 to -5, eq_lm_q: 1.2

### Bass inaudible on small speakers
→ eq_hm_freq: 700-1000, eq_hm_gain: +2 to +3
→ exc_type: 0 (Tape), exc_freq: 800-1500, exc_drive: 2-4

### 808 sub clashing with kick
→ eq_hp_freq: 30-45, eq_hp_on: 1
→ Side-chain is not available in MixMind — suggest user use DAW side-chain

### Bass too dynamic (inconsistent level)
→ comp_type: 2 (Opto), thresh: -15 to -20, ratio: 3-4, attack: 10-30ms, release: 200-400ms

## Bass Chain (Standard)
1. Comp/Opto first: control dynamics before EQ shapes tone
2. EQ: HP@30-40Hz, cut mud 200-300Hz, boost presence 800-1000Hz if needed
3. Exciter/Tape: warmth and sub harmonics, freq: 1000-2000Hz, drive: 1-3, mix: 20-35%
4. Limiter: thresh -3 to -6, ceil -0.5 (bass can cause unexpected peaks)

## Correlation Rule for Bass
Bass/sub instruments MUST have correlation > 0.8
If correlation < 0.6: low-frequency stereo is causing mono incompatibility
→ Suggest user use M/S processing or LP on side channel in DAW
