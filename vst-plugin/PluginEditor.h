// MixMind Bridge — PluginEditor.h
// Minimal dark-themed plugin UI (280x260px)

#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

// ─── Color Palette ────────────────────────────────────────────────────────────
namespace Cols {
    const juce::Colour bg0   { 0xFF0D0E14 };
    const juce::Colour bg1   { 0xFF13151F };
    const juce::Colour bg2   { 0xFF1A1C28 };
    const juce::Colour bg3   { 0xFF21243A };
    const juce::Colour bg4   { 0xFF282B40 };
    const juce::Colour txt   { 0xFFDDE0F0 };
    const juce::Colour dim   { 0xFF6B6F8C };
    const juce::Colour bdr   { 0xFF2A2D42 };
    const juce::Colour acc   { 0xFF5B7CF6 };
}


class MixMindBridgeEditor : public juce::AudioProcessorEditor,
                             private juce::Timer
{
public:
    explicit MixMindBridgeEditor(MixMindBridgeProcessor&);
    ~MixMindBridgeEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

    // Called by processor to get the channel name
    juce::String getChannelName() const;

private:
    MixMindBridgeProcessor& m_processor;

    // ── UI Components ─────────────────────────────────────────────────
    juce::Label       m_logoLabel;
    juce::Label       m_statusDot;

    juce::Label       m_nameLabel;
    juce::TextEditor  m_nameEditor;

    juce::Label       m_typeLabel;
    juce::ComboBox    m_typeCombo;
    juce::Label       m_routingLabel;
    juce::ComboBox    m_routingCombo;
    juce::Label       m_orderLabel;
    juce::Slider      m_orderSlider;

    juce::Label       m_lufsLabel;
    juce::Label       m_srBpmLabel;
    juce::Label       m_connectionLabel;

    // APVTS attachments
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> m_typeAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> m_routingAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment>   m_orderAttach;

    // ── VU meter area (set in resized, used in paint) ─────────────────
    juce::Rectangle<int> m_vuArea;

    // ── Paint helpers ─────────────────────────────────────────────────
    void drawVuMeter(juce::Graphics& g, juce::Rectangle<int> bounds, float dbValue);

    // ── Timer (30Hz repaint) ──────────────────────────────────────────
    void timerCallback() override;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MixMindBridgeEditor)
};
