cmake_minimum_required(VERSION 3.22)
project(MixMindBridge VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─── JUCE ───────────────────────────────────────────────────
# Use the local JUCE 8 extracted to the Desktop
set(JUCE_PATH "C:/Users/vlady/Desktop/JUCE")
add_subdirectory(${JUCE_PATH} juce_build)

# ─── Plugin Target ──────────────────────────────────────────
juce_add_plugin(MixMindBridge
    COMPANY_NAME            "MixMind"
    PLUGIN_MANUFACTURER_CODE "MMND"
    PLUGIN_CODE             "MMBR"
    FORMATS                 VST3 AU Standalone
    PRODUCT_NAME            "MixMind Bridge"
    NEEDS_MIDI_INPUT        FALSE
    NEEDS_MIDI_OUTPUT       FALSE
    IS_MIDI_EFFECT          FALSE
    IS_SYNTH                FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES         "Fx" "Analyzer"
    AU_MAIN_TYPE            "kAudioUnitType_Effect"
    DESCRIPTION             "MixMind Bridge — Routes audio metrics to shared memory"
)

juce_generate_juce_header(MixMindBridge)

# ─── Sources ────────────────────────────────────────────────
target_sources(MixMindBridge PRIVATE
    PluginProcessor.cpp
    PluginEditor.cpp
    SharedMemoryWriter.cpp
)

# ─── Include dirs ───────────────────────────────────────────
target_include_directories(MixMindBridge PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../shared
)

# ─── JUCE modules ───────────────────────────────────────────
target_compile_definitions(MixMindBridge PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
)

target_link_libraries(MixMindBridge PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_plugin_client
    juce::juce_dsp
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
    target_link_libraries(MixMindBridge PRIVATE "-framework CoreAudio")
    message(STATUS "Platform: macOS — using POSIX shm_open")
else()
    # Linux: POSIX shm_open + rt
    target_link_libraries(MixMindBridge PRIVATE rt)
    message(STATUS "Platform: Linux — using POSIX shm_open + rt")
endif()
