// MixMind Bridge — PluginEditor.cpp
// Minimal DAW-style plugin UI, 280x260px, 30Hz repaint

#include "PluginEditor.h"

MixMindBridgeEditor::MixMindBridgeEditor(MixMindBridgeProcessor& p)
    : AudioProcessorEditor(&p), m_processor(p)
{
    setSize(280, 260);
    setResizable(false, false);

    // ── Logo label ────────────────────────────────────────────────────
    m_logoLabel.setText("MixMind Bridge", juce::dontSendNotification);
    m_logoLabel.setFont(juce::Font(14.0f, juce::Font::bold));
    m_logoLabel.setColour(juce::Label::textColourId, Cols::txt);
    addAndMakeVisible(m_logoLabel);

    m_statusDot.setText(juce::String::fromUTF8("\xE2\x97\x8F"), juce::dontSendNotification);
    m_statusDot.setFont(juce::Font(12.0f));
    m_statusDot.setJustificationType(juce::Justification::centredRight);
    addAndMakeVisible(m_statusDot);

    // ── Channel Name ──────────────────────────────────────────────────
    m_nameLabel.setText("Channel Name", juce::dontSendNotification);
    m_nameLabel.setFont(juce::Font(10.0f));
    m_nameLabel.setColour(juce::Label::textColourId, Cols::dim);
    addAndMakeVisible(m_nameLabel);

    m_nameEditor.setTextToShowWhenEmpty("Enter channel name...", Cols::dim);
    m_nameEditor.setFont(juce::Font(12.0f));
    m_nameEditor.setColour(juce::TextEditor::backgroundColourId, Cols::bg3);
    m_nameEditor.setColour(juce::TextEditor::outlineColourId,    Cols::bdr);
    m_nameEditor.setColour(juce::TextEditor::textColourId,       Cols::txt);
    m_nameEditor.setColour(juce::TextEditor::focusedOutlineColourId, Cols::acc);

    if (m_processor.channelName != "Channel") {
        m_nameEditor.setText(m_processor.channelName, juce::dontSendNotification);
    }
    m_nameEditor.onTextChange = [this] {
        m_processor.channelName = getChannelName();
    };
    addAndMakeVisible(m_nameEditor);

    // ── Type label ────────────────────────────────────────────────────
    m_typeLabel.setText("Type", juce::dontSendNotification);
    m_typeLabel.setFont(juce::Font(10.0f));
    m_typeLabel.setColour(juce::Label::textColourId, Cols::dim);
    addAndMakeVisible(m_typeLabel);

    m_typeCombo.addItem("Instrument", 1);
    m_typeCombo.addItem("Drum Bus",   2);
    m_typeCombo.addItem("Bus",        3);
    m_typeCombo.addItem("Send",       4);
    m_typeCombo.addItem("Master",     5);
    m_typeCombo.setSelectedId(1);
    m_typeCombo.setColour(juce::ComboBox::backgroundColourId, Cols::bg3);
    m_typeCombo.setColour(juce::ComboBox::outlineColourId,    Cols::bdr);
    m_typeCombo.setColour(juce::ComboBox::textColourId,       Cols::txt);
    addAndMakeVisible(m_typeCombo);

    // ── Routing label + combo ─────────────────────────────────────────
    // Fix: routing_channel param range is 0..64.
    // We use itemId = value + 1 (JUCE requires IDs >= 1).
    // ComboBoxAttachment will subtract 1 automatically to get param value.
    m_routingLabel.setText("Routing Ch", juce::dontSendNotification);
    m_routingLabel.setFont(juce::Font(10.0f));
    m_routingLabel.setColour(juce::Label::textColourId, Cols::dim);
    addAndMakeVisible(m_routingLabel);

    // Item IDs: 1 = param value 0 (Off/Auto), 2 = param value 1 (Ch 1), etc.
    m_routingCombo.addItem("Auto", 1);
    for (int i = 1; i <= 64; ++i)
        m_routingCombo.addItem("Ch " + juce::String(i), i + 1);
    m_routingCombo.setColour(juce::ComboBox::backgroundColourId, Cols::bg3);
    m_routingCombo.setColour(juce::ComboBox::outlineColourId,    Cols::bdr);
    m_routingCombo.setColour(juce::ComboBox::textColourId,       Cols::txt);
    addAndMakeVisible(m_routingCombo);

    // ── Order slider ──────────────────────────────────────────────────
    m_orderLabel.setText("Order", juce::dontSendNotification);
    m_orderLabel.setFont(juce::Font(10.0f));
    m_orderLabel.setColour(juce::Label::textColourId, Cols::dim);
    addAndMakeVisible(m_orderLabel);

    m_orderSlider.setRange(0, 99, 1);
    m_orderSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    m_orderSlider.setTextBoxStyle(juce::Slider::TextBoxRight, false, 28, 16);
    m_orderSlider.setColour(juce::Slider::thumbColourId,  Cols::acc);
    m_orderSlider.setColour(juce::Slider::trackColourId,  Cols::acc.withAlpha(0.4f));
    m_orderSlider.setColour(juce::Slider::textBoxTextColourId, Cols::txt);
    m_orderSlider.setColour(juce::Slider::textBoxBackgroundColourId, Cols::bg3);
    addAndMakeVisible(m_orderSlider);

    // APVTS attachments
    m_typeAttach    = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(
        m_processor.apvts, "channelType", m_typeCombo);
    m_routingAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(
        m_processor.apvts, "routing_channel", m_routingCombo);
    m_orderAttach   = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        m_processor.apvts, "order", m_orderSlider);

    // ── Metrics display labels ────────────────────────────────────────
    m_lufsLabel.setText(juce::String::fromUTF8("-\xE2\x88\x9E LUFS"), juce::dontSendNotification);
    m_lufsLabel.setFont(juce::Font(juce::Font::getDefaultMonospacedFontName(), 11.0f, 0));
    m_lufsLabel.setColour(juce::Label::textColourId, Cols::acc);
    m_lufsLabel.setJustificationType(juce::Justification::centredLeft);
    addAndMakeVisible(m_lufsLabel);

    m_srBpmLabel.setText("48kHz  120 BPM", juce::dontSendNotification);
    m_srBpmLabel.setFont(juce::Font(9.0f));
    m_srBpmLabel.setColour(juce::Label::textColourId, Cols::dim);
    m_srBpmLabel.setJustificationType(juce::Justification::centredRight);
    addAndMakeVisible(m_srBpmLabel);

    // ── Status bar ────────────────────────────────────────────────────
    m_connectionLabel.setText(juce::String::fromUTF8("\xE2\x97\x8B Waiting for app..."), juce::dontSendNotification);
    m_connectionLabel.setFont(juce::Font(9.0f));
    m_connectionLabel.setColour(juce::Label::textColourId, Cols::dim);
    addAndMakeVisible(m_connectionLabel);

    startTimerHz(30);
}

MixMindBridgeEditor::~MixMindBridgeEditor()
{
    stopTimer();
}

// ── Layout ────────────────────────────────────────────────────────────────
void MixMindBridgeEditor::resized()
{
    auto area = getLocalBounds();
    const int pad = 10;

    // ── Status bar — fixed at very bottom (24px)
    auto statusArea = area.removeFromBottom(24);
    statusArea.reduce(pad, 0);
    m_connectionLabel.setBounds(statusArea);

    // Working area with side padding
    area.reduce(pad, 0);

    // ── Header (32px tall) ────────────────────────────────────────────
    auto header = area.removeFromTop(32);
    m_logoLabel.setBounds(header.removeFromLeft(160));
    m_statusDot.setBounds(header);

    // ── VU Meters row (36px) — below header, above controls ──────────
    // Reserve the right side for VU meters: two 22px bars + labels
    // We store the VU rect for paint() to use
    area.removeFromTop(4);
    auto vuRow = area.removeFromTop(36);

    // Left portion of vuRow: metrics text (LUFS + SR/BPM)
    auto metricsLeft = vuRow.removeFromLeft(110);
    m_lufsLabel.setBounds(metricsLeft.removeFromTop(20));
    m_srBpmLabel.setBounds(metricsLeft);

    // Right portion of vuRow: VU meter bars (drawn in paint())
    m_vuArea = vuRow; // Store for paint()

    // ── Name field (38px) ─────────────────────────────────────────────
    area.removeFromTop(4);
    auto nameArea = area.removeFromTop(38);
    m_nameLabel.setBounds(nameArea.removeFromTop(14));
    m_nameEditor.setBounds(nameArea);

    // ── Type row (left half) + Routing row (right half) — 38px ───────
    area.removeFromTop(6);
    auto twoColRow = area.removeFromTop(38);
    int halfW = (twoColRow.getWidth() - 8) / 2;

    // Left column: Type
    auto typeCol = twoColRow.removeFromLeft(halfW);
    m_typeLabel.setBounds(typeCol.removeFromTop(14));
    m_typeCombo.setBounds(typeCol);

    twoColRow.removeFromLeft(8); // gap

    // Right column: Routing
    auto routingCol = twoColRow;
    m_routingLabel.setBounds(routingCol.removeFromTop(14));
    m_routingCombo.setBounds(routingCol);

    // ── Order row (38px) ──────────────────────────────────────────────
    area.removeFromTop(4);
    auto orderRow = area.removeFromTop(38);
    m_orderLabel.setBounds(orderRow.removeFromTop(14));
    m_orderSlider.setBounds(orderRow);
}

// ── Paint ─────────────────────────────────────────────────────────────────
void MixMindBridgeEditor::paint(juce::Graphics& g)
{
    // Background
    g.fillAll(Cols::bg0);

    // Header bar background
    g.setColour(Cols::bg1);
    g.fillRect(0, 0, getWidth(), 32);

    // Bottom status bar background
    g.setColour(Cols::bg1);
    g.fillRect(0, getHeight() - 24, getWidth(), 24);

    // Divider lines
    g.setColour(Cols::bg2);
    g.drawHorizontalLine(32, 0.f, (float)getWidth());
    g.drawHorizontalLine(getHeight() - 24, 0.f, (float)getWidth());

    // ── VU Meters ────────────────────────────────────────────────────
    if (!m_vuArea.isEmpty())
    {
        float rmsL = m_processor.currentRmsL.load(std::memory_order_relaxed);
        float rmsR = m_processor.currentRmsR.load(std::memory_order_relaxed);

        // Two side-by-side VU bars inside m_vuArea
        int vuW = 18;
        int vuGap = 4;
        int totalVu = vuW * 2 + vuGap;

        int vuX = m_vuArea.getRight() - totalVu;
        int vuY = m_vuArea.getY();
        int vuH = m_vuArea.getHeight() - 10; // leave room for L/R labels

        auto vuL = juce::Rectangle<int>(vuX, vuY, vuW, vuH);
        auto vuR = juce::Rectangle<int>(vuX + vuW + vuGap, vuY, vuW, vuH);

        drawVuMeter(g, vuL, rmsL);
        drawVuMeter(g, vuR, rmsR);

        // L / R labels below meters
        g.setFont(8.0f);
        g.setColour(Cols::dim);
        g.drawText("L", juce::Rectangle<int>(vuX, vuY + vuH + 1, vuW, 9),
                   juce::Justification::centred, false);
        g.drawText("R", juce::Rectangle<int>(vuX + vuW + vuGap, vuY + vuH + 1, vuW, 9),
                   juce::Justification::centred, false);
    }
}

void MixMindBridgeEditor::drawVuMeter(
    juce::Graphics& g, juce::Rectangle<int> bounds, float dbValue)
{
    g.setColour(Cols::bg2);
    g.fillRect(bounds);
    g.setColour(Cols::bdr);
    g.drawRect(bounds, 1);

    // Fill level: -60dB = 0%, 0dB = 100%
    float pct = std::clamp((dbValue + 60.0f) / 60.0f, 0.0f, 1.0f);
    int fillH  = (int)(bounds.getHeight() * pct);

    juce::Colour barCol = dbValue > -6.0f  ? juce::Colour(0xFFE05252)
                        : dbValue > -18.0f ? juce::Colour(0xFFE0A050)
                        : Cols::acc;

    g.setColour(barCol);
    g.fillRect(bounds.withTop(bounds.getBottom() - fillH));
}

// ── Timer callback (30Hz) ─────────────────────────────────────────────────
void MixMindBridgeEditor::timerCallback()
{
    // Update LUFS display
    float lufs = m_processor.currentLufsM.load(std::memory_order_relaxed);
    if (lufs < -99.0f)
        m_lufsLabel.setText(juce::String::fromUTF8("-\xE2\x88\x9E LUFS"), juce::dontSendNotification);
    else
        m_lufsLabel.setText(juce::String(lufs, 1) + " LUFS", juce::dontSendNotification);

    // Update SR/BPM — read from processor via shared memory (best-effort)
    // Values are stored in the slot but not cached in processor; skip for now.

    // Update connection status dot
    bool connected = m_processor.isConnected.load(std::memory_order_relaxed);
    m_statusDot.setColour(juce::Label::textColourId,
                          connected ? Cols::acc : Cols::dim);

    int slot = m_processor.slotIndex.load(std::memory_order_relaxed);
    if (connected)
        m_connectionLabel.setText(
            juce::String::fromUTF8("\xE2\x97\x8F Connected  \xE2\x80\xA2  Slot ") +
            juce::String(slot + 1) + "/64",
            juce::dontSendNotification);
    else
        m_connectionLabel.setText(juce::String::fromUTF8("\xE2\x97\x8B Waiting for app..."),
                                  juce::dontSendNotification);

    repaint();
}

juce::String MixMindBridgeEditor::getChannelName() const
{
    juce::String name = m_nameEditor.getText();
    return name.isNotEmpty() ? name : "Channel";
}
