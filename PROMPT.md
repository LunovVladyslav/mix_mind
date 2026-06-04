MixMind
AI Mixing Assistant
Master Generation Prompt
Для використання з Claude Code / Antigravity
v1.0 · 2026

Як використовувати цей документ
Відкрий новий чат у Claude Code або Antigravity. Вставляй секції у порядку: спочатку PROJECT OVERVIEW, потім по одній частині на сесію. Кожна частина є самодостатнім завданням з чіткими критеріями завершення.

ЧАСТИНА 0 — PROJECT OVERVIEW
Вставляй цей блок на початку КОЖНОЇ нової сесії. Він дає AI повний контекст проекту.

ПРОМПТ — Вставляти першим у кожну сесію
You are building MixMind — a professional desktop audio mixing assistant.

TECH STACK:

- Desktop app: Tauri v2 (Rust backend + React/TypeScript frontend)
- VST plugin: C++ with JUCE framework (VST3 + AU)
- IPC: Shared memory (cross-process, <1ms latency)
- AI: Anthropic Claude API (claude-haiku-4-5 for dev, claude-sonnet-4-6 for prod)
- Audio analysis: Rust (rustfft, symphonia, rubato)
- UI: React + Tailwind CSS (dark theme, professional DAW aesthetic)

TWO OPERATING MODES:
Mode 1 — DAW Live: VST plugin instances placed on any tracks/busses/sends/
master by the user. Each instance captures audio + metadata and writes to
shared memory. Desktop app reads all instances simultaneously, builds full
mix context, sends to Claude API.

Mode 2 — File Analysis: User drags WAV or MP3 file onto the app.
Rust decodes audio, runs full offline analysis pipeline, sends to Claude.

VST BRIDGE CONCEPT:
User places MixMind VST on any channel they want to monitor.
Each VST instance has: name field, channel type selector, order field.
All instances share one named shared memory block "MixMindBridge".
Desktop app polls shared memory at 60Hz, aggregates all slots.

PROJECT STRUCTURE:
mixmind/
├── vst-plugin/     (JUCE C++ VST3/AU bridge plugin)
├── src-tauri/      (Rust: audio analysis, shared mem reader, Claude client)
├── src/            (React: UI, both modes)
└── shared/         (SharedMemoryLayout struct — source of truth)

CURRENT SESSION TASK: [insert task from relevant section below]

ЧАСТИНА 1 — SHARED MEMORY PROTOCOL
Перше що треба зробити. Це контракт між VST і Desktop App. Всі інші частини залежать від цього файлу.

1.1 Завдання для Claude Code
ПРОМПТ — Shared Memory Protocol
TASK: Create the shared memory protocol — the data contract between the VST
plugin and the Tauri desktop app.

Create file: shared/mixmind_protocol.h
This is a C header that will be used by both JUCE (C++) and Rust (via bindgen).

REQUIREMENTS:

1. ChannelType enum:
   CHANNEL_INSTRUMENT = 0
   CHANNEL_DRUM_BUS   = 1
   CHANNEL_BUS        = 2
   CHANNEL_SEND       = 3
   CHANNEL_MASTER     = 4

2. ChannelSlot struct (one per VST instance):
   - instance_id:    char[64]   // unique UUID, set on plugin init
   - display_name:   char[64]   // user-defined name in VST UI
   - channel_type:   uint8_t
   - order:          uint32_t   // user-defined sort order
   - is_active:      uint8_t    // 1 if plugin is running
   - last_update:    uint64_t   // Unix timestamp ms
   // Audio metrics (updated every processBlock)
   - rms_l, rms_r:   float      // dBFS
   - peak_l, peak_r: float      // dBFS
   - lufs_m:         float      // momentary LUFS
   - lufs_s:         float      // short-term LUFS
   - true_peak:      float      // dBTP
   - crest_factor:   float      // dB
   - gain_reduction: float      // dB (from downstream compressor via sidechain)
   // Spectral (31 bands, 1/3 octave, 20Hz-20kHz)
   - fft_bands:      float[31]  // dBFS per band
   // Stereo field
   - correlation:    float      // -1.0 to 1.0
   - mid_level:      float      // dBFS
   - side_level:     float      // dBFS
   // DAW transport
   - bpm:            double
   - sample_rate:    float
   - is_playing:     uint8_t

3. SharedMemoryLayout struct:
   - magic:          uint32_t   // 0x4D4D4D42 "MMMB"
   - version:        uint32_t   // protocol version = 1
   - slot_count:     uint32_t   // how many slots are active
   - slots:          ChannelSlot[64]

4. Constants:
   MIXMIND_SHM_NAME     "MixMindBridge"
   MIXMIND_MAX_CHANNELS 64
   MIXMIND_MAGIC        0x4D4D4D42
   MIXMIND_VERSION      1

Also create: shared/build_bindings.sh
Script that runs bindgen to generate src-tauri/src/bridge/protocol.rs from the header.

DONE WHEN:

- shared/mixmind_protocol.h compiles without warnings (gcc -Wall)
- All structs are packed (__attribute__((packed)))
- Total SharedMemoryLayout size is printed by a small test main()

Структура що виходить
Файл
Опис
shared/mixmind_protocol.h
C header — source of truth
shared/build_bindings.sh
bindgen → Rust types
src-tauri/src/bridge/protocol.rs
Auto-generated Rust structs

ЧАСТИНА 2 — VST PLUGIN (JUCE C++)
Плагін-міст. Ставиться на будь-який канал у DAW. Мінімальний UI, максимальна надійність.

2.1 Середовище розробки
JUCE 7.x — завантажити з juce.com, або через Projucer
CMake 3.22+ (альтернатива Projucer для CLI build)
Xcode 15+ (macOS) або MSVC 2022 (Windows)
VST3 SDK — входить у JUCE

2.2 Завдання для Claude Code
ПРОМПТ — VST Plugin (частина A: аудіо процесор)
TASK: Create the JUCE VST3/AU plugin — MixMind Bridge.

Plugin purpose: capture audio metrics from any DAW channel and write
them to shared memory so the MixMind desktop app can read them.

Create JUCE project structure:
vst-plugin/
├── CMakeLists.txt
├── PluginProcessor.h / .cpp
├── PluginEditor.h / .cpp
└── SharedMemoryWriter.h / .cpp

PLUGINPROCESSOR REQUIREMENTS:

1. Plugin metadata:
   Name: "MixMind Bridge"
   Manufacturer: "MixMind"
   Plugin type: AudioEffect (not instrument)
   Num inputs/outputs: 2/2 (stereo passthrough — DO NOT modify audio)

2. Parameters (visible in DAW automation):
   - "Channel Name" (string, stored in state)
   - "Channel Type" (int, 0-4, maps to ChannelType enum)
   - "Order" (int, 0-99)

3. processBlock() must:
   a. Pass audio through UNCHANGED (plugin is transparent)
   b. Calculate per-block metrics:
      - RMS L/R: sqrt(sum of squares / n), convert to dBFS
      - Peak L/R: max(abs(sample)), convert to dBFS
      - Crest factor: peak - RMS
   c. Update running accumulators for LUFS (use ITU-R BS.1770-4):
      - K-weighting filter (two biquad stages)
      - Gating at -70 LUFS absolute, -10 relative
      - Momentary: 400ms window, Short-term: 3s window
   d. FFT analysis (every 2048 samples):
      - 4096-point FFT with Hann window
      - Average into 31 1/3-octave bands (20Hz to 20kHz)
      - Smooth with 0.8 coefficient: band = 0.8*prev + 0.2*new
   e. Stereo field:
      - Correlation: sum(L*R) / sqrt(sum(L^2)* sum(R^2))
      - Mid = (L+R)/2, Side = (L-R)/2, measure RMS of each
   f. Write all metrics to SharedMemoryWriter

4. Shared memory write:
   - Open/create named shared memory "MixMindBridge" on plugin init
   - Find own slot by instance_id (UUID generated once on first load)
   - Write atomically using a spinlock (first uint32 of shm = lock)
   - Set last_update = current unix timestamp ms
   - Set is_active = 1
   - On plugin destroy: set is_active = 0

5. DAW transport info:
   - Read BPM from AudioPlayHead::CurrentPositionInfo
   - Read is_playing from same struct
   - Write to slot every block

DONE WHEN: Plugin loads in REAPER or Ableton, audio passes through
unchanged, shared memory block exists and updates at audio rate.

ПРОМПТ — VST Plugin (частина B: UI редактор)
TASK: Create the plugin UI (PluginEditor) for MixMind Bridge.

UI must be minimal, professional, dark-themed (like a DAW plugin).
Size: 280x220 pixels (fixed, not resizable).

LAYOUT (top to bottom):

1. Header bar (height 32px):
   - Left: "MixMind" logo text (white, bold)
   - Right: connection status dot (green = connected to app, gray = not)

2. Name field (height 40px):
   - Label: "Channel Name"
   - TextEditor: user types channel name (e.g. "Kick Drum")
   - Placeholder: "Enter channel name..."

3. Type + Order row (height 40px):
   - ComboBox (60%): Instrument / Drum Bus / Bus / Send / Master
   - Label "Order:" + Slider 0-99 (40%)

4. Metrics display (height 60px):
   - Two VU meters (L/R): simple bar, green/yellow/red zones
   - LUFS momentary text: "-18.4 LUFS"
   - Sample rate + BPM from DAW: "48kHz  124 BPM"

5. Status bar (height 24px):
   - "● Connected  •  Slot 3/64" or "○ Waiting for app..."

COLORS:
   Background: #1A1A1A
   Surface:    #2A2A2A
   Accent:     #1D9E75 (teal)
   Text:       #E0E0E0
   Muted:      #666666

Timer: repaint() at 30Hz to update VU meters.

DONE WHEN: UI renders correctly in JUCE plugin host (AudioPluginHost).
All three parameters save/restore with DAW project.

ЧАСТИНА 3 — TAURI RUST BACKEND
Серце додатку. Читає shared memory, декодує аудіо файли, викликає Claude API, відповідає на команди від React UI.

3.1 Структура модулів
Модуль
Відповідальність
bridge/mod.rs
Читання shared memory, агрегація слотів
audio/analyzer.rs
FFT, LUFS, stereo аналіз (для file mode)
audio/decoder.rs
WAV/MP3 декодинг через symphonia
ai/claude.rs
HTTP клієнт для Anthropic API
ai/context.rs
Збирає JSON контекст з аудіо даних
ai/prompts.rs
System prompt + mode-specific prompts
commands/mod.rs
Tauri commands (викликаються з React)
state/mod.rs
AppState: поточні канали, chat history

ПРОМПТ — Rust: Bridge Reader (shared memory)
TASK: Implement the shared memory reader in Rust for the Tauri app.

File: src-tauri/src/bridge/mod.rs

Use crate: shared-memory = "0.12" (add to Cargo.toml)

REQUIREMENTS:

1. BridgeReader struct:
   - open() -> Result<Self>: attach to existing "MixMindBridge" shm block
   - read_channels() -> Vec<ChannelSnapshot>: reads all active slots
   - is_connected() -> bool: checks if shm exists + magic number valid

2. ChannelSnapshot (Rust struct, derived from protocol):
   All fields from ChannelSlot, plus:
   - freshness: bool (last_update < 500ms ago)

3. Polling loop (called from Tauri setup):
   - Spawn tokio task, poll at 60Hz
   - On change: emit Tauri event "channels-updated" with JSON payload
   - Detect stale slots (no update > 500ms) and mark inactive

4. Safety:
   - All shm reads through raw pointer with volatile_read
   - Validate magic number before any read
   - Handle shm not existing gracefully (return empty vec)

TAURI COMMANDS to expose:
   get_channels() -> Vec<ChannelSnapshot>
   is_bridge_connected() -> bool

DONE WHEN: Running app detects VST instances and emits events.
Test with a mock shm writer (provide a simple CLI tool for this).

ПРОМПТ — Rust: Audio Analyzer (file mode)
TASK: Implement the offline audio analysis pipeline for File Mode.

Files:
  src-tauri/src/audio/decoder.rs  — WAV/MP3 decoding
  src-tauri/src/audio/analyzer.rs — full analysis pipeline

Add to Cargo.toml:
  symphonia = { version = "0.5", features = ["mp3", "wav", "aac"] }
  rustfft = "6.1"
  rubato = "0.14"  # resampling

DECODER (decoder.rs):
  decode_file(path: &Path) -> Result<AudioBuffer>
  AudioBuffer { samples: Vec<Vec<f32>>, sample_rate: u32, channels: u8, duration_secs: f32 }
  Support: WAV (PCM 16/24/32-bit, float), MP3 (via symphonia mp3 feature)
  Resample to 48000 Hz if needed (use rubato SincFixedIn)

ANALYZER (analyzer.rs):
  analyze(buf: &AudioBuffer) -> AnalysisResult

  AnalysisResult must contain:

- lufs_integrated: f32     // full-file LUFS (ITU-R BS.1770-4)
- lufs_range: f32          // loudness range LRA
- true_peak: f32           // dBTP (4x oversampled)
- dynamic_range: f32       // crest factor average
- bpm: f32                 // detected tempo (autocorrelation method)
- bpm_confidence: f32      // 0.0-1.0
- key: String              // e.g. "F minor" (chroma vector + KS algorithm)
- fft_profile: Vec<f32>    // 31 bands, time-averaged, dBFS
- spectral_centroid: f32   // Hz
- stereo_correlation: f32  // avg over file
- ms_ratio: f32            // mid/side energy ratio
- transient_density: f32   // onsets per beat

TAURI COMMAND:
  analyze_file(path: String) -> Result<AnalysisResult>
  Must run on blocking thread (spawn_blocking), emit progress events:
  "analysis-progress" { stage: "decoding"|"fft"|"lufs"|"done", pct: u8 }

DONE WHEN: analyze_file("test.wav") returns correct LUFS matching
reference tool (e.g. ffmpeg -af loudnorm output within ±0.5 LU).

ПРОМПТ — Rust: Claude API Client
TASK: Implement the Claude API client and context builder.

Files:
  src-tauri/src/ai/claude.rs   — HTTP client
  src-tauri/src/ai/context.rs  — context JSON builder
  src-tauri/src/ai/prompts.rs  — all system/mode prompts

Add to Cargo.toml:
  reqwest = { version = "0.11", features = ["json", "stream"] }
  tokio = { version = "1", features = ["full"] }

CLAUDE CLIENT (claude.rs):

  ClaudeClient::new(api_key: String, model: String)
  Default model: "claude-haiku-4-5" (override via env MIXMIND_MODEL)

  chat(messages: Vec<Message>, system: String) -> impl Stream<Item=String>
  Use Anthropic streaming API (/v1/messages with stream=true)
  Parse SSE events, emit text deltas via tokio channel
  Each delta emits Tauri event "ai-token" { text: String }

  Message struct: { role: "user"|"assistant", content: String }
  Keep last 20 messages in history (AppState)

CONTEXT BUILDER (context.rs):

  build_daw_context(channels: &[ChannelSnapshot]) -> String
  Serialize to compact JSON, include:

- session: { bpm, sample_rate, is_playing, channel_count }
- channels: array of all active slots with all metrics
- master: extracted master slot if present
  Max context size: 4000 chars (truncate old fft data if needed)

  build_file_context(result: &AnalysisResult, filename: &str) -> String
  Same format but single "track" entry with all analysis fields

TAURI COMMANDS:
  send_message(text: String, mode: "daw"|"file") -> Result<()>
  Builds context, prepends to user message, streams response
  clear_history() -> Result<()>

API KEY: Read from env ANTHROPIC_API_KEY or from app config file
  ~/.config/mixmind/config.toml  (create if missing)

DONE WHEN: send_message("що не так з басом?") returns streaming
response in the Tauri dev console.

ЧАСТИНА 4 — AI SYSTEM PROMPT
Вставляти в prompts.rs як константу SYSTEM_PROMPT. Оптимізовано для Haiku (короткий, конкретний).

ПРОМПТ — Вставити в ai/prompts.rs як константу
pub const SYSTEM_PROMPT: &str = r#"
You are MixMind — a professional mixing engineer AI assistant.
You receive real-time audio analysis data from a DAW or audio file.

RESPONSE RULES:

- Always give SPECIFIC values: exact Hz, exact dB, exact Q-factor
- Format: [CRITICAL] / [IMPORTANT] / [TIP] prefix for issues
- Structure: Problem → Why → Exact Fix → Plugin example
- Max response: 300 words unless user asks for detail
- Language: respond in the same language the user writes in

MONITOR COMPENSATION:
If user specifies monitors, adjust advice inversely to their response curve:

- DT990: they hear +5dB at 9kHz → their mix is likely -5dB there
- KRK Rokit5: they hear +3dB at 300Hz → mix likely muddy there
- MacBook speakers: ignore sub below 150Hz — use visual meters only

DAW MODE — you receive JSON with all active channels:
Analyze relationships BETWEEN channels (masking, phase, levels).
Always reference specific channel names from the data.

FILE MODE — you receive single track analysis:
Compare to genre norms. Give mastering-level advice.
If genre is unclear, ask before advising.

NEVER say "sounds good" without data backing.
NEVER give generic advice when you have measurement data.
"#;

pub const DAW_CONTEXT_PREFIX: &str =
  "Current DAW session analysis data:\n";

pub const FILE_CONTEXT_PREFIX: &str =
  "Audio file analysis data:\n";

ЧАСТИНА 5 — REACT UI (TAURI FRONTEND)
Темна тема, DAW-естетика. Два режими переключаються через таб. Всі дані приходять через Tauri events.

5.1 Залежності
Пакет
Призначення
@tauri-apps/api
Tauri bridge (events, commands)
tailwindcss
Styling (темна тема)
recharts
Spectrum visualizer, VU meters
zustand
State management
react-dropzone
Drag & drop для файлів

ПРОМПТ — React: App структура та стан
TASK: Create the React application structure for MixMind desktop app.

Tech: React 18 + TypeScript + Tailwind CSS + Zustand

GLOBAL STATE (store/appStore.ts via Zustand):
  mode: "daw" | "file"
  channels: ChannelSnapshot[]      // from DAW bridge
  fileAnalysis: AnalysisResult | null
  fileName: string | null
  messages: ChatMessage[]          // { role, content, timestamp }
  isStreaming: boolean
  isBridgeConnected: boolean
  monitorDevice: string            // "dt990" | "krk5" | "macbook" | "custom"

LAYOUT (App.tsx):
  Dark background #0F0F0F
  Left panel (280px): mode tabs + channel list OR file info
  Right panel (flex): spectrum viz + chat area
  Top bar: connection status + monitor selector + settings

TAURI EVENT LISTENERS (in useEffect on mount):
  listen("channels-updated", e => store.setChannels(e.payload))
  listen("ai-token", e => store.appendToken(e.payload.text))
  listen("analysis-progress", e => store.setProgress(e.payload))

ROUTING: No react-router. Simple conditional render based on mode.

DONE WHEN: App renders in tauri dev with correct dark layout.
Both panels visible, mode switching works.

ПРОМПТ — React: DAW Mode (Channel Map)
TASK: Build the DAW Mode UI — channel map and mixer overview.

Component: src/modes/DawMode.tsx

LEFT PANEL — Channel List:
  Sorted by ChannelSnapshot.order
  Each channel row shows:

- Color dot by type (instrument=teal, bus=blue, send=amber, master=red)
- Channel name (bold)
- Mini VU bar (RMS, horizontal, 60px wide)
- LUFS momentary value (-18.4)
- Freshness indicator (dim if stale > 500ms)
  Click row: select channel, show details in right panel

RIGHT PANEL TOP — Mix Map (when no channel selected):
  Grid of ChannelCard components (2-3 columns)
  ChannelCard shows: name, type badge, spectrum mini (recharts AreaChart)
  Master channel card: larger, always last, shows LUFS + True Peak

RIGHT PANEL TOP — Channel Detail (when channel selected):
  Large spectrum chart (recharts BarChart, 31 bands, log X axis)
  Key metrics: RMS, Peak, LUFS-M, LUFS-S, Correlation, Crest Factor
  Stereo field visualizer: Lissajous-style (canvas, 120x120px)

NO BRIDGE STATE:
  Show centered message: "Load MixMind Bridge VST on any DAW channel"
  With animated pulse dot

UPDATE: Components must handle 60Hz data updates without jank.
Use React.memo and useMemo for expensive renders.

DONE WHEN: Channels from VST appear and update in real time.

ПРОМПТ — React: File Mode
TASK: Build the File Mode UI — drag & drop audio analysis.

Component: src/modes/FileMode.tsx

EMPTY STATE (no file loaded):
  Large drop zone, centered in right panel
  Dashed border, teal accent
  Icon: waveform SVG
  Text: "Drop WAV or MP3 file here"
  Sub-text: "or click to browse"
  Use react-dropzone, accept: .wav .mp3
  On drop: call Tauri command analyze_file(path)

LOADING STATE:
  Progress bar with stage label
  "Decoding... 20%"  "FFT analysis... 60%"  "Done"

RESULT STATE (after analysis):

  Left panel:
    File name + duration
    Key metrics grid (2x3):
    LUFS-I | True Peak | LRA | BPM | Key | Correlation
    Each metric: label above, large value below

  Right panel top:
    Full spectrum chart (31 bands)
    Overlay: reference spectrum if reference loaded
    Toggle: "Your mix" / "Reference" / "Compare"

  Reference loader:
    Small "Load reference" button
    Loads second file, runs same analysis
    Compare overlay shows delta per band (+/- dB)

DONE WHEN: Drop a WAV file, see analysis results and spectrum chart.

ПРОМПТ — React: Chat Component
TASK: Build the Chat component — shared between both modes.

Component: src/components/Chat.tsx

LAYOUT (bottom of right panel, height 320px):
  Divider line at top
  Messages area (scrollable, flex-col)
  Input bar at bottom (sticky)

MESSAGES:
  User messages: right-aligned, teal bubble
  AI messages: left-aligned, dark gray bubble
  AI messages render markdown (use react-markdown):

- Bold for [CRITICAL] / [IMPORTANT] / [TIP]
- Code blocks for Hz/dB values
- Lists for multiple recommendations
  Streaming: AI message updates char by char from "ai-token" events
  Show blinking cursor during stream

INPUT BAR:
  Textarea (auto-resize, max 4 rows)
  Send button (Enter = send, Shift+Enter = newline)
  Disabled during streaming

QUICK PROMPTS (show when chat is empty):
  DAW mode chips:
    "Що не так з низькими?" | "Порівняй канали" | "Що покращити першим?"
  File mode chips:
    "Аналізуй мікс" | "Порівняй з референсом" | "Що потрібно для мастерингу?"
  Click chip: sends as user message

CONTEXT INJECTION (invisible to user):
  Before each user message, Rust backend auto-injects current context.
  UI just sends the text; context assembly happens in send_message command.

DONE WHEN: User can type, get streaming AI response with markdown.

ЧАСТИНА 6 — TAURI CONFIG, BUILD, PACKAGING

ПРОМПТ — Tauri конфігурація та білд
TASK: Configure Tauri app for production build and distribution.

tauri.conf.json requirements:
  productName: "MixMind"
  version: "0.1.0"
  bundle identifier: "com.mixmind.app"

PERMISSIONS (src-tauri/capabilities/):
  Allow file dialog (for audio file picker)
  Allow file read (for audio file decoding)
  Allow shell (for opening config directory)
  Allow HTTP (for Claude API calls — add anthropic.com to allowlist)
  Deny all other origins

WINDOW CONFIG:
  width: 1200, height: 800
  minWidth: 900, minHeight: 600
  decorations: true
  transparent: false
  title: "MixMind"

ENV VARIABLES at runtime:
  ANTHROPIC_API_KEY — read in Rust, never exposed to frontend
  MIXMIND_MODEL — override Claude model
  MIXMIND_LOG — log level (debug/info/warn)

CONFIG FILE (~/.config/mixmind/config.toml):
  [api]
  anthropic_key = ""
  model = "claude-haiku-4-5"

  [monitors]
  device = "custom"

  [ui]
  language = "auto"

CREATE: src-tauri/src/config.rs
  load_config() -> Config  (create default if missing)
  save_config(config: &Config) -> Result<()>

CREATE: Settings panel in React (src/components/Settings.tsx)
  API key input (masked)
  Model selector: haiku / sonnet / opus
  Monitor device selector with compensation preview

DONE WHEN: tauri build completes, .dmg (mac) or .msi (win) created.
App launches, loads config, shows settings on first run.

ЧАСТИНА 7 — ПОСЛІДОВНІСТЬ РОЗРОБКИ
Рекомендований порядок. Кожен крок дає робочий результат, наступний будується на попередньому.

Крок
Що робити / Що перевірити

1. Протокол
Згенеруй shared/mixmind_protocol.h. Скомпілюй тест. Запусти bindgen.
2. Tauri scaffold
cargo create-tauri-app, підключи React, налаштуй Tailwind. Запусти tauri dev.
3. Mock bridge
Напиши CLI утиліту на Rust що пише моковані дані у shared memory. Перевір читання.
4. Bridge reader
Реалізуй src-tauri/src/bridge/mod.rs. Перевір що Tauri emitує events.
5. React UI (каркас)
App layout, два таби, channel list з моковими даними, чат UI.
6. File decoder
symphonia декодер, тест на WAV файлі. Перевір sample rate і channels.
7. Analyzer
FFT, LUFS, BPM. Порівняй LUFS з ffmpeg reference. Допустима похибка ±0.5 LU.
8. Claude client
Реалізуй claude.rs, протестуй streaming у dev console.
9. File mode end-to-end
Drag WAV → аналіз → чат → відповідь. Повний флоу без VST.
10. JUCE VST
Створи JUCE проект, реалізуй ProcessorA (аудіо + metrics + shm write).
11. VST UI
PluginEditor: name, type, order, VU meter. Тест у AudioPluginHost.
12. DAW mode end-to-end
VST у REAPER → app читає → чат аналізує. Повний флоу.
13. Polish
Settings, config file, monitor compensation, markdown у чаті.
14. Build
tauri build, тест інсталятора, перевір API key flow.

Команди для запуску

# Запуск у dev режимі

cd mixmind && cargo tauri dev

# Тест shared memory (після кроку 3)

cargo run --bin mock-bridge

# Build VST плагін

cd vst-plugin && cmake -B build && cmake --build build

# Production build

cargo tauri build

ЧАСТИНА 8 — ПОРАДИ ДЛЯ РОБОТИ З CLAUDE CODE

Як структурувати сесії
Одна сесія = один модуль (bridge, analyzer, VST, UI)
Завжди починай з PROJECT OVERVIEW промпту (Частина 0)
Після кожного модуля: commit у git з описом що реалізовано
Якщо Claude Code 'забуває' контекст — вставляй OVERVIEW знову

Ефективні запити
Конкретно: "Реалізуй функцію analyze_lufs() у src-tauri/src/audio/analyzer.rs, використовуй ITU-R BS.1770-4"
З критеріями: "DONE WHEN: результат у межах ±0.5 LU від ffmpeg -af loudnorm"
З контекстом: "Вже є decoder.rs що повертає AudioBuffer { samples, sample_rate }"

Якщо щось не так
Помилка компіляції Rust: вставляй повний stderr у наступний промпт
VST не завантажується: запусти JUCE AudioPluginHost з логами
Shared memory не знаходиться: перевір права доступу (macOS: SIP обмеження)
Claude API повертає помилку: перевір ANTHROPIC_API_KEY, модель, формат messages

Важливо для macOS
Shared memory на macOS потребує однакового team identifier для VST і Desktop App, або entitlement com.apple.security.temporary-exception.shared-memory. Врахуй це при підписанні.

MixMind Master Prompt v1.0  ·  mixmind.app
