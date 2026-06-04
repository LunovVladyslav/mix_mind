---
tags: [fx_chain, slot_order, eq, compression, exciter, limiter, chain, order]
channel_types: [instrument, drum_bus, bus, send, master]
genres: [all]
priority: 10
---

# FX Chain Order — Decision Rules

## Core Principle
Order matters: each processor hears the output of the previous one.
Wrong order = fighting your own mix.

## Decision Tree (read EVERY time before setting slots)

**Step 1 — Peak protection?**
- truePeak > -1.0 dBTP → slot4 = Limiter (MANDATORY, always)
- crestFactor > 22 dB → very dynamic signal, compress first

**Step 2 — EQ or Comp first?**
- Has resonance, mud, boxiness? → EQ first (slot1), then Comp (slot2)
  Rationale: fix tonal problems BEFORE the compressor hears them
- Signal is clean tonally but uncontrolled dynamically? → Comp first (slot1), EQ after (slot2)
  Rationale: compress raw dynamics, then shape tone of the result

**Step 3 — Exciter needed?**
- Spectrum weak above 8 kHz, track sounds dull or lacks presence? → Exciter in slot3
- Track already bright or harsh? → skip Exciter or use very low drive (1-2)
- ALWAYS place Exciter AFTER Compressor so harmonics are controlled

**Step 4 — Limiter placement**
- Always slot4 when used
- Buses and Master: ALWAYS include Limiter in slot4
- Instruments: use Limiter if truePeak > -3 dBTP

## Standard Configurations by Channel Type

```
Drums Bus:   EQ(1) → Comp/FET(2) → Exciter/Transistor(3) → Limiter(4)
Kick alone:  Comp/FET(1) → EQ(2) → [skip exciter] → Limiter(4)
Bass/808:    Comp/Opto(1) → EQ(2) → Exciter/Tape(3) → Limiter(4)
Elec Guitar: EQ(1) → Comp/VCA(2) → Exciter/Tube(3) → [limiter if peak]
Acoustic:    EQ(1) → Comp/Opto(2) → Exciter/Tape light(3) → [limiter]
Lead Vocals: EQ(1) → Comp/Opto(2) → Exciter/Tube(3) → Limiter(4)
Keys/Piano:  EQ(1) → Comp/VCA(2) → [Exciter if dull] → [limiter]
Synth Lead:  EQ(1) → Comp/VCA(2) → Exciter/Digital(3) → Limiter(4)
Group Bus:   EQ(1) → Comp/Bus(2) → Exciter/Transformer(3) → Limiter(4)
Mix Bus:     EQ(1) → Comp/Bus(2) → Exciter/Tape(3) → Limiter/TruePeak(4)
Master:      EQ(1) → Comp/VCA(2) → Exciter/Tape(3) → Limiter/TruePeak(4)
```

## Compressor Type Decision
- VCA (0): Transparent, full control. Best for bus, clean sources.
- FET (1): Fast, punchy, 1176-style. Best for drums, percussion, aggressive guitars.
- Opto (2): Musical, program-dependent. Best for vocals, bass, acoustic.
- Bus (3): Glue compression, SSL-style. Best for mix bus, drum bus, group buses.

## Exciter Type Decision
- Tape (0): Warm, smooth. Best for bass, acoustic, vintage sounds, master bus.
- Tube (1): Rich harmonics, musical. Best for vocals, guitars, lead synths.
- Transistor (2): Punchy, tight. Best for drums, percussion, modern pop.
- Digital (3): Crisp, aggressive. Best for EDM, electronic leads, modern metal.
- Transformer (4): Low-end bloom + HF damping. Best for mix bus, vintage warmth.
