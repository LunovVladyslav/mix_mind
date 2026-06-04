---
tags: [vocals, voice, lead, harmony, presence, sibilance, clarity]
channel_types: [instrument]
genres: [all]
priority: 9
---

# Vocal Processing

## Frequency Map
- Vocal proximity/warmth: 150-300 Hz
- Vocal mud: 200-400 Hz (often cut for clarity)
- Vocal body: 400-800 Hz
- Vocal presence: 1-4 kHz (most critical)
- Vocal sibilance (S sounds): 6-10 kHz
- Vocal air: 12-16 kHz

## Common Vocal Problems

### Vocal sounds muffled/muddy
→ eq_hp_on: 1, eq_hp_freq: 80-120
→ eq_lm_freq: 250-350, eq_lm_gain: -2 to -4, eq_lm_q: 1.2

### Vocal lacks presence/cuts through
→ eq_m_freq: 2000-4000, eq_m_gain: +2 to +4, eq_m_q: 0.8
→ exc_type: 1 (Tube), exc_freq: 3000, exc_drive: 2-3, exc_mix: 20-35%

### Vocal too harsh/sibilant
→ eq_hm_freq: 7000-9000, eq_hm_gain: -2 to -4, eq_hm_q: 2.0
→ Recommend user adds de-esser in DAW

### Vocal too dynamic
→ comp_type: 2 (Opto), thresh: -18 to -22, ratio: 3-4:1
→ attack: 15-30ms (don't kill transients), release: 200-400ms
→ comp_makeup: 3-5 dB to restore level

## Standard Vocal Chain
1. EQ: HP@80-120Hz, cut mud 250-350Hz, boost presence 2-4kHz subtly
2. Comp/Opto: thresh -18 to -22, ratio 3:1, attack 20ms, release 300ms
3. Exciter/Tube: presence and air, freq 3000-5000, drive 2-3, mix 20-30%
4. Limiter: thresh -3, ceil -0.5 (vocals can peak unexpectedly)

## Male vs Female Vocal
- Male: fundamental 80-180 Hz, boost presence at 1.5-3kHz
- Female: fundamental 160-300 Hz, boost air at 10-14kHz, careful with 3-6kHz
