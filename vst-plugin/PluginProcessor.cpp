// MixMind Bridge — PluginProcessor.cpp
// Audio processing: transparent passthrough + metric extraction + SHM write

#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <chrono>

#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#include <ctime>
#include <cmath>
#include <algorithm>

static constexpr float kSilenceThreshold = 1e-10f;

// ── K-weighting filter coefficients for 48kHz (ITU-R BS.1770-4) ─────────
// Stage 1: High-shelf pre-filter
static constexpr float kS1_b0 = 1.53512485958697f;
static constexpr float kS1_b1 = -2.69169618940638f;
static constexpr float kS1_b2 = 1.19839281085285f;
static constexpr float kS1_a1 = -1.69065929318241f;
static constexpr float kS1_a2 = 0.73248077421585f;

// Stage 2: High-pass filter
static constexpr float kS2_b0 = 1.0f;
static constexpr float kS2_b1 = -2.0f;
static constexpr float kS2_b2 = 1.0f;
static constexpr float kS2_a1 = -1.99004745483398f;
static constexpr float kS2_a2 = 0.99007225036621f;

static inline float linearToDb(float x)
{
    return 20.0f * std::log10(std::max(x, kSilenceThreshold));
}

static inline uint64_t unixMs()
{
    return static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count()
    );
}

// ── Constructor ───────────────────────────────────────────────────────────
MixMindBridgeProcessor::MixMindBridgeProcessor()
    : AudioProcessor(BusesProperties()
        .withInput ("Input",  juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "Parameters", createParameterLayout())
{
    instanceId = juce::Uuid().toString();

    m_fft    = std::make_unique<juce::dsp::FFT>(12); // 2^12 = 4096
    m_window = std::make_unique<juce::dsp::WindowingFunction<float>>(
        kFftSize, juce::dsp::WindowingFunction<float>::hann);
    m_fftBuffer.resize(kFftSize * 2, 0.0f);
}

MixMindBridgeProcessor::~MixMindBridgeProcessor()
{
    m_shm.markInactive(instanceId.toRawUTF8());
    m_shm.close();
}

juce::AudioProcessorEditor* MixMindBridgeProcessor::createEditor()
{
    return new MixMindBridgeEditor(*this);
}

// ── Parameter layout ─────────────────────────────────────────────────────
juce::AudioProcessorValueTreeState::ParameterLayout
MixMindBridgeProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    layout.add(std::make_unique<juce::AudioParameterInt>(
        "channelType", "Channel Type", 0, 4, 0));

    layout.add(std::make_unique<juce::AudioParameterInt>(
        "routing_channel", "Routing Channel", 0, 64, 0));

    layout.add(std::make_unique<juce::AudioParameterInt>(
        "order", "Order", 0, 99, 0));

    return layout;
}

// ── Prepare to play ───────────────────────────────────────────────────────
void MixMindBridgeProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    m_sampleRate = sampleRate;
    m_blockSize  = samplesPerBlock;

    // LUFS window sizes
    int momentarySamples  = static_cast<int>(0.4 * sampleRate);
    int shortTermSamples  = static_cast<int>(3.0 * sampleRate);

    m_lufsState = LufsState{};

    m_fftBuffer.assign(kFftSize * 2, 0.0f);
    m_fftBands.fill(-100.0f);
    m_fftAccum = 0;

    // Open shared memory
    if (m_shm.open())
    {
        isConnected = true;
    }
}

void MixMindBridgeProcessor::releaseResources()
{
    m_shm.markInactive(instanceId.toRawUTF8());
    isConnected = false;
}

// ── processBlock ──────────────────────────────────────────────────────────
void MixMindBridgeProcessor::processBlock(
    juce::AudioBuffer<float>& buffer,
    juce::MidiBuffer&)
{
    // CRITICAL: Do not modify audio — passthrough only
    // (The audio is already in the output buffer via the DAW's routing)

    const int numSamples = buffer.getNumSamples();
    const int numChannels = buffer.getNumChannels();

    if (numChannels < 1 || numSamples == 0) return;

    const float* left  = buffer.getReadPointer(0);
    const float* right = numChannels >= 2 ? buffer.getReadPointer(1) : left;

    // Run analysis (non-destructive)
    processLufs(left, right, numSamples);
    processFFT(left, right, numSamples);
    processStereo(left, right, numSamples);

    // Write metrics to shared memory
    writeToSharedMemory(buffer);
}

// ── LUFS Analysis (K-weighted ITU-R BS.1770-4) ───────────────────────────
float MixMindBridgeProcessor::kWeightStage1(
    float x, float& x1, float& x2, float& y1, float& y2)
{
    float y = kS1_b0*x + kS1_b1*x1 + kS1_b2*x2 - kS1_a1*y1 - kS1_a2*y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
}

float MixMindBridgeProcessor::kWeightStage2(
    float x, float& x1, float& x2, float& y1, float& y2)
{
    float y = kS2_b0*x + kS2_b1*x1 + kS2_b2*x2 - kS2_a1*y1 - kS2_a2*y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
}

void MixMindBridgeProcessor::processLufs(
    const float* left, const float* right, int numSamples)
{
    auto& s = m_lufsState;
    int momentarySize = static_cast<int>(0.4 * m_sampleRate);
    int shortTermSize = static_cast<int>(3.0 * m_sampleRate);

    float sumSq = 0.0f;

    for (int i = 0; i < numSamples; ++i)
    {
        // K-weight left channel
        float wl = kWeightStage1(left[i],  s.x1_l, s.x2_l, s.y1_l, s.y2_l);
        wl        = kWeightStage2(wl,       s.x1b_l, s.x2b_l, s.y1b_l, s.y2b_l);

        // K-weight right channel
        float wr = kWeightStage1(right[i], s.x1_r, s.x2_r, s.y1_r, s.y2_r);
        wr        = kWeightStage2(wr,       s.x1b_r, s.x2b_r, s.y1b_r, s.y2b_r);

        float ms = (wl*wl + wr*wr);
        sumSq += ms;

        s.momentaryWindow.push_back(ms);
        s.shortTermWindow.push_back(ms);
    }

    // Trim windows
    while ((int)s.momentaryWindow.size() > momentarySize)
        s.momentaryWindow.pop_front();
    while ((int)s.shortTermWindow.size() > shortTermSize)
        s.shortTermWindow.pop_front();

    // Compute momentary LUFS from window
    float lufsM = computeLufsFromWindow(s.momentaryWindow);
    currentLufsM.store(lufsM, std::memory_order_relaxed);
}

float MixMindBridgeProcessor::computeLufsFromWindow(const std::deque<float>& window)
{
    if (window.empty()) return -100.0f;
    float sum = 0.0f;
    for (float v : window) sum += v;
    float power = sum / window.size();
    return -0.691f + 10.0f * std::log10(std::max(power, kSilenceThreshold));
}

// ── FFT Analysis ──────────────────────────────────────────────────────────
void MixMindBridgeProcessor::processFFT(
    const float* left, const float* right, int numSamples)
{
    // Accumulate mono samples into FFT buffer
    for (int i = 0; i < numSamples; ++i)
    {
        float mono = (left[i] + right[i]) * 0.5f;
        m_fftBuffer[m_fftAccum] = mono;
        m_fftBuffer[m_fftAccum + kFftSize] = 0.0f; // Clear imag part
        m_fftAccum++;

        if (m_fftAccum >= kFftSize)
        {
            // Apply Hann window
            m_window->multiplyWithWindowingTable(m_fftBuffer.data(), kFftSize);

            // Forward FFT (result is in m_fftBuffer[0..kFftSize*2])
            m_fft->performRealOnlyForwardTransform(m_fftBuffer.data());

            // Map to 31 1/3-octave bands
            static constexpr float kBandCenters[31] = {
                20.f, 25.f, 31.5f, 40.f, 50.f, 63.f, 80.f, 100.f, 125.f, 160.f,
                200.f, 250.f, 315.f, 400.f, 500.f, 630.f, 800.f, 1000.f, 1250.f,
                1600.f, 2000.f, 2500.f, 3150.f, 4000.f, 5000.f, 6300.f, 8000.f,
                10000.f, 12500.f, 16000.f, 20000.f
            };

            float binHz = static_cast<float>(m_sampleRate) / kFftSize;

            for (int b = 0; b < 31; ++b)
            {
                float center = kBandCenters[b];
                float lo = center / std::pow(2.0f, 1.0f/6.0f);
                float hi = center * std::pow(2.0f, 1.0f/6.0f);
                int binLo = std::max(1, (int)(lo / binHz));
                int binHi = std::min(kFftSize/2 - 1, (int)(hi / binHz));

                if (binLo > binHi) { continue; }

                float sumSq = 0.0f;
                for (int bin = binLo; bin <= binHi; ++bin)
                {
                    float re = m_fftBuffer[bin * 2];
                    float im = m_fftBuffer[bin * 2 + 1];
                    float mag = std::sqrt(re*re + im*im) * 2.0f / kFftSize;
                    sumSq += mag * mag;
                }
                float rms = std::sqrt(sumSq / (binHi - binLo + 1));
                float db  = linearToDb(rms);

                // Smooth with 0.8 coefficient
                m_fftBands[b] = 0.8f * m_fftBands[b] + 0.2f * db;
            }

            // Hop (50% overlap)
            m_fftAccum = 0;
            m_fftBuffer.assign(kFftSize * 2, 0.0f);
        }
    }
}

// ── Stereo Field ──────────────────────────────────────────────────────────
void MixMindBridgeProcessor::processStereo(
    const float* left, const float* right, int numSamples)
{
    for (int i = 0; i < numSamples; ++i)
    {
        m_corrSumLR += left[i] * right[i];
        m_corrSumLL += left[i] * left[i];
        m_corrSumRR += right[i] * right[i];
    }
    m_corrCount += numSamples;

    // Update cached correlation on every block
    float denom = std::sqrt(m_corrSumLL * m_corrSumRR);
    if (denom > kSilenceThreshold)
        m_cachedCorrelation = std::clamp(m_corrSumLR / denom, -1.0f, 1.0f);

    // Reset accumulators every ~100ms to keep values fresh
    int resetInterval = static_cast<int>(0.1 * m_sampleRate);
    if (m_corrCount >= resetInterval)
    {
        m_corrCount  = 0;
        m_corrSumLR  = 0;
        m_corrSumLL  = 0;
        m_corrSumRR  = 0;
    }
}

// ── Write to Shared Memory ────────────────────────────────────────────────
void MixMindBridgeProcessor::writeToSharedMemory(
    const juce::AudioBuffer<float>& buffer)
{
    if (!m_shm.isOpen()) return;

    const int numSamples  = buffer.getNumSamples();
    const int numChannels = buffer.getNumChannels();
    const float* left  = buffer.getReadPointer(0);
    const float* right = numChannels >= 2 ? buffer.getReadPointer(1) : left;

    // Compute RMS and Peak for current block
    float rmsL = 0, rmsR = 0, peakL = 0, peakR = 0;
    for (int i = 0; i < numSamples; ++i)
    {
        rmsL  += left[i]  * left[i];
        rmsR  += right[i] * right[i];
        peakL = std::max(peakL, std::abs(left[i]));
        peakR = std::max(peakR, std::abs(right[i]));
    }
    rmsL = std::sqrt(rmsL / numSamples);
    rmsR = std::sqrt(rmsR / numSamples);

    float rmsLdb  = linearToDb(rmsL);
    float rmsRdb  = linearToDb(rmsR);
    float peakLdb = linearToDb(peakL);
    float peakRdb = linearToDb(peakR);

    currentRmsL.store(rmsLdb, std::memory_order_relaxed);
    currentRmsR.store(rmsRdb, std::memory_order_relaxed);

    // M/S analysis
    float midRms = 0, sideRms = 0;
    float corrLR = 0, corrLL = 0, corrRR = 0;
    for (int i = 0; i < numSamples; ++i)
    {
        float mid  = (left[i] + right[i]) * 0.5f;
        float side = (left[i] - right[i]) * 0.5f;
        midRms  += mid * mid;
        sideRms += side * side;
        corrLR  += left[i] * right[i];
        corrLL  += left[i] * left[i];
        corrRR  += right[i] * right[i];
    }
    midRms  = std::sqrt(midRms  / numSamples);
    sideRms = std::sqrt(sideRms / numSamples);
    // Use correlation pre-computed by processStereo() (avoids duplicate work)
    float corr = m_cachedCorrelation.load(std::memory_order_relaxed);

    // DAW transport info
    double bpm = 120.0;
    bool isPlaying = false;
    if (auto* head = getPlayHead())
    {
        auto pos = head->getPosition();
        if (pos.hasValue())
        {
            if (pos->getBpm().hasValue())
                bpm = *pos->getBpm();
            isPlaying = pos->getIsPlaying();
        }
    }

    // Get user parameters
    int channelType = (int)*apvts.getRawParameterValue("channelType");
    int order       = (int)*apvts.getRawParameterValue("order");

    // Build channel slot
    ChannelSlot slot{};
    memset(&slot, 0, sizeof(slot));

    auto id = instanceId.toRawUTF8();
    strncpy(slot.instance_id, id, 63);

    // Get channel name from processor
    strncpy(slot.display_name, channelName.toRawUTF8(), 63);

    slot.channel_type   = static_cast<uint8_t>(channelType);
    slot.routing_channel = static_cast<uint8_t>(*apvts.getRawParameterValue("routing_channel"));
    slot.order          = static_cast<uint32_t>(order);
    slot.is_active      = 1;
    slot.last_update    = unixMs();
    slot.rms_l          = rmsLdb;
    slot.rms_r          = rmsRdb;
    slot.peak_l         = peakLdb;
    slot.peak_r         = peakRdb;
    slot.lufs_m         = currentLufsM.load(std::memory_order_relaxed);
    slot.lufs_s         = slot.lufs_m; // Simplified — full short-term in production
    slot.true_peak      = std::max(peakLdb, peakRdb) + 0.5f; // Approximate
    slot.crest_factor   = std::max(peakLdb, peakRdb) - std::max(rmsLdb, rmsRdb);
    slot.gain_reduction = 0.0f;
    slot.correlation    = corr;
    slot.mid_level      = linearToDb(midRms);
    slot.side_level     = linearToDb(sideRms);
    slot.bpm            = bpm;
    slot.sample_rate    = static_cast<float>(m_sampleRate);
    slot.is_playing     = isPlaying ? 1 : 0;

    for (int b = 0; b < 31; ++b)
        slot.fft_bands[b] = m_fftBands[b];

    m_shm.writeSlot(slot);
}

// ── State persistence ─────────────────────────────────────────────────────
void MixMindBridgeProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty("channelName", channelName, nullptr);
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void MixMindBridgeProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));
    if (xmlState != nullptr && xmlState->hasTagName(apvts.state.getType()))
    {
        auto vt = juce::ValueTree::fromXml(*xmlState);
        apvts.replaceState(vt);
        if (vt.hasProperty("channelName")) {
            channelName = vt.getProperty("channelName").toString();
        }
    }
}

// ── Plugin entry point ────────────────────────────────────────────────────
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MixMindBridgeProcessor();
}
