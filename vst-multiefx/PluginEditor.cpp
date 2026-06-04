#include "PluginProcessor.h"
#include "PluginEditor.h"

MixMindMultiFXEditor::MixMindMultiFXEditor(MixMindMultiFXProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    juce::WebBrowserComponent::Options options;
    options = options.withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
                     .withKeepPageLoadedWhenBrowserIsHidden();

    // 1. Attach Out Gain
    if (auto* param = p.apvts.getParameter("out_gain")) {
        outGainAttachment = std::make_unique<juce::WebSliderParameterAttachment>(*param, outGainRelay, nullptr);
        options = options.withOptionsFrom(outGainRelay);
    }
    
    // Attach In Gain
    if (auto* param = p.apvts.getParameter("in_gain")) {
        inGainAttachment = std::make_unique<juce::WebSliderParameterAttachment>(*param, inGainRelay, nullptr);
        options = options.withOptionsFrom(inGainRelay);
    }

    // Attach Mono Switch
    if (auto* param = p.apvts.getParameter("mono_switch")) {
        monoAttachment = std::make_unique<juce::WebToggleButtonParameterAttachment>(*param, monoRelay, nullptr);
        options = options.withOptionsFrom(monoRelay);
    }

    // Attach Global Bypass
    if (auto* param = p.apvts.getParameter("global_bypass")) {
        globalBypassAttachment = std::make_unique<juce::WebToggleButtonParameterAttachment>(*param, globalBypassRelay, nullptr);
        options = options.withOptionsFrom(globalBypassRelay);
    }

    // Attach Routing Mode
    if (auto* param = p.apvts.getParameter("routing_mode")) {
        routingAttachment = std::make_unique<juce::WebComboBoxParameterAttachment>(*param, routingRelay, nullptr);
        options = options.withOptionsFrom(routingRelay);
    }

    // Attach UI Scale and get initial scale
    float initialScale = 1.0f;
    if (auto* param = p.apvts.getParameter("ui_scale")) {
        uiScaleAttachment = std::make_unique<juce::WebComboBoxParameterAttachment>(*param, uiScaleRelay, nullptr);
        options = options.withOptionsFrom(uiScaleRelay);
        
        int scaleIdxRaw = (int)p.apvts.getRawParameterValue("ui_scale")->load();
        float scales[] = { 0.75f, 1.0f, 1.25f, 1.5f, 2.0f };
        initialScale = scales[juce::jlimit(0, 4, scaleIdxRaw)];
    }

    // Register APVTS listener for dynamic resizing
    p.apvts.addParameterListener("ui_scale", this);

    // 2. Attach Slots (Type & Bypass)
    for (int i = 0; i < 8; ++i) {
        juce::String jsPfx = "slot" + juce::String(i + 1);
        juce::String cppPfx = "s" + juce::String(i);
        
        // Type Relay
        auto typeRelay = std::make_unique<juce::WebComboBoxRelay>(jsPfx + "_type");
        if (auto* param = p.apvts.getParameter(cppPfx + "_type")) {
            slotTypeAttachments.push_back(std::make_unique<juce::WebComboBoxParameterAttachment>(*param, *typeRelay, nullptr));
            options = options.withOptionsFrom(*typeRelay);
        }
        slotTypeRelays.push_back(std::move(typeRelay));

        // Bypass Relay
        auto bypassRelay = std::make_unique<juce::WebToggleButtonRelay>(jsPfx + "_bypass");
        if (auto* param = p.apvts.getParameter(cppPfx + "_bypass")) {
            slotBypassAttachments.push_back(std::make_unique<juce::WebToggleButtonParameterAttachment>(*param, *bypassRelay, nullptr));
            options = options.withOptionsFrom(*bypassRelay);
        }
        slotBypassRelays.push_back(std::move(bypassRelay));
    }

    // Finally initialize webComponent with all options
    webComponent = std::make_unique<juce::WebBrowserComponent>(options);
    
    addAndMakeVisible(*webComponent);
    setSize(850 * initialScale, 400 * initialScale);

    // In development mode, load the Vite dev server directly (using 127.0.0.1 to avoid IPv6 issues)
    webComponent->goToURL("http://127.0.0.1:5173");
}

MixMindMultiFXEditor::~MixMindMultiFXEditor()
{
    processorRef.apvts.removeParameterListener("ui_scale", this);
}

void MixMindMultiFXEditor::parameterChanged(const juce::String& parameterID, float newValue)
{
    if (parameterID == "ui_scale") {
        float scales[] = { 0.75f, 1.0f, 1.25f, 1.5f, 2.0f };
        int idx = juce::jlimit(0, 4, (int)newValue);
        float scale = scales[idx];
        juce::MessageManager::callAsync([this, scale]() {
            setSize(850 * scale, 400 * scale);
        });
    }
}

void MixMindMultiFXEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xFF0F172A)); // Tailwind slate-900 fallback
}

void MixMindMultiFXEditor::resized()
{
    if (webComponent)
        webComponent->setBounds(getLocalBounds());
}
