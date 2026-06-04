#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"
#include <array>

class MixMindMultiFXEditor : public juce::AudioProcessorEditor,
                             public juce::AudioProcessorValueTreeState::Listener
{
public:
    explicit MixMindMultiFXEditor(MixMindMultiFXProcessor& p);
    ~MixMindMultiFXEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

    void parameterChanged(const juce::String& parameterID, float newValue) override;

private:
    MixMindMultiFXProcessor& processorRef;

    juce::WebSliderRelay inGainRelay{ "in_gain" };
    std::unique_ptr<juce::WebSliderParameterAttachment> inGainAttachment;

    juce::WebSliderRelay outGainRelay{ "out_gain" };
    std::unique_ptr<juce::WebSliderParameterAttachment> outGainAttachment;

    juce::WebToggleButtonRelay monoRelay{ "mono_switch" };
    std::unique_ptr<juce::WebToggleButtonParameterAttachment> monoAttachment;

    juce::WebToggleButtonRelay globalBypassRelay{ "global_bypass" };
    std::unique_ptr<juce::WebToggleButtonParameterAttachment> globalBypassAttachment;

    juce::WebComboBoxRelay routingRelay{ "routing_mode" };
    std::unique_ptr<juce::WebComboBoxParameterAttachment> routingAttachment;

    juce::WebComboBoxRelay uiScaleRelay{ "ui_scale" };
    std::unique_ptr<juce::WebComboBoxParameterAttachment> uiScaleAttachment;

    std::vector<std::unique_ptr<juce::WebComboBoxRelay>> slotTypeRelays;
    std::vector<std::unique_ptr<juce::WebComboBoxParameterAttachment>> slotTypeAttachments;

    std::vector<std::unique_ptr<juce::WebToggleButtonRelay>> slotBypassRelays;
    std::vector<std::unique_ptr<juce::WebToggleButtonParameterAttachment>> slotBypassAttachments;

    std::unique_ptr<juce::WebBrowserComponent> webComponent;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MixMindMultiFXEditor)
};
