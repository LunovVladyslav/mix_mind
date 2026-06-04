cmake_minimum_required(VERSION 3.22)
project(MixMindMultiFX VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─── JUCE ───────────────────────────────────────────────────
# Use the local JUCE 8 extracted to the Desktop
set(JUCE_PATH "C:/Users/vlady/Desktop/JUCE")
add_subdirectory(${JUCE_PATH} juce_build)

# Add PGM module (Removed)
# juce_add_module(modules/foleys_gui_magic/modules/foleys_gui_magic)

# ─── Plugin Target ──────────────────────────────────────────
juce_add_plugin(MixMindMultiFX
    COMPANY_NAME            "MixMind"
    PLUGIN_MANUFACTURER_CODE "MMND"
    PLUGIN_CODE             "MMFX"
    FORMATS                 VST3 AU Standalone
    PRODUCT_NAME            "MixMind MultiFX"
    NEEDS_MIDI_INPUT        FALSE
    NEEDS_MIDI_OUTPUT       FALSE
    IS_MIDI_EFFECT          FALSE
    IS_SYNTH                FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES         "Fx" "EQ" "Dynamics" "Analyzer"
    AU_MAIN_TYPE            "kAudioUnitType_Effect"
    DESCRIPTION             "MixMind MultiFX — AI Controllable Multi-Effect"
)

juce_generate_juce_header(MixMindMultiFX)

# ─── Sources ────────────────────────────────────────────────
target_sources(MixMindMultiFX PRIVATE
    PluginProcessor.cpp
    PluginEditor.cpp
    SharedMemoryWriter.cpp
)

# ─── Include dirs ───────────────────────────────────────────
target_include_directories(MixMindMultiFX PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../shared
)

# ─── JUCE modules ───────────────────────────────────────────
target_compile_definitions(MixMindMultiFX PUBLIC
    JUCE_WEB_BROWSER=1
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
)

target_link_libraries(MixMindMultiFX PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_plugin_client
    juce::juce_dsp
    juce::juce_osc
    juce::juce_gui_extra
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

# ─── Platform-specific shared memory linking ─────────────────
if(WIN32)
    # Windows: CreateFileMapping / OpenFileMapping (no extra libs needed)
    message(STATUS "Platform: Windows — using Win32 shared memory API")
elseif(APPLE)
    # macOS: POSIX shm_open
    target_link_libraries(MixMindMultiFX PRIVATE "-framework CoreAudio")
    message(STATUS "Platform: macOS — using POSIX shm_open")
else()
    # Linux: POSIX shm_open + rt
    target_link_libraries(MixMindMultiFX PRIVATE rt)
    message(STATUS "Platform: Linux — using POSIX shm_open + rt")
endif()
