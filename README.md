# MixMind — AI Mixing Assistant

Professional desktop AI mixing assistant with real-time DAW analysis.

## Quick Start

### 1. Set your API key
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."
```

### 2. Run in development mode
```powershell
cargo tauri dev
```

### 3. Test without VST (mock bridge)
Open a second terminal:
```powershell
cd src-tauri
cargo run --bin mock-bridge
```

### 4. Build VST plugin
Requires CMake 3.22+ and MSVC 2022 (Windows):
```powershell
cd vst-plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```
The `.vst3` file will be in `vst-plugin/build/MixMindBridge_artefacts/Release/VST3/`

### 5. Production build
```powershell
cargo tauri build
```

## Project Structure

```
MixMind/
├── shared/                    # C header protocol (VST ↔ Desktop)
│   ├── mixmind_protocol.h     # Source of truth for shared memory layout
│   ├── build_bindings.sh      # Generates Rust bindings via bindgen
│   └── test_protocol.c        # Compile: gcc -Wall -o test test_protocol.c -lm
│
├── vst-plugin/                # JUCE C++ VST3/AU plugin
│   ├── CMakeLists.txt
│   ├── PluginProcessor.h/.cpp # Audio processing + metrics
│   ├── PluginEditor.h/.cpp    # 280×220px DAW UI
│   └── SharedMemoryWriter.h/.cpp
│
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── bridge/mod.rs      # 60Hz shared memory reader
│       ├── audio/decoder.rs   # WAV/MP3/AAC decoding (symphonia)
│       ├── audio/analyzer.rs  # LUFS, FFT, BPM, Key, True Peak
│       ├── ai/claude.rs       # Claude API SSE streaming
│       ├── ai/context.rs      # JSON context builder
│       ├── ai/prompts.rs      # System prompt + monitor compensation
│       ├── commands/mod.rs    # All Tauri commands
│       ├── config.rs          # ~/.config/mixmind/config.toml
│       ├── state/mod.rs       # App state
│       └── bin/mock_bridge.rs # Test tool (simulates VST data)
│
└── src/                       # React frontend
    ├── App.tsx                # Main layout + event listeners
    ├── store/appStore.ts      # Zustand state
    ├── modes/
    │   ├── DawMode.tsx        # Channel map, VU meters, spectrum
    │   └── FileMode.tsx       # Drag & drop analysis
    └── components/
        ├── Chat.tsx           # Streaming AI chat
        ├── Settings.tsx       # API key, model, monitors
        └── TopBar.tsx         # Status bar
```

## Configuration

Config file is created automatically at:
- **Windows**: `%APPDATA%\mixmind\config.toml`
- **macOS**: `~/Library/Application Support/mixmind/config.toml`

```toml
[api]
anthropic_key = "sk-ant-api03-..."
model = "claude-haiku-4-5"

[monitors]
device = "custom"  # custom | dt990 | krk5 | macbook | ath-m50 | ns10

[ui]
language = "auto"
```

## VST Plugin Setup

1. Build the plugin (see above)
2. Copy `MixMindBridge.vst3` to your VST3 folder:
   - **Windows**: `C:\Program Files\Common Files\VST3\`
   - **macOS**: `~/Library/Audio/Plug-Ins/VST3/`
3. Open DAW, scan for plugins
4. Place **MixMind Bridge** on any channel
5. Set channel name, type, and order in the plugin UI
6. Open the MixMind desktop app — it will auto-detect all instances

## macOS Note

Shared memory on macOS requires the same Team ID for VST and Desktop App,
or the entitlement `com.apple.security.temporary-exception.shared-memory`.
Add this to your signing configuration.
