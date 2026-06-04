// MixMind — Global Zustand State Store

import { create } from "zustand";
import { useHistoryStore } from "./historyStore";

export interface ChannelSnapshot {
  instanceId:    string;
  displayName:   string;
  channelType:   number; // 0=instrument,1=drum_bus,2=bus,3=send,4=master
  order:         number;
  isActive:      boolean;
  lastUpdate:    number;
  rmsL:          number;
  rmsR:          number;
  peakL:         number;
  peakR:         number;
  lufsM:         number;
  lufsS:         number;
  truePeak:      number;
  crestFactor:   number;
  gainReduction: number;
  fftBands:      number[];
  correlation:   number;
  midLevel:      number;
  sideLevel:     number;
  bpm:           number;
  sampleRate:    number;
  isPlaying:     boolean;
  fresh:         boolean;
  /** OSC UDP port for MultiFX control (0 = Bridge plugin, no control) */
  oscPort:       number;
}

export interface AnalysisResult {
  lufsIntegrated:    number;  // lufs_integrated → lufsIntegrated
  lufsRange:         number;  // lufs_range → lufsRange (LRA)
  truePeak:          number;  // true_peak → truePeak (dBTP)
  dynamicRange:      number;  // dynamic_range → dynamicRange (crest factor)
  bpm:               number;
  bpmConfidence:     number;
  key:               string;
  fftProfile:        number[]; // fft_profile → fftProfile (31 bands)
  spectralCentroid:  number;
  stereoCorrelation: number;
  msRatio:           number;
  transientDensity:  number;
  durationSecs:      number;
  sampleRate:        number;
}

export interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
}

export interface AnalysisProgress {
  stage: "decoding" | "fft" | "lufs" | "done";
  pct:   number;
}

export type AppMode = "daw" | "file";
export type AiMode = "ask" | "agent";
export type MonitorDevice = "custom" | "dt990" | "krk5" | "macbook" | "ath-m50" | "ns10";

interface AppStore {
  // Mode
  mode:              AppMode;
  setMode:           (m: AppMode) => void;
  aiMode:            AiMode;
  setAiMode:         (m: AiMode) => void;

  // DAW mode
  channels:          ChannelSnapshot[];
  setChannels:       (ch: ChannelSnapshot[]) => void;
  selectedChannel:   string | null;
  setSelectedChannel:(id: string | null) => void;
  isBridgeConnected: boolean;
  setBridgeConnected:(v: boolean) => void;

  excludedChannels:  string[];
  toggleExcludedChannel: (id: string) => void;
  isCapturing:       boolean;
  setCapturing:      (v: boolean) => void;
  hasCachedProfile:  boolean;
  setHasCachedProfile: (v: boolean) => void;

  // File mode
  fileAnalysis:      AnalysisResult | null;
  setFileAnalysis:   (r: AnalysisResult | null) => void;
  fileName:          string | null;
  setFileName:       (n: string | null) => void;
  referenceAnalysis: AnalysisResult | null;
  setReferenceAnalysis:(r: AnalysisResult | null) => void;
  referenceName:     string | null;
  setReferenceName:  (n: string | null) => void;
  analysisProgress:  AnalysisProgress | null;
  setAnalysisProgress:(p: AnalysisProgress | null) => void;

  // Chat
  sessionTitle:   string | null;
  setSessionTitle: (t: string | null) => void;
  messages:          ChatMessage[];
  addUserMessage:    (text: string) => string;
  addAssistantMessage:(id: string, text: string) => void;
  appendToken:       (text: string) => void;
  clearMessages:     () => void;
  isStreaming:       boolean;
  setStreaming:      (v: boolean) => void;
  currentStreamId:   string | null;
  setStreamId:       (id: string | null) => void;

  // Settings
  monitorDevice:     MonitorDevice;
  setMonitorDevice:  (d: MonitorDevice) => void;
  showSettings:      boolean;
  setShowSettings:   (v: boolean) => void;
  model:             string;
  setModel:          (m: string) => void;
  hasApiKey:         boolean;
  setHasApiKey:      (v: boolean) => void;
  apiProvider:       string;
  setApiProvider:    (p: string) => void;
  openaiUrl:         string;
  setOpenaiUrl:      (u: string) => void;
  openaiKey:         string;
  setOpenaiKey:      (k: string) => void;
  customPluginPaths: string[];
  setCustomPluginPaths: (paths: string[]) => void;
  availablePlugins:  string[];
  setAvailablePlugins: (pl: string[]) => void;
  uiScale:           number;
  setUiScale:        (scale: number) => void;
  leftPanelWidth:    number;
  setLeftPanelWidth: (width: number) => void;
  isLeftPanelOpen:   boolean;
  setIsLeftPanelOpen:(v: boolean) => void;
  isChatOpen:        boolean;
  setIsChatOpen:     (v: boolean) => void;

  // Mix Style & Reference
  mixStyle:          string | null;   // e.g. "rock", "house", "trap" — null = auto-detect
  setMixStyle:       (s: string | null) => void;
  referenceTrack:    string;          // e.g. "Daft Punk — One More Time"
  setReferenceTrack: (t: string) => void;
}

let _msgId = 0;
const nextId = () => `msg-${++_msgId}-${Date.now()}`;

export const useAppStore = create<AppStore>((set) => ({
  // Mode
  mode:    "file",
  setMode: (mode) => set({ mode }),
  aiMode:  "agent",
  setAiMode: (aiMode) => set({ aiMode }),

  // DAW
  channels:           [],
  setChannels:        (channels) => set({ channels }),
  selectedChannel:    null,
  setSelectedChannel: (id) => set({ selectedChannel: id }),
  isBridgeConnected:  false,
  setBridgeConnected: (v) => set({ isBridgeConnected: v }),

  excludedChannels:   [],
  toggleExcludedChannel: (id) => set((s) => ({
    excludedChannels: s.excludedChannels.includes(id) 
      ? s.excludedChannels.filter(x => x !== id)
      : [...s.excludedChannels, id]
  })),
  isCapturing:        false,
  setCapturing:       (v) => set({ isCapturing: v }),
  hasCachedProfile:   false,
  setHasCachedProfile:(v) => set({ hasCachedProfile: v }),

  // File
  fileAnalysis:        null,
  setFileAnalysis:     (r) => set({ fileAnalysis: r }),
  fileName:            null,
  setFileName:         (n) => set({ fileName: n }),
  referenceAnalysis:   null,
  setReferenceAnalysis:(r) => set({ referenceAnalysis: r }),
  referenceName:       null,
  setReferenceName:    (n) => set({ referenceName: n }),
  analysisProgress:    null,
  setAnalysisProgress: (p) => set({ analysisProgress: p }),

  // Chat
  sessionTitle:   null,
  setSessionTitle:(t) => set({ sessionTitle: t }),
  messages:       [],
  isStreaming:    false,
  setStreaming:   (v) => set({ isStreaming: v }),
  currentStreamId: null,
  setStreamId:    (id) => set({ currentStreamId: id }),

  addUserMessage: (text) => {
    const id = nextId();
    const msg: ChatMessage = { id, role: "user", content: text, timestamp: Date.now() };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  addAssistantMessage: (id, text) => {
    const msg: ChatMessage = { id, role: "assistant", content: text, timestamp: Date.now() };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  appendToken: (text) => {
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + text,
        };
      }
      return { messages: msgs };
    });
  },

  clearMessages: () => {
    const state = set as any; // zustand get state from set is not direct here, let's use useAppStore.getState()
    const s = useAppStore.getState();
    if (s.messages.length > 0) {
      useHistoryStore.getState().saveSession({
        title: s.sessionTitle || (s.mode === "file" ? (s.fileName || "File Analysis") : "DAW Session"),
        mode: s.mode,
        messages: s.messages,
        filePath: s.fileName || undefined,
        fileAnalysis: s.fileAnalysis,
      });
    }
    set({ messages: [], sessionTitle: null });
  },

  // Settings
  monitorDevice:    "custom",
  setMonitorDevice: (d) => set({ monitorDevice: d }),
  showSettings:     false,
  setShowSettings:  (v) => set({ showSettings: v }),
  model:            "claude-haiku-4-5",
  setModel:         (m) => set({ model: m }),
  hasApiKey:        false,
  setHasApiKey:     (v) => set({ hasApiKey: v }),
  apiProvider:      "anthropic",
  setApiProvider:   (p) => set({ apiProvider: p }),
  openaiUrl:        "http://localhost:11434/v1",
  setOpenaiUrl:     (u) => set({ openaiUrl: u }),
  openaiKey:        "",
  setOpenaiKey:     (k) => set({ openaiKey: k }),
  customPluginPaths: [],
  setCustomPluginPaths: (paths) => set({ customPluginPaths: paths }),
  availablePlugins: [],
  setAvailablePlugins: (pl) => set({ availablePlugins: pl }),
  
  // UI Preferences
  uiScale: parseFloat(localStorage.getItem("mixmind-ui-scale") || "1.0"),
  setUiScale: (scale) => {
    localStorage.setItem("mixmind-ui-scale", scale.toString());
    set({ uiScale: scale });
  },
  
  leftPanelWidth: parseInt(localStorage.getItem("mixmind-panel-width") || "280", 10),
  setLeftPanelWidth: (width) => {
    localStorage.setItem("mixmind-panel-width", width.toString());
    set({ leftPanelWidth: width });
  },

  isLeftPanelOpen: true,
  setIsLeftPanelOpen: (v) => set({ isLeftPanelOpen: v }),
  
  isChatOpen: true,
  setIsChatOpen: (v) => set({ isChatOpen: v }),

  // Mix Style & Reference Track
  mixStyle:          null,
  setMixStyle:       (s) => set({ mixStyle: s }),
  referenceTrack:    "",
  setReferenceTrack: (t) => set({ referenceTrack: t }),
}));
