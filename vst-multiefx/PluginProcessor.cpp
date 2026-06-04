// MixMind MultiFX — PluginProcessor.cpp  v3.0

#include "PluginProcessor.h"
#include "PluginEditor.h"

#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif

#include <chrono>
#include <cmath>
#include <algorithm>

static constexpr float kSil = 1e-10f;

// ─── K-weighting 48kHz ───────────────────────────────────────────────────────
static constexpr float kS1_b0=1.53512f,kS1_b1=-2.69170f,kS1_b2=1.19839f,kS1_a1=-1.69066f,kS1_a2=0.73248f;
static constexpr float kS2_b0=1.f,kS2_b1=-2.f,kS2_b2=1.f,kS2_a1=-1.99005f,kS2_a2=0.99007f;

static float kw1(float x,float&x1,float&x2,float&y1,float&y2){float y=kS1_b0*x+kS1_b1*x1+kS1_b2*x2-kS1_a1*y1-kS1_a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;}
static float kw2(float x,float&x1,float&x2,float&y1,float&y2){float y=kS2_b0*x+kS2_b1*x1+kS2_b2*x2-kS2_a1*y1-kS2_a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;}

// ─── Constructor ─────────────────────────────────────────────────────────────
MixMindMultiFXProcessor::MixMindMultiFXProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
    : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if ! JucePlugin_IsSynth
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      #endif
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                     #endif
                     ),
      apvts (*this, nullptr, "Parameters", createParameterLayout())
#endif
{
    m_fft = std::make_unique<juce::dsp::FFT>(12); // 2^12 = 4096
    m_window = std::make_unique<juce::dsp::WindowingFunction<float>>(
        kFftSize, juce::dsp::WindowingFunction<float>::hann);
    m_fftBuffer.assign(kFftSize * 2, 0.0f);
    m_fftBands.fill(-100.0f);
    m_fftAccum = 0;

    instanceId = juce::Uuid().toString();

    m_undoStack.push_back(captureState());
    m_undoIndex = 0;

    connectOSC();
}

MixMindMultiFXProcessor::~MixMindMultiFXProcessor()
{
    m_shm.markInactive(instanceId.toRawUTF8());
    m_shm.close();
}

// ─── Parameter Layout ────────────────────────────────────────────────────────
juce::AudioProcessorValueTreeState::ParameterLayout
MixMindMultiFXProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> p;

    // Helpers
    auto pf = [&](const juce::String& id, const juce::String& name, float lo, float hi, float def) {
        p.push_back(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID(id,1), name, lo, hi, def));
    };
    auto pi = [&](const juce::String& id, const juce::String& name, int lo, int hi, int def) {
        p.push_back(std::make_unique<juce::AudioParameterInt>(juce::ParameterID(id,1), name, lo, hi, def));
    };

    // Gain
    pf("in_gain",  "Input Gain",  -24.f, 24.f,  0.f);
    pf("out_gain", "Output Gain", -24.f, 24.f,  0.f);
    pi("routing_channel", "Channel", 0, 64, 0);
    pi("mono_switch", "Mono", 0, 1, 0);
    pi("routing_mode", "Routing", 0, 2, 0);
    pi("ui_scale", "UI Scale", 0, 4, 1); // 0=75%, 1=100%, 2=125%, 3=150%, 4=200%
    pi("global_bypass", "Global Bypass", 0, 1, 0);

    for (int s = 1; s <= 8; ++s) {
        juce::String pfx = "slot" + juce::String(s);
        pi(pfx + "_type", pfx + " Type", 0, 8, 0);
        pi(pfx + "_parallel", pfx + " Parallel", 0, 1, 0);
        pi(pfx + "_bypass", pfx + " Bypass", 0, 1, 0);
        
        for (int i = 1; i <= 20; ++i) {
            juce::String pid = pfx + "_p" + juce::String(i);
            // Generic 0.0 to 1.0 parameters. The DSP engine will scale them.
            pf(pid, pid, 0.0f, 1.0f, 0.5f);
        }
    }

    return { p.begin(), p.end() };
}

// ─── Preset Capture/Apply ─────────────────────────────────────────────────────
PresetState MixMindMultiFXProcessor::captureState() const
{
    auto g = [this](const juce::String& id) { return apvts.getRawParameterValue(id)->load(); };
    PresetState s;
    s.presetName  = currentPresetName;
    s.inGain      = g("in_gain");
    s.outGain     = g("out_gain");
    
    for (int i = 0; i < 8; ++i) {
        juce::String pfx = "slot" + juce::String(i + 1);
        s.slots[i].type = (int)g(pfx + "_type");
        s.slots[i].parallel = g(pfx + "_parallel") > 0.5f;
        s.slots[i].bypass = g(pfx + "_bypass") > 0.5f;
        for (int p = 0; p < 20; ++p) {
            s.slots[i].p[p] = g(pfx + "_p" + juce::String(p + 1));
        }
    }
    return s;
}

void MixMindMultiFXProcessor::applyState(const PresetState& s)
{
    auto set = [this](const juce::String& id, float v) {
        if (auto* p = apvts.getParameter(id))
            p->setValueNotifyingHost(p->convertTo0to1(v));
    };
    
    set("in_gain", s.inGain);
    set("out_gain", s.outGain);
    
    for (int i = 0; i < 8; ++i) {
        juce::String pfx = "slot" + juce::String(i + 1);
        set(pfx + "_type", (float)s.slots[i].type);
        set(pfx + "_parallel", s.slots[i].parallel ? 1.0f : 0.0f);
        set(pfx + "_bypass", s.slots[i].bypass ? 1.0f : 0.0f);
        for (int p = 0; p < 20; ++p) {
            set(pfx + "_p" + juce::String(p + 1), s.slots[i].p[p]);
        }
    }
    
    currentPresetName = s.presetName;
}

// ─── Undo/Redo ────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::pushUndoState()
{
    if (m_ignoreUndoPush) return;
    if (m_undoIndex < (int)m_undoStack.size() - 1)
        m_undoStack.resize((size_t)(m_undoIndex + 1));
    m_undoStack.push_back(captureState());
    if ((int)m_undoStack.size() > kMaxUndoSteps)
        m_undoStack.erase(m_undoStack.begin());
    else ++m_undoIndex;
}

void MixMindMultiFXProcessor::undo()
{
    if (!canUndo()) return;
    --m_undoIndex;
    m_ignoreUndoPush = true;
    applyState(m_undoStack[(size_t)m_undoIndex]);
    m_ignoreUndoPush = false;
}

void MixMindMultiFXProcessor::redo()
{
    if (!canRedo()) return;
    ++m_undoIndex;
    m_ignoreUndoPush = true;
    applyState(m_undoStack[(size_t)m_undoIndex]);
    m_ignoreUndoPush = false;
}

// ─── Preset File I/O ─────────────────────────────────────────────────────────
juce::File MixMindMultiFXProcessor::getPresetsFolder() const
{
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
               .getChildFile("MixMind").getChildFile("MultiFX").getChildFile("Presets");
}

bool MixMindMultiFXProcessor::savePreset(const juce::String& name, const juce::String& cat)
{
    juce::File folder = getPresetsFolder().getChildFile(cat);
    folder.createDirectory();
    auto s = captureState();
    s.presetName = name; s.presetCategory = cat;

    juce::XmlElement root("MixMindMultiFXPreset");
    root.setAttribute("version", 4); // v4 dynamic rack
    root.setAttribute("name", name); root.setAttribute("category", cat);
    root.setAttribute("in_gain", (double)s.inGain);
    root.setAttribute("out_gain", (double)s.outGain);
    
    for (int i = 0; i < 8; ++i) {
        auto* slotXml = new juce::XmlElement("Slot" + juce::String(i + 1));
        slotXml->setAttribute("type", s.slots[i].type);
        slotXml->setAttribute("parallel", s.slots[i].parallel ? 1 : 0);
        slotXml->setAttribute("bypass", s.slots[i].bypass ? 1 : 0);
        for (int p = 0; p < 20; ++p) {
            slotXml->setAttribute("p" + juce::String(p + 1), (double)s.slots[i].p[p]);
        }
        root.addChildElement(slotXml);
    }


    if (root.writeTo(folder.getChildFile(name + ".xml"))) {
        currentPresetName = name; presetsDirty.store(true); return true;
    }
    return false;
}

bool MixMindMultiFXProcessor::loadPreset(const juce::File& file)
{
    if (!file.existsAsFile()) return false;
    auto root = juce::XmlDocument::parse(file);
    if (!root || !root->hasTagName("MixMindMultiFXPreset")) return false;

    PresetState s;
    s.presetName = root->getStringAttribute("name", "Default");
    s.presetCategory = root->getStringAttribute("category", "User");
    s.inGain = (float)root->getDoubleAttribute("in_gain", 0.0);
    s.outGain = (float)root->getDoubleAttribute("out_gain", 0.0);

    for (int i = 0; i < 8; ++i) {
        if (auto* slotXml = root->getChildByName("Slot" + juce::String(i + 1))) {
            s.slots[i].type = slotXml->getIntAttribute("type", 0);
            s.slots[i].parallel = slotXml->getIntAttribute("parallel", 0) != 0;
            s.slots[i].bypass = slotXml->getIntAttribute("bypass", 0) != 0;
            for (int p = 0; p < 20; ++p) {
                s.slots[i].p[p] = (float)slotXml->getDoubleAttribute("p" + juce::String(p + 1), 0.5);
            }
        }
    }

    applyState(s);
    presetsDirty = true;
    
    // Auto-save undo state
    if (m_undoStack.empty() || m_undoStack.back().presetName != s.presetName)
        pushUndoState();
        
    return true;
}

juce::Array<juce::File> MixMindMultiFXProcessor::getPresetsForCategory(const juce::String& cat) const
{
    juce::Array<juce::File> res;
    juce::File f = getPresetsFolder().getChildFile(cat);
    if (f.isDirectory()) { f.findChildFiles(res, juce::File::findFiles, false, "*.xml"); res.sort(); }
    return res;
}

juce::StringArray MixMindMultiFXProcessor::getCategories() const
{
    juce::StringArray cats;
    juce::File root = getPresetsFolder();
    if (root.isDirectory()) {
        juce::Array<juce::File> dirs;
        root.findChildFiles(dirs, juce::File::findDirectories, false);
        for (auto& d : dirs) cats.add(d.getFileName());
    }
    for (const char* c : {"EQ","Dynamics","Mastering","Mix Bus","Creative","User"})
        if (!cats.contains(c)) cats.add(c);
    cats.sort(false);
    return cats;
}

// ─── OSC (safe — called from editor / message thread) ───────────────────────
void MixMindMultiFXProcessor::connectOSC()
{
    if (m_oscPort >= 0) return; // already connected
    for (int port = 9001; port <= 9020; ++port) {
        if (m_osc.connect(port)) {
            m_osc.addListener(&m_oscHandler);  // receive all, filter by address in callback
            m_oscPort = port;
            break;
        }
    }
}

void MixMindMultiFXProcessor::OscHandler::oscMessageReceived(const juce::OSCMessage& msg)
{
    juce::String addr = msg.getAddressPattern().toString();

    // Handle Preview Capture
    if (addr == "/mixmind/preview") {
        proc.triggerPreviewCapture();
        return;
    }

    // Accept both /mixmind/multifx/param/<id> and legacy /mixmind/param/<id>
    if (!addr.startsWith("/mixmind/") || !addr.contains("/param/"))
        return;

    juce::String paramId = addr.fromLastOccurrenceOf("/", false, false);
    if (paramId.isEmpty() || msg.isEmpty()) return;

    float val = 0.f;
    if (msg[0].isFloat32())      val = msg[0].getFloat32();
    else if (msg[0].isInt32())   val = (float)msg[0].getInt32();

    // Schedule parameter change on the message thread (safe for APVTS)
    juce::MessageManager::callAsync([this, paramId, val]()
    {
        if (auto* p = proc.apvts.getParameter(paramId))
            p->setValueNotifyingHost(p->convertTo0to1(val));
    });
}

// ─── prepareToPlay ───────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::prepareToPlay(double sampleRate, int blockSize)
{
    m_sampleRate = currentSampleRate = sampleRate;
    m_blockSize  = blockSize;

    juce::dsp::ProcessSpec stereoSpec { sampleRate, (juce::uint32)blockSize, 2 };
    juce::dsp::ProcessSpec monoSpec   { sampleRate, (juce::uint32)blockSize, 1 };

    for (int i=0; i<8; ++i) {
        m_eqs[i] = std::make_unique<EQBlock>();
        for (int b=0; b<7; ++b) { m_eqs[i]->filters[b][0].prepare(monoSpec); m_eqs[i]->filters[b][1].prepare(monoSpec); }
        for (int c=0; c<4; ++c) { m_eqs[i]->hp[c][0].prepare(monoSpec); m_eqs[i]->hp[c][1].prepare(monoSpec); }
        for (int c=0; c<4; ++c) { m_eqs[i]->lp[c][0].prepare(monoSpec); m_eqs[i]->lp[c][1].prepare(monoSpec); }
        
        m_comps[i].prepare(stereoSpec);
        
        m_exciters[i] = std::make_unique<ExciterBlock>();
        m_exciters[i]->hpL.prepare(monoSpec); m_exciters[i]->hpR.prepare(monoSpec);

        m_limiters[i].prepare(stereoSpec);
        
        m_reverbs[i].setSampleRate(sampleRate);
        m_choruses[i].prepare(stereoSpec);
        m_flangers[i].prepare(stereoSpec);

        m_delays[i] = std::make_unique<DelayBlock>();
        m_delays[i]->buffer.setSize(2, (int)(sampleRate * 2.0));
        m_delays[i]->buffer.clear();
    }

    m_lufsState = LufsState{};
    m_fftBuffer.assign(kFftSize * 2, 0.0f);
    m_fftBands.fill(-100.0f);
    m_fftAccum = 0;
    m_corrSumLR = 0.f; m_corrSumLL = 0.f; m_corrSumRR = 0.f;
    m_corrCount = 0;

    m_shm.open();
    isConnected.store(m_shm.isOpen());
}

void MixMindMultiFXProcessor::releaseResources()
{
    m_shm.markInactive(instanceId.toRawUTF8());
    isConnected.store(false);
}

// ─── EQ ──────────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::updateEQ(int slot, const SlotState& s)
{
    double sr = m_sampleRate > 0 ? m_sampleRate : 48000.0;
    auto* eq = m_eqs[slot].get();
    
    auto getFreq = [](float p) { return 20.f * std::pow(1000.f, p); }; // 20Hz-20kHz
    auto getGain = [](float p) { return (p * 36.f) - 18.f; }; // -18..+18
    auto getQ    = [](float p) { return 0.1f + p * 9.9f; }; // 0.1..10

    // HP
    int hpSlope = (int)(s.p[2] * 3.f);
    if (hpSlope == 0) {
        auto hpC = juce::dsp::IIR::Coefficients<float>::makeFirstOrderHighPass(sr, getFreq(s.p[1]));
        *eq->hp[0][0].coefficients = *hpC; *eq->hp[0][1].coefficients = *hpC;
    } else {
        auto hpC = juce::dsp::IIR::Coefficients<float>::makeHighPass(sr, getFreq(s.p[1]), 0.707f);
        int cascades = (hpSlope == 1) ? 1 : (hpSlope == 2) ? 2 : 4;
        for (int c = 0; c < cascades; ++c) { *eq->hp[c][0].coefficients = *hpC; *eq->hp[c][1].coefficients = *hpC; }
    }
    
    // LP
    int lpSlope = (int)(s.p[18] * 3.f);
    if (lpSlope == 0) {
        auto lpC = juce::dsp::IIR::Coefficients<float>::makeFirstOrderLowPass(sr, getFreq(s.p[17]));
        *eq->lp[0][0].coefficients = *lpC; *eq->lp[0][1].coefficients = *lpC;
    } else {
        auto lpC = juce::dsp::IIR::Coefficients<float>::makeLowPass(sr, getFreq(s.p[17]), 0.707f);
        int cascades = (lpSlope == 1) ? 1 : (lpSlope == 2) ? 2 : 4;
        for (int c = 0; c < cascades; ++c) { *eq->lp[c][0].coefficients = *lpC; *eq->lp[c][1].coefficients = *lpC; }
    }

    // Bells & Shelves
    auto lsC = juce::dsp::IIR::Coefficients<float>::makeLowShelf(sr, getFreq(s.p[3]), 0.707f, juce::Decibels::decibelsToGain(getGain(s.p[4])));
    *eq->filters[1][0].coefficients = *lsC; *eq->filters[1][1].coefficients = *lsC;
    auto lmC = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sr, getFreq(s.p[5]), getQ(s.p[7]), juce::Decibels::decibelsToGain(getGain(s.p[6])));
    *eq->filters[2][0].coefficients = *lmC; *eq->filters[2][1].coefficients = *lmC;
    auto mC  = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sr, getFreq(s.p[8]), getQ(s.p[10]), juce::Decibels::decibelsToGain(getGain(s.p[9])));
    *eq->filters[3][0].coefficients = *mC;  *eq->filters[3][1].coefficients = *mC;
    auto hmC = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sr, getFreq(s.p[11]), getQ(s.p[13]), juce::Decibels::decibelsToGain(getGain(s.p[12])));
    *eq->filters[4][0].coefficients = *hmC; *eq->filters[4][1].coefficients = *hmC;
    auto hsC = juce::dsp::IIR::Coefficients<float>::makeHighShelf(sr, getFreq(s.p[14]), 0.707f, juce::Decibels::decibelsToGain(getGain(s.p[15])));
    *eq->filters[5][0].coefficients = *hsC; *eq->filters[5][1].coefficients = *hsC;
}

void MixMindMultiFXProcessor::processEQ(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    updateEQ(slot, s);
    const int N = buf.getNumSamples();
    float* L = buf.getWritePointer(0);
    float* R = buf.getWritePointer(1);
    bool hpOn = s.p[0] > 0.5f;
    bool lpOn = s.p[16] > 0.5f;
    int hpSlope = (int)(s.p[2] * 3.f);
    int hpCascades = (hpSlope == 0 || hpSlope == 1) ? 1 : (hpSlope == 2) ? 2 : 4;
    int lpSlope = (int)(s.p[18] * 3.f);
    int lpCascades = (lpSlope == 0 || lpSlope == 1) ? 1 : (lpSlope == 2) ? 2 : 4;

    auto* eq = m_eqs[slot].get();
    for (int i = 0; i < N; ++i) {
        if (hpOn) { 
            for (int c = 0; c < hpCascades; ++c) { L[i] = eq->hp[c][0].processSample(L[i]); R[i] = eq->hp[c][1].processSample(R[i]); }
        }
        for (int f = 1; f <= 5; ++f) {
            L[i] = eq->filters[f][0].processSample(L[i]); R[i] = eq->filters[f][1].processSample(R[i]);
        }
        if (lpOn) { 
            for (int c = 0; c < lpCascades; ++c) { L[i] = eq->lp[c][0].processSample(L[i]); R[i] = eq->lp[c][1].processSample(R[i]); }
        }
    }
}

// ─── Compressor ──────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processCompressor(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    float thresh  = (s.p[0] * 60.f) - 60.f; // -60..0
    float ratio   = 1.f + (s.p[1] * 19.f);  // 1..20
    float attack  = 0.1f + (s.p[2] * 199.9f); // 0.1..200
    float release = 10.f + (s.p[3] * 1990.f); // 10..2000
    float makeup  = s.p[5] * 24.f; // 0..24
    float mix     = s.p[6]; // 0..1
    int   type    = (int)(s.p[7] * 3.f); // 0..3

    switch (type) {
        case 1: attack = std::min(attack, 10.0f); ratio = std::max(ratio, 4.0f); break;
        case 2: attack = std::max(attack, 5.0f); release = std::max(release, 100.0f); break;
        case 3: ratio = std::min(ratio, 6.0f); attack = std::max(attack, 1.0f); break;
        default: break;
    }

    auto& comp = m_comps[slot];
    comp.setThreshold(thresh); comp.setRatio(ratio); comp.setAttack(attack); comp.setRelease(release);

    juce::AudioBuffer<float> dry; dry.makeCopyOf(buf);
    juce::dsp::AudioBlock<float> block(buf);
    juce::dsp::ProcessContextReplacing<float> ctx(block);
    comp.process(ctx);

    float mkGain = juce::Decibels::decibelsToGain(makeup);
    buf.applyGain(mkGain);

    if (type == 1) { // FET sat
        const float d = 1.2f;
        for (int ch = 0; ch < buf.getNumChannels(); ++ch) {
            float* p = buf.getWritePointer(ch);
            for (int i = 0; i < buf.getNumSamples(); ++i) p[i] = std::tanh(p[i] * d) / std::tanh(d);
        }
    }

    if (mix < 0.999f) {
        for (int ch = 0; ch < buf.getNumChannels(); ++ch) {
            auto* wet = buf.getWritePointer(ch); const auto* d = dry.getReadPointer(ch);
            for (int i = 0; i < buf.getNumSamples(); ++i) wet[i] = mix * wet[i] + (1.f - mix) * d[i];
        }
    }
}

// ─── Exciter ──────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processExciter(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    float drive = s.p[0] * 10.f; // 0..10
    if (drive < 0.01f) return;
    float freq = 200.f * std::pow(100.f, s.p[1]); // 200..20k
    float mix = s.p[2]; // 0..1
    int type = (int)(s.p[3] * 4.f);

    auto hpC = juce::dsp::IIR::Coefficients<float>::makeHighPass(m_sampleRate, (double)freq, 0.707);
    auto* exc = m_exciters[slot].get();
    *exc->hpL.coefficients = *hpC; *exc->hpR.coefficients = *hpC;

    float driveGain = juce::Decibels::decibelsToGain(drive * 2.0f);
    const int N = buf.getNumSamples();
    float* L = buf.getWritePointer(0); float* R = buf.getWritePointer(1);

    for (int i = 0; i < N; ++i) {
        float hpL = exc->hpL.processSample(L[i]) * driveGain;
        float hpR = exc->hpR.processSample(R[i]) * driveGain;
        float satL = saturate(hpL, drive * 0.5f, type);
        float satR = saturate(hpR, drive * 0.5f, type);
        L[i] += mix * satL * 0.3f; R[i] += mix * satR * 0.3f;
    }
}

// ─── Limiter ─────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processLimiter(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    float thresh  = (s.p[0] * 20.f) - 20.f;
    float ceil    = (s.p[1] * 6.f) - 6.f;
    float release = 1.f + (s.p[2] * 499.f);
    int mode = (int)(s.p[3] * 1.f);
    
    if (mode == 0) {
        m_limiters[slot].setThreshold(thresh); m_limiters[slot].setRelease(release);
        juce::dsp::AudioBlock<float> block(buf);
        juce::dsp::ProcessContextReplacing<float> ctx(block);
        m_limiters[slot].process(ctx);
    } else {
        float tg = juce::Decibels::decibelsToGain(thresh);
        float cg = juce::Decibels::decibelsToGain(ceil);
        for (int ch = 0; ch < buf.getNumChannels(); ++ch) {
            float* p = buf.getWritePointer(ch);
            for (int i = 0; i < buf.getNumSamples(); ++i) {
                float v = p[i];
                if (std::abs(v) > tg * 0.8f) {
                    float ex = std::abs(v) - tg * 0.8f;
                    v = (v > 0.f ? 1.f : -1.f) * (tg * 0.8f + std::tanh(ex * 3.f) / 3.f);
                }
                p[i] = std::clamp(v, -cg, cg);
            }
        }
    }
}

// ─── Reverb ─────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processReverb(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    juce::Reverb::Parameters rp;
    rp.roomSize = s.p[0]; // 0..1
    rp.damping  = s.p[1]; // 0..1
    rp.wetLevel = s.p[2]; // 0..1
    rp.dryLevel = s.p[3]; // 0..1
    rp.width    = s.p[4]; // 0..1
    rp.freezeMode = s.p[5]; // 0..1
    
    m_reverbs[slot].setParameters(rp);
    
    if (buf.getNumChannels() == 1) m_reverbs[slot].processMono(buf.getWritePointer(0), buf.getNumSamples());
    else m_reverbs[slot].processStereo(buf.getWritePointer(0), buf.getWritePointer(1), buf.getNumSamples());
}

// ─── Delay ─────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processDelay(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    auto* del = m_delays[slot].get();
    float timeL = 0.01f + s.p[0] * 1.99f; // 10ms..2000ms
    float timeR = 0.01f + s.p[1] * 1.99f;
    float fb    = s.p[2] * 0.95f; // limit feedback
    float mix   = s.p[3];
    
    int sampsL = (int)(timeL * m_sampleRate);
    int sampsR = (int)(timeR * m_sampleRate);
    int maxSamps = del->buffer.getNumSamples();
    
    float* dL = del->buffer.getWritePointer(0);
    float* dR = del->buffer.getWritePointer(1);
    
    float* iL = buf.getWritePointer(0);
    float* iR = buf.getNumChannels() > 1 ? buf.getWritePointer(1) : nullptr;
    
    for (int i = 0; i < buf.getNumSamples(); ++i) {
        int readPosL = del->writePos - sampsL; if (readPosL < 0) readPosL += maxSamps;
        int readPosR = del->writePos - sampsR; if (readPosR < 0) readPosR += maxSamps;
        
        float outL = dL[readPosL];
        float outR = dR[readPosR];
        
        float inSampleL = iL[i];
        float inSampleR = iR ? iR[i] : iL[i];
        
        dL[del->writePos] = inSampleL + outL * fb;
        dR[del->writePos] = inSampleR + outR * fb;
        
        iL[i] = iL[i] * (1.f - mix) + outL * mix;
        if (iR) iR[i] = iR[i] * (1.f - mix) + outR * mix;
        
        if (++del->writePos >= maxSamps) del->writePos = 0;
    }
}

// ─── Chorus & Flanger ─────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processChorus(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    m_choruses[slot].setRate(0.1f + s.p[0] * 9.9f); // 0.1..10 Hz
    m_choruses[slot].setDepth(s.p[1]); // 0..1
    m_choruses[slot].setCentreDelay(1.f + s.p[2] * 99.f); // 1..100 ms
    m_choruses[slot].setFeedback(s.p[3] * 0.95f);
    m_choruses[slot].setMix(s.p[4]);
    
    juce::dsp::AudioBlock<float> block(buf);
    juce::dsp::ProcessContextReplacing<float> ctx(block);
    m_choruses[slot].process(ctx);
}

void MixMindMultiFXProcessor::processFlanger(int slot, juce::AudioBuffer<float>& buf, const SlotState& s)
{
    m_flangers[slot].setRate(0.01f + s.p[0] * 4.99f); // 0.01..5 Hz
    m_flangers[slot].setDepth(s.p[1]); // 0..1
    m_flangers[slot].setCentreFrequency(200.f + s.p[2] * 8000.f); // 200..8200 Hz
    m_flangers[slot].setFeedback(s.p[3] * 0.95f);
    m_flangers[slot].setMix(s.p[4]);
    
    juce::dsp::AudioBlock<float> block(buf);
    juce::dsp::ProcessContextReplacing<float> ctx(block);
    m_flangers[slot].process(ctx);
}

// ─── Effect dispatch ─────────────────────────────────────────────────────────
float MixMindMultiFXProcessor::saturate(float x, float drive, int type) const noexcept
{
    float d = drive * 0.1f + 1.0f; 
    switch (type) {
        case 0: return std::tanh(x * d) / std::tanh(d); // Tape
        case 1: { // Tube (asym)
            float v = x * d;
            return v > 0 ? std::tanh(v) : std::tanh(v * 0.8f); 
        }
        case 2: return std::clamp(x * d, -1.0f, 1.0f); // Transistor (harder)
        case 3: return std::sin(x * d * 1.5f); // Digital (folding)
        case 4: return std::tanh(x * d) * 0.9f + x * 0.1f; // Transformer
    }
    return x;
}

void MixMindMultiFXProcessor::processSlot(int slotIdx, juce::AudioBuffer<float>& serialBus, juce::AudioBuffer<float>& parallelBus)
{
    auto getG = [this](const juce::String& id) { return apvts.getRawParameterValue(id)->load(); };
    juce::String pfx = "slot" + juce::String(slotIdx + 1);
    
    SlotState s;
    s.type = (int)getG(pfx + "_type");
    s.parallel = getG(pfx + "_parallel") > 0.5f;
    s.bypass = getG(pfx + "_bypass") > 0.5f;
    for (int p=0; p<20; ++p) s.p[p] = getG(pfx + "_p" + juce::String(p+1));

    if (s.type == 0 || s.bypass) return; // Empty or Bypassed

    // If parallel, we copy the serial bus, process the copy, and add it to the parallel bus.
    // If serial, we process the serial bus directly.
    juce::AudioBuffer<float> tempBuf;
    if (s.parallel) {
        tempBuf.makeCopyOf(serialBus);
    }
    
    juce::AudioBuffer<float>& targetBuf = s.parallel ? tempBuf : serialBus;

    switch (s.type) {
        case 1: processEQ(slotIdx, targetBuf, s); break;
        case 2: processCompressor(slotIdx, targetBuf, s); break;
        case 3: processExciter(slotIdx, targetBuf, s); break;
        case 4: processLimiter(slotIdx, targetBuf, s); break;
        case 5: processReverb(slotIdx, targetBuf, s); break;
        case 6: processDelay(slotIdx, targetBuf, s); break;
        case 7: processChorus(slotIdx, targetBuf, s); break;
        case 8: processFlanger(slotIdx, targetBuf, s); break;
        default: break;
    }
    
    if (s.parallel) {
        for (int ch=0; ch<targetBuf.getNumChannels(); ++ch)
            parallelBus.addFrom(ch, 0, targetBuf, ch, 0, targetBuf.getNumSamples());
    }
}

// ─── processBlock ─────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processBlock(juce::AudioBuffer<float>& buf, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto inCh  = getTotalNumInputChannels();
    auto outCh = getTotalNumOutputChannels();
    for (int ch = inCh; ch < outCh; ++ch) buf.clear(ch, 0, buf.getNumSamples());
    if (inCh < 2 || buf.getNumSamples() == 0) return;

    bool isBypassed = apvts.getRawParameterValue("global_bypass")->load() > 0.5f;
    if (isBypassed) {
        // Keep analysis running even if bypassed
        int N = buf.getNumSamples();
        processLufs(buf.getReadPointer(0), buf.getReadPointer(1), N);
        processFFT(buf.getReadPointer(0), buf.getReadPointer(1), N);
        return; // Output equals input
    }

    // In gain
    float inGdB = apvts.getRawParameterValue("in_gain")->load();
    buf.applyGain(juce::Decibels::decibelsToGain(inGdB));

    // Mono sum if requested
    bool isMono = apvts.getRawParameterValue("mono_switch")->load() > 0.5f;
    if (isMono) {
        for (int i = 0; i < buf.getNumSamples(); ++i) {
            float m = (buf.getSample(0, i) + buf.getSample(1, i)) * 0.5f;
            buf.setSample(0, i, m);
            buf.setSample(1, i, m);
        }
    }

    // Routing Mode (0=Stereo, 1=L/R, 2=M/S)
    int routingMode = (int)apvts.getRawParameterValue("routing_mode")->load();
    if (routingMode == 2) {
        // Encode M/S
        for (int i = 0; i < buf.getNumSamples(); ++i) {
            float l = buf.getSample(0, i);
            float r = buf.getSample(1, i);
            buf.setSample(0, i, (l + r) * 0.5f); // Mid
            buf.setSample(1, i, (l - r) * 0.5f); // Side
        }
    }

    // Parallel Bus
    juce::AudioBuffer<float> parallelBus(buf.getNumChannels(), buf.getNumSamples());
    parallelBus.clear();

    // 8-Slot Rack Processing
    for (int i = 0; i < 8; ++i) {
        processSlot(i, buf, parallelBus);
    }

    // Sum Parallel Bus back to Serial Bus
    for (int ch = 0; ch < buf.getNumChannels(); ++ch) {
        buf.addFrom(ch, 0, parallelBus, ch, 0, buf.getNumSamples());
    }

    if (routingMode == 2) {
        // Decode M/S
        for (int i = 0; i < buf.getNumSamples(); ++i) {
            float m = buf.getSample(0, i);
            float s = buf.getSample(1, i);
            buf.setSample(0, i, m + s); // Left
            buf.setSample(1, i, m - s); // Right
        }
    }

    // Out gain
    float outGdB = apvts.getRawParameterValue("out_gain")->load();
    buf.applyGain(juce::Decibels::decibelsToGain(outGdB));

    // Analysis
    int N = buf.getNumSamples();
    const float* L = buf.getReadPointer(0);
    const float* R = buf.getReadPointer(1);
    processLufs(L, R, N);
    processFFT(L, R, N);
    processStereo(L, R, N);

    // RMS & Crest Factor
    float rmsL = 0, rmsR = 0, peakL = 0, peakR = 0;
    for (int i = 0; i < N; ++i) { 
        float absL = std::abs(L[i]); float absR = std::abs(R[i]);
        rmsL += absL*absL; rmsR += absR*absR; 
        if (absL > peakL) peakL = absL;
        if (absR > peakR) peakR = absR;
    }
    float inv = N > 0 ? 1.f/N : 0.f;
    float rmsDbL = 20.f * std::log10(std::max(std::sqrt(rmsL*inv), kSil));
    float rmsDbR = 20.f * std::log10(std::max(std::sqrt(rmsR*inv), kSil));
    currentRmsL.store(rmsDbL);
    currentRmsR.store(rmsDbR);
    
    float peakDb = 20.f * std::log10(std::max(std::max(peakL, peakR), kSil));
    float rmsDbMax = std::max(rmsDbL, rmsDbR);
    m_crestFactor = std::max(0.0f, peakDb - rmsDbMax);

    processPreviewCapture(buf);
    writeToSharedMemory(buf);
}

// ─── LUFS ────────────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::processLufs(const float* L, const float* R, int n)
{
    auto& s = m_lufsState;
    int winSize = (int)(0.4 * m_sampleRate);
    for (int i = 0; i < n; ++i) {
        float wl = kw1(L[i],s.x1l,s.x2l,s.y1l,s.y2l); wl=kw2(wl,s.x1bl,s.x2bl,s.y1bl,s.y2bl);
        float wr = kw1(R[i],s.x1r,s.x2r,s.y1r,s.y2r); wr=kw2(wr,s.x1br,s.x2br,s.y1br,s.y2br);
        s.win.push_back(wl*wl + wr*wr);
    }
    while ((int)s.win.size() > winSize) s.win.pop_front();
    if (!s.win.empty()) {
        float sum = 0.f; for (float v : s.win) sum += v;
        float power = sum / (float)s.win.size();
        currentLufsM.store(-0.691f + 10.f * std::log10(std::max(power, kSil)));
    }
}

// ─── FFT & Stereo Analysis ──────────────────────────────────────────────────
void MixMindMultiFXProcessor::processFFT(const float* left, const float* right, int numSamples)
{
    for (int i = 0; i < numSamples; ++i)
    {
        float mono = (left[i] + right[i]) * 0.5f;
        m_fftBuffer[m_fftAccum] = mono;
        m_fftBuffer[m_fftAccum + kFftSize] = 0.0f; // Clear imag part
        m_fftAccum++;

        if (m_fftAccum >= kFftSize)
        {
            m_window->multiplyWithWindowingTable(m_fftBuffer.data(), kFftSize);
            m_fft->performRealOnlyForwardTransform(m_fftBuffer.data());

            static constexpr float kBandCenters[31] = {
                20.f, 25.f, 31.5f, 40.f, 50.f, 63.f, 80.f, 100.f, 125.f, 160.f,
                200.f, 250.f, 315.f, 400.f, 500.f, 630.f, 800.f, 1000.f, 1250.f,
                1600.f, 2000.f, 2500.f, 3150.f, 4000.f, 5000.f, 6300.f, 8000.f,
                10000.f, 12500.f, 16000.f, 20000.f
            };
            float binHz = static_cast<float>(m_sampleRate > 0 ? m_sampleRate : 48000.0) / kFftSize;

            for (int b = 0; b < 31; ++b)
            {
                float center = kBandCenters[b];
                float lo = center / 1.122462048f; // 2^(1/6)
                float hi = center * 1.122462048f;
                int binLo = std::max(1, (int)(lo / binHz));
                int binHi = std::min(kFftSize/2 - 1, (int)(hi / binHz));

                if (binLo > binHi) continue;

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
                m_fftBands[b] = 0.8f * m_fftBands[b] + 0.2f * db;
            }

            m_fftAccum = 0;
            m_fftBuffer.assign(kFftSize * 2, 0.0f);
        }
    }
}

void MixMindMultiFXProcessor::processStereo(const float* left, const float* right, int numSamples)
{
    for (int i = 0; i < numSamples; ++i)
    {
        m_corrSumLR += left[i] * right[i];
        m_corrSumLL += left[i] * left[i];
        m_corrSumRR += right[i] * right[i];
    }
    m_corrCount += numSamples;

    int resetInterval = static_cast<int>(0.1 * (m_sampleRate > 0 ? m_sampleRate : 48000.0));
    if (m_corrCount >= resetInterval)
    {
        m_corrCount = 0;
        m_corrSumLR = 0; m_corrSumLL = 0; m_corrSumRR = 0;
    }
}

// ─── Shared Memory ────────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::writeToSharedMemory(const juce::AudioBuffer<float>& buf)
{
    if (!m_shm.isOpen()) return;
    ChannelSlot slot;
    std::memset(&slot, 0, sizeof(slot));
    strncpy(slot.instance_id,  instanceId.toRawUTF8(), 63);
    strncpy(slot.display_name, trackName.toRawUTF8(), 63);
    slot.channel_type = (uint8_t)channelType;
    slot.routing_channel = (uint8_t)apvts.getRawParameterValue("routing_channel")->load();
    slot.is_active    = 1;
    slot.last_update  = (uint64_t)juce::Time::currentTimeMillis();
    slot.rms_l        = currentRmsL.load();
    slot.rms_r        = currentRmsR.load();
    slot.lufs_m       = currentLufsM.load();
    slot.sample_rate  = (float)m_sampleRate;
    slot.osc_port     = (uint16_t)std::max(0, m_oscPort);
    
    // Additional metrics
    slot.crest_factor = m_crestFactor;
    slot.gain_reduction = gainReductionDb.load();
    
    float denom = std::sqrt(m_corrSumLL * m_corrSumRR);
    slot.correlation = denom > 1e-10f ? (m_corrSumLR / denom) : 0.0f;
    
    for (int i = 0; i < MIXMIND_FFT_BANDS; ++i)
        slot.fft_bands[i] = m_fftBands[i];

    if (auto* h = getPlayHead()) {
        if (auto pos = h->getPosition()) {
            slot.is_playing = pos->getIsPlaying() ? 1 : 0;
            if (auto bpm = pos->getBpm()) slot.bpm = *bpm;
        }
    }
    m_shm.writeSlot(slot);
    isConnected.store(true);
}

// ─── State Persistence ────────────────────────────────────────────────────────
void MixMindMultiFXProcessor::getStateInformation(juce::MemoryBlock& dest)
{
    auto st = apvts.copyState();
    st.setProperty("presetName", currentPresetName, nullptr);
    st.setProperty("trackName", trackName, nullptr);
    st.setProperty("channelType", channelType, nullptr);
    std::unique_ptr<juce::XmlElement> xml(st.createXml());
    copyXmlToBinary(*xml, dest);
}

void MixMindMultiFXProcessor::setStateInformation(const void* data, int size)
{
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, size));
    if (xml && xml->hasTagName(apvts.state.getType())) {
        auto st = juce::ValueTree::fromXml(*xml);
        currentPresetName = st.getProperty("presetName", "").toString();
        trackName = st.getProperty("trackName", "MultiFX").toString();
        channelType = (int)st.getProperty("channelType", 0);
        apvts.replaceState(st);
    }
}

// ─── Audio Preview Capture ──────────────────────────────────────────────────
void MixMindMultiFXProcessor::triggerPreviewCapture()
{
    if (isCapturingPreview.load()) return;
    previewTotalSamples = (int)(currentSampleRate * 2.0); // 2 seconds
    previewBuffer.resize(previewTotalSamples, 0.0f);
    previewWriteIndex = 0;
    isCapturingPreview.store(true);
}

void MixMindMultiFXProcessor::processPreviewCapture(const juce::AudioBuffer<float>& buffer)
{
    if (!isCapturingPreview.load()) return;

    int numSamples = buffer.getNumSamples();
    int samplesToWrite = std::min(numSamples, previewTotalSamples - previewWriteIndex);
    
    // Mix down to mono
    const float* l = buffer.getReadPointer(0);
    const float* r = buffer.getNumChannels() > 1 ? buffer.getReadPointer(1) : l;

    for (int i = 0; i < samplesToWrite; ++i) {
        previewBuffer[previewWriteIndex + i] = (l[i] + r[i]) * 0.5f;
    }
    
    previewWriteIndex += samplesToWrite;

    if (previewWriteIndex >= previewTotalSamples) {
        isCapturingPreview.store(false);
        
        // Save to WAV on a background thread
        juce::MessageManager::callAsync([this]() {
            juce::File tempDir = juce::File::getSpecialLocation(juce::File::tempDirectory);
            juce::File wavFile = tempDir.getChildFile("mixmind_preview_" + instanceId + ".wav");
            
            juce::WavAudioFormat format;
            std::unique_ptr<juce::AudioFormatWriter> writer(format.createWriterFor(
                new juce::FileOutputStream(wavFile),
                currentSampleRate, 1, 16, {}, 0));
                
            if (writer) {
                const float* ptr = previewBuffer.data();
                writer->writeFromFloatArrays(&ptr, 1, previewTotalSamples);
            }
        });
    }
}

// ─── Factory ─────────────────────────────────────────────────────────────────
juce::AudioProcessorEditor* MixMindMultiFXProcessor::createEditor()
{
    return new MixMindMultiFXEditor(*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MixMindMultiFXProcessor();
}
