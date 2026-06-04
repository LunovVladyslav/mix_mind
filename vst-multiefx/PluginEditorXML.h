#pragma once

const char* magicStateXML = R"(<?xml version="1.0" encoding="UTF-8"?>
<magic>
  <Styles>
    <Style name="default">
      <Nodes>
        <Node class="View" background-color="#14171C"/>
        <Node class="Meter" background-color="#000000" background-alpha="0.8"/>
        <Node class="Slider" lookAndFeel="FoleysFinest" slider-textbox="textboxBelow" text-color="#00E5FF"/>
        <Node class="Label" text-color="#E2E8F0" font-size="12.0" justification="centred"/>
        <Node class="ToggleButton" text-color="#00E5FF"/>
      </Nodes>
      <Classes>
        <!-- The glowing capsule meter style -->
        <Class name="meter-capsule" background-color="#090B0E" border="2.0" border-color="#00E5FF" margin="10.0" padding="10.0" radius="40.0"/>
        
        <!-- The slot icon style -->
        <Class name="slot-icon" border="2.0" border-color="#00E5FF" background-color="#050709" radius="12.0" slider-textbox="textboxOnly" font-size="14.0" text-color="#00E5FF" margin="5" flex-grow="1"/>
        
        <Class name="slot-label" font-size="10.0" text-color="#64748B" height="15" justification="centred"/>
        <Class name="header-text" font-size="20.0" text-color="#FFFFFF" font-style="bold"/>
      </Classes>
    </Style>
  </Styles>
  
  <View id="root" display="flexbox" flex-direction="column" width="850" height="400" padding="20" background-color="#101419">
    
    <!-- Top Bar -->
    <View flex-direction="row" height="30" margin="0" padding="0">
      <Label text="MASTERING SUITE" class="header-text" flex-grow="1" justification="left"/>
      <Label text="PRESET: CLEAN PUSH >" font-size="12" text-color="#00E5FF" flex-grow="1" justification="centred"/>
      <Label text="STEREO | LR" font-size="12" text-color="#64748B" flex-grow="1" justification="right" font-style="bold"/>
    </View>
    
    <!-- Main Center (Meter & Master Fader) -->
    <View flex-direction="row" flex-grow="1" margin="5" padding="0">
      
      <!-- Main Stereo Meter Capsule -->
      <View flex-grow="1" class="meter-capsule">
        <Meter source="meter" flex-grow="1" margin="5"/>
      </View>
      
      <!-- Output Rotary Knob -->
      <View width="120" flex-direction="column" margin="10" padding="10" justification="centred">
        <Slider parameter="out_gain" slider-type="rotary" flex-grow="1"/>
        <Label text="OUTPUT" font-size="11" text-color="#64748B" height="20" font-style="bold"/>
      </View>
    </View>
    
    <!-- 8 Slots (Status Indicators) -->
    <View flex-direction="row" height="90" margin="5" padding="0">
      
      <!-- Slot 1 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="1" class="slot-label"/>
        <!-- We use a textboxOnly slider bound to the choice parameter to act as a styled icon! -->
        <Slider parameter="slot1_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot1_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 2 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="2" class="slot-label"/>
        <Slider parameter="slot2_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot2_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 3 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="3" class="slot-label"/>
        <Slider parameter="slot3_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot3_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 4 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="4" class="slot-label"/>
        <Slider parameter="slot4_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot4_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 5 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="5" class="slot-label"/>
        <Slider parameter="slot5_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot5_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 6 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="6" class="slot-label"/>
        <Slider parameter="slot6_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot6_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 7 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="7" class="slot-label"/>
        <Slider parameter="slot7_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot7_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>
      
      <!-- Slot 8 -->
      <View flex-direction="column" flex-grow="1" margin="2">
        <Label text="8" class="slot-label"/>
        <Slider parameter="slot8_type" class="slot-icon" height="40"/>
        <ToggleButton parameter="slot8_bypass" text="ON" height="15" font-size="10" flex-grow="0"/>
      </View>

    </View>
    
  </View>
</magic>)";
