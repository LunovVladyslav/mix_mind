// MixMind MultiFX — PluginProcessor.h  v3.0
// 7-band Parametric EQ · 4 Compressor types · 5 Saturation types · Enhanced Limiter
//
// ═══════════════════════  AI PARAMETER REFERENCE  ═══════════════════════════
// OSC address: /mixmind/multifx/param/<id>  (float value)
//
// GAIN:
//   in_gain   [-24..+24 dB]  Input gain before FX chain
//   out_gain  [-24..+24 dB]  Output gain after FX chain
//
// EQ (7-band parametric + HP/LP):
//   eq_hp_on    [0/1]          High-Pass filter toggle
//   eq_hp_freq  [20..2000 Hz]  HP cutoff frequency
//   eq_ls_freq  [20..500 Hz]   Low Shelf center
//   eq_ls_gain  [-18..+18 dB]  Low Shelf gain
//   eq_lm_freq  [80..800 Hz]   Low-Mid bell center
//   eq_lm_gain  [-18..+18 dB]  Low-Mid bell gain
//   eq_lm_q     [0.1..10]      Low-Mid bandwidth (Q)
//   eq_m_freq   [200..5000 Hz] Mid bell center
//   eq_m_gain   [-18..+18 dB]  Mid bell gain
//   eq_m_q      [0.1..10]      Mid bandwidth (Q)
//   eq_hm_freq  [1k..15k Hz]   Hi-Mid bell center
//   eq_hm_gain  [-18..+18 dB]  Hi-Mid bell gain
//   eq_hm_q     [0.1..10]      Hi-Mid bandwidth (Q)
//   eq_hs_freq  [2k..20k Hz]   High Shelf center
//   eq_hs_gain  [-18..+18 dB]  High Shelf gain
//   eq_lp_on    [0/1]          Low-Pass filter toggle
//   eq_lp_freq  [200..20k Hz]  LP cutoff frequency
//
// COMPRESSOR:
//   comp_thresh  [-60..0 dB]   Compression threshold
//   comp_ratio   [1..20]       Compression ratio
//   comp_attack  [0.1..200 ms] Attack time
//   comp_release [10..2000 ms] Release time
//   comp_knee    [0..12 dB]    Soft knee width
//   comp_makeup  [0..24 dB]    Makeup gain
//   comp_mix     [0..100 %]    Dry/Wet mix (parallel compression)
//   comp_type    [0..3]        0=VCA clean/transparent
//                              1=FET fast/punchy (1176-style)
//                              2=Opto musical/program-dependent (LA-2A-style)
//                              3=Bus glue/SSL-style
//
// EXCITER / SATURATION:
//   exc_drive  [0..10]         Drive/saturation amount
//   exc_freq   [200..15k Hz]   HP frequency before saturation
//   exc_mix    [0..100 %]      Dry/Wet blend
//   exc_type   [0..4]          0=Tape  soft/warm symmetric
//                              1=Tube  rich odd harmonics, musical
//                              2=Transistor  punchy, tight transients
//                              3=Digital  crisp, hard limiting character
//                              4=Transformer  low-end bloom + HF damping
//
// LIMITER:
//   lim_thresh    [-20..0 dB]  Limiting threshold
//   lim_ceil      [-6..0 dB]   Output ceiling
//   lim_release   [1..500 ms]  Release time
//   lim_mode      [0/1]        0=Limiter (look-ahead)  1=Clipper (hard)
//   lim_true_peak [0/1]        Enable True Peak mode
//
// FX CHAIN ORDER:
//   slot1..slot4  [1..4]  1=EQ  2=Comp  3=Exciter  4=Limiter
// ════════════════════════════════════════════════════════════════════════════

#pragma once
#include <JuceHeader.h>
#include "SharedMemoryWriter.h"
#include "../shared/mixmind_protocol.h"
#include <array>
#include <atomic>
#include <deque>

// ─── Slot State ───────────────────────────────────────────────────────────────
struct SlotState
{
    int type = 0; // 0=Empty, 1=EQ, 2=Comp, 3=Exciter, 4=Limiter, 5=Reverb, 6=Delay, 7=Chorus, 8=Flanger
    bool parallel = false;
    bool bypass = false;
    std::array<float, 20> p = {0.0f};
};

// ─── Preset State ─────────────────────────────────────────────────────────────
struct PresetState
{
    juce::String presetName     { "Default" };
    juce::String presetCategory { "User" };

    // Gain
    float inGain = 0.0f, outGain = 0.0f;

    // 8 dynamic slots
    std::array<SlotState, 8> slots;
};

// ─── Processor ────────────────────────────────────────────────────────────────
class MixMindMultiFXProcessor  : public juce::AudioProcessor
{
public:
    MixMindMultiFXProcessor();
    ~MixMindMultiFXProcessor() override;

    void prepareToPlay  (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock   (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MixMind MultiFX"; }
    bool   acceptsMidi()   const override { return false; }
    bool   producesMidi()  const override { return false; }
    bool   isMidiEffect()  const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int    getNumPrograms() override  { return 1; }
    int    getCurrentProgram() override { return 0; }
    void   setCurrentProgram(int) override {}
    const  juce::String getProgramName(int) override { return {}; }
    void   changeProgramName(int, const juce::String&) override {}

    void getStateInformation  (juce::MemoryBlock& destData) override;
    void setStateInformation  (const void* data, int sizeInBytes) override;

    // ─── Parameters ──────────────────────────────────────────────────────────
    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // ─── Real-time metrics (read from UI thread) ──────────────────────────────
    std::atomic<float> currentLufsM    { -100.0f };
    std::atomic<float> currentRmsL     { -100.0f };
    std::atomic<float> currentRmsR     { -100.0f };
    std::atomic<float> gainReductionDb { 0.0f };
    std::atomic<bool>  isConnected     { false };

    double currentSampleRate = 48000.0;
    juce::String instanceId;

    // ─── Preset system ────────────────────────────────────────────────────────
    PresetState captureState() const;
    void        applyState   (const PresetState&);

    static constexpr int kMaxUndoSteps = 50;
    void pushUndoState();
    void undo();
    void redo();
    bool canUndo() const { return m_undoIndex > 0; }
    bool canRedo() const { return m_undoIndex < (int)m_undoStack.size() - 1; }

    juce::File getPresetsFolder() const;
    bool savePreset (const juce::String& name, const juce::String& category);
    bool loadPreset (const juce::File& file);
    juce::Array<juce::File> getPresetsForCategory(const juce::String& category) const;
    juce::StringArray       getCategories() const;

    std::atomic<bool> presetsDirty { false };
    juce::String      currentPresetName { "" };
    juce::String      trackName { "MultiFX" };
    int               channelType { 0 }; // 0=Instrument, 1=Drum Bus, 2=Bus, 3=Send, 4=Master
    int               routingChannel { 0 }; // 0 = Off, 1-64

    // ─── OSC (call from editor/message thread) ────────────────────────────────
    void connectOSC();
    
    // ─── Audio Preview Capture ──────────────────────────────────────────────
    void triggerPreviewCapture();
    std::atomic<bool> isCapturingPreview { false };
    std::vector<float> previewBuffer;
    int previewWriteIndex = 0;
    int previewTotalSamples = 0;
    void processPreviewCapture(const juce::AudioBuffer<float>& buffer);

private:
    SharedMemoryWriter m_shm;
    double m_sampleRate = 48000.0;
    int    m_blockSize  = 512;

    // ─── Analysis Data ────────────────────────────────────────────────────────
    static constexpr int kFftSize = 4096;
    std::unique_ptr<juce::dsp::FFT> m_fft;
    std::unique_ptr<juce::dsp::WindowingFunction<float>> m_window;
    std::vector<float> m_fftBuffer;
    std::array<float, MIXMIND_FFT_BANDS> m_fftBands;
    int m_fftAccum = 0;

    float m_corrSumLR = 0.f;
    float m_corrSumLL = 0.f;
    float m_corrSumRR = 0.f;
    int   m_corrCount = 0;

    float m_crestFactor = 0.f;

    void processFFT(const float* left, const float* right, int numSamples);
    void processStereo(const float* left, const float* right, int numSamples);
    static float linearToDb(float linear) { return 20.0f * std::log10(std::max(linear, 1e-10f)); }

    // ─── Dynamic DSP Blocks (One per slot) ────────────────────────────────────
    
    // EQs (up to 8, one per slot just in case they are all EQs)
    struct EQBlock {
        juce::dsp::IIR::Filter<float> filters[7][2]; // 7 bands, L/R
        juce::dsp::IIR::Filter<float> hp[4][2];      // cascaded HP
        juce::dsp::IIR::Filter<float> lp[4][2];      // cascaded LP
    };
    std::array<std::unique_ptr<EQBlock>, 8> m_eqs;

    // Compressors
    std::array<juce::dsp::Compressor<float>, 8> m_comps;
    
    // Exciters
    struct ExciterBlock {
        juce::dsp::IIR::Filter<float> hpL, hpR;
    };
    std::array<std::unique_ptr<ExciterBlock>, 8> m_exciters;
    
    // Limiters
    std::array<juce::dsp::Limiter<float>, 8> m_limiters;

    // Reverbs
    std::array<juce::Reverb, 8> m_reverbs;

    // Choruses
    std::array<juce::dsp::Chorus<float>, 8> m_choruses;

    // Flangers (Phasers)
    std::array<juce::dsp::Phaser<float>, 8> m_flangers;

    // Custom Delay Lines (Circular buffers)
    struct DelayBlock {
        juce::AudioBuffer<float> buffer;
        int writePos = 0;
        float lastOutL = 0.f, lastOutR = 0.f;
    };
    std::array<std::unique_ptr<DelayBlock>, 8> m_delays;

    void updateEQ(int slot, const SlotState& state);
    void processEQ(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processCompressor(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processExciter(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processLimiter(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processReverb(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processDelay(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processChorus(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);
    void processFlanger(int slot, juce::AudioBuffer<float>& buf, const SlotState& state);

    float saturate(float x, float drive, int type) const noexcept;

    // Effect dispatch
    void processSlot(int slotIdx, juce::AudioBuffer<float>& serialBus, juce::AudioBuffer<float>& parallelBus);

    // ─── LUFS analysis ────────────────────────────────────────────────────────
    struct LufsState {
        std::deque<float> win;
        float x1l=0,x2l=0,y1l=0,y2l=0;
        float x1r=0,x2r=0,y1r=0,y2r=0;
        float x1bl=0,x2bl=0,y1bl=0,y2bl=0;
        float x1br=0,x2br=0,y1br=0,y2br=0;
    } m_lufsState;

    void processLufs(const float* L, const float* R, int n);
    void writeToSharedMemory(const juce::AudioBuffer<float>&);

    // ─── Undo/Redo ────────────────────────────────────────────────────────────
    std::vector<PresetState> m_undoStack;
    int  m_undoIndex      = -1;
    bool m_ignoreUndoPush = false;

    // ─── OSC receiver (composition, safe — no connect in ctor) ───────────────
    struct OscHandler : juce::OSCReceiver::Listener<juce::OSCReceiver::MessageLoopCallback>
    {
        MixMindMultiFXProcessor& proc;
        explicit OscHandler(MixMindMultiFXProcessor& p) : proc(p) {}
        void oscMessageReceived(const juce::OSCMessage& msg) override;
    };
    juce::OSCReceiver m_osc;
    OscHandler        m_oscHandler { *this };
    int               m_oscPort    { -1 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MixMindMultiFXProcessor)
};
