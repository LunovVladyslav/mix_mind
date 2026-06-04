/**
 * MixMind Shared Memory Protocol
 * Source of truth for the data contract between:
 *   - MixMind Bridge VST plugin (JUCE C++)
 *   - MixMind Desktop App (Tauri/Rust)
 *
 * Both sides must use this exact layout.
 * All structs are packed to ensure identical memory layout across compilers.
 *
 * v1.0 · 2026
 */

#ifndef MIXMIND_PROTOCOL_H
#define MIXMIND_PROTOCOL_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

/** Named shared memory block identifier */
#define MIXMIND_SHM_NAME     "MixMindBridge"

/** Maximum number of simultaneous VST instances / channels */
#define MIXMIND_MAX_CHANNELS 64

/** Magic number — validates this is a MixMind shm block: "MMMB" */
#define MIXMIND_MAGIC        0x4D4D4D42u

/** Protocol version — increment on breaking changes */
#define MIXMIND_VERSION      1u

/** Number of 1/3-octave bands (20Hz to 20kHz) */
#define MIXMIND_FFT_BANDS    31

/** Spinlock value: unlocked */
#define MIXMIND_LOCK_FREE    0u

/** Spinlock value: locked */
#define MIXMIND_LOCK_HELD    1u


/* ─────────────────────────────────────────────
   Channel Type Enum
   ───────────────────────────────────────────── */

typedef enum {
    CHANNEL_INSTRUMENT = 0,  /**< Individual instrument track */
    CHANNEL_DRUM_BUS   = 1,  /**< Drum bus / group */
    CHANNEL_BUS        = 2,  /**< Generic bus / group */
    CHANNEL_SEND       = 3,  /**< FX send / return */
    CHANNEL_MASTER     = 4   /**< Master output */
} ChannelType;


/* ─────────────────────────────────────────────
   ChannelSlot — one per VST plugin instance
   Updated every processBlock() by the VST.
   Read at 60Hz by the desktop app.
   ───────────────────────────────────────────── */

#pragma pack(push, 1)
typedef struct {

    /* ── Identity ─────────────────────────────── */
    char     instance_id[64];   /**< UUID string, generated once on plugin init */
    char     display_name[64];  /**< User-defined name, e.g. "Kick Drum" */
    uint8_t  channel_type;      /**< ChannelType enum value */
    uint8_t  routing_channel;   /**< User-assigned routing channel (0 = Off, 1-64) */
    uint32_t order;             /**< User-defined sort order (0–99) */

    /* ── Lifecycle ────────────────────────────── */
    uint8_t  is_active;         /**< 1 if plugin is running, 0 if destroyed */
    uint64_t last_update;       /**< Unix timestamp in milliseconds */

    /* ── Level Meters ────────────────────────── */
    float    rms_l;             /**< Left channel RMS, dBFS */
    float    rms_r;             /**< Right channel RMS, dBFS */
    float    peak_l;            /**< Left channel peak, dBFS */
    float    peak_r;            /**< Right channel peak, dBFS */

    /* ── LUFS (ITU-R BS.1770-4) ──────────────── */
    float    lufs_m;            /**< Momentary LUFS (400ms window) */
    float    lufs_s;            /**< Short-term LUFS (3s window) */

    /* ── Dynamics ────────────────────────────── */
    float    true_peak;         /**< True Peak, dBTP */
    float    crest_factor;      /**< Crest factor = peak - RMS, dB */
    float    gain_reduction;    /**< GR from downstream compressor via sidechain, dB */

    /* ── Spectral (31 bands, 1/3-octave, 20Hz–20kHz) */
    float    fft_bands[MIXMIND_FFT_BANDS]; /**< dBFS per band, smoothed */

    /* ── Stereo Field ────────────────────────── */
    float    correlation;       /**< Stereo correlation, -1.0 (out of phase) to 1.0 (mono) */
    float    mid_level;         /**< Mid channel RMS, dBFS */
    float    side_level;        /**< Side channel RMS, dBFS */

    /* ── DAW Transport ───────────────────────── */
    double   bpm;               /**< Session BPM from DAW transport */
    float    sample_rate;       /**< Current sample rate, Hz */
    uint8_t  is_playing;        /**< 1 if DAW transport is running */

    /* ── AI Control (OSC) ────────────────────── */
    uint16_t osc_port;          /**< UDP port for OSC control commands (0 if not supported) */

    /* ── Padding to align to 8-byte boundary ─── */
    uint8_t  _pad;

} ChannelSlot;
#pragma pack(pop)


/* ─────────────────────────────────────────────
   SharedMemoryLayout — the full shared block
   Total size = sizeof(SharedMemoryLayout)
   ───────────────────────────────────────────── */

#pragma pack(push, 1)
typedef struct {

    /** Spinlock: 0 = free, 1 = held by writer.
     *  Writers CAS this to 1 before writing, then set back to 0.
     *  Readers skip read if held for >1ms (stale guard). */
    uint32_t spinlock;

    /** Must equal MIXMIND_MAGIC (0x4D4D4D42).
     *  If mismatch: shm exists but is not a MixMind block — ignore it. */
    uint32_t magic;

    /** Protocol version. Desktop app rejects blocks with mismatched version. */
    uint32_t version;

    /** Number of slots currently populated (may be < MIXMIND_MAX_CHANNELS). */
    uint32_t slot_count;

    /** Reserved for future fields — keeps slots 64-byte aligned */
    uint8_t  _reserved[48];

    /** All channel slots. Indexed 0..slot_count-1 (active), rest zero-init. */
    ChannelSlot slots[MIXMIND_MAX_CHANNELS];

} SharedMemoryLayout;
#pragma pack(pop)


/* ─────────────────────────────────────────────
   Utility Macros
   ───────────────────────────────────────────── */

/** Convert linear amplitude to dBFS (avoids -inf for silence) */
#define LINEAR_TO_DBFS(x)  (20.0f * log10f((x) > 1e-10f ? (x) : 1e-10f))

/** Convert dBFS to linear amplitude */
#define DBFS_TO_LINEAR(x)  powf(10.0f, (x) / 20.0f)

/** 1/3-octave band center frequencies (Hz), 31 bands */
/* 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
   630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
   10000, 12500, 16000, 20000 */


#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* MIXMIND_PROTOCOL_H */
