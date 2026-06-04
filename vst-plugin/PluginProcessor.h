// MixMind Bridge — PluginProcessor.h
// Audio processor: captures metrics from any DAW channel, writes to shared memory

#pragma once

#include <JuceHeader.h>
#include "SharedMemoryWriter.h"
#include "../shared/mixmind_protocol.h"
#include <array>
#include <atomic>

class MixMindBridgeProcessor  : public juce::AudioProcessor
{
public:
    MixMindBridgeProcessor();
    ~MixMindBridgeProcessor() override;

    // ── AudioProcessor interface ─────────────────────────────────────
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MixMind Bridge"; }

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

    // ── Parameters ──────────────────────────────────────────────────
    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // ── State accessible by Editor ───────────────────────────────────
    std::atomic<float> currentLufsM { -100.0f };
    std::atomic<float> currentRmsL  { -100.0f };
    std::atomic<float> currentRmsR  { -100.0f };
    std::atomic<bool>  isConnected  { false };
    std::atomic<int>   slotIndex    { -1 };

    juce::String instanceId;
    juce::String channelName { "Channel" };

private:
    SharedMemoryWriter m_shm;

    // ── Audio analysis state ─────────────────────────────────────────
    double m_sampleRate = 48000.0;
    int    m_blockSize  = 512;

    // LUFS accumulators
    struct LufsState {
        std::deque<float> momentaryWindow; // 400ms * sr samples
        std::deque<float> shortTermWindow; // 3s * sr samples
        float x1_l = 0, x2_l = 0, y1_l = 0, y2_l = 0; // Stage 1 biquad
        float x1_r = 0, x2_r = 0, y1_r = 0, y2_r = 0;
        float x1b_l = 0, x2b_l = 0, y1b_l = 0, y2b_l = 0; // Stage 2 biquad
        float x1b_r = 0, x2b_r = 0, y1b_r = 0, y2b_r = 0;
    } m_lufsState;

    // FFT state
    static constexpr int kFftSize = 4096;
    std::array<float, 31> m_fftBands {};
    int    m_fftAccum = 0;
    std::vector<float> m_fftBuffer;
    std::unique_ptr<juce::dsp::FFT> m_fft;
    std::unique_ptr<juce::dsp::WindowingFunction<float>> m_window;

    // Stereo correlation accumulators
    float m_corrSumLR = 0, m_corrSumLL = 0, m_corrSumRR = 0;
    int   m_corrCount = 0;
    std::atomic<float> m_cachedCorrelation { 0.0f };

    // ── Analysis methods ─────────────────────────────────────────────
    void processLufs   (const float* left, const float* right, int numSamples);
    void processFFT    (const float* left, const float* right, int numSamples);
    void processStereo (const float* left, const float* right, int numSamples);

    float computeLufsFromWindow(const std::deque<float>& window);
    float kWeightStage1(float x, float& x1, float& x2, float& y1, float& y2);
    float kWeightStage2(float x, float& x1, float& x2, float& y1, float& y2);

    void writeToSharedMemory(const juce::AudioBuffer<float>& buffer);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MixMindBridgeProcessor)
};
