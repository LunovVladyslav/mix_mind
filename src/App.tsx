// MixMind — Main App Component
// Two-panel layout: Left (mode tabs + channels/file info) | Right (spectrum + chat)

import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, ChannelSnapshot, AnalysisProgress } from "./store/appStore";
import DawMode from "./modes/DawMode";
import FileMode from "./modes/FileMode";
import Chat from "./components/Chat";
import Settings from "./components/Settings";
import TopBar from "./components/TopBar";
import HistoryPanel from "./components/HistoryPanel";
import { MultiFxConsole } from "./components/fx/MultiFxConsole";

export default function App() {
  const mode = useAppStore(s => s.mode);
  const setMode = useAppStore(s => s.setMode);
  const showSettings = useAppStore(s => s.showSettings);
  const uiScale = useAppStore(s => s.uiScale);
  const leftPanelWidth = useAppStore(s => s.leftPanelWidth);
  const setLeftPanelWidth = useAppStore(s => s.setLeftPanelWidth);
  const analysisProgress = useAppStore(s => s.analysisProgress);
  
  const isLeftPanelOpen = useAppStore(s => s.isLeftPanelOpen);
  const isChatOpen = useAppStore(s => s.isChatOpen);

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      // Clamp width between 200px and 600px
      const newWidth = Math.min(Math.max(mouseMoveEvent.clientX, 200), 600);
      setLeftPanelWidth(newWidth);
    }
  }, [isResizing, setLeftPanelWidth]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Register Tauri event listeners on mount
  useEffect(() => {
    let unmounted = false;
    let unlisteners: Array<() => void> = [];

    const setupListeners = async () => {
      const p1 = await listen<ChannelSnapshot[]>("channels-updated", (e) => {
        useAppStore.getState().setChannels(e.payload);
      });
      if (unmounted) { p1(); } else { unlisteners.push(p1); }

      const p2 = await listen<{ connected: boolean }>("bridge-status", (e) => {
        useAppStore.getState().setBridgeConnected(e.payload.connected);
      });
      if (unmounted) { p2(); } else { unlisteners.push(p2); }

      const p3 = await listen<{ text: string }>("ai-token", (e) => {
        useAppStore.getState().appendToken(e.payload.text);
      });
      if (unmounted) { p3(); } else { unlisteners.push(p3); }

      const p4 = await listen<{ text: string }>("ai-stream-done", () => {
        useAppStore.getState().setStreaming(false);
        useAppStore.getState().setStreamId(null);
      });
      if (unmounted) { p4(); } else { unlisteners.push(p4); }

      const p5 = await listen<{ error: string }>("ai-error", (e) => {
        const store = useAppStore.getState();
        store.setStreaming(false);
        store.setStreamId(null);
        // Append error message to the last assistant bubble
        store.appendToken(`\n\n⚠ Error: ${e.payload?.error || "Unknown error"}`);
      });
      if (unmounted) { p5(); } else { unlisteners.push(p5); }

      const p6 = await listen<AnalysisProgress>("analysis-progress", (e) => {
        useAppStore.getState().setAnalysisProgress(e.payload);
      });
      if (unmounted) { p6(); } else { unlisteners.push(p6); }

      // Fetch initial status
      try {
        const connected = await invoke<boolean>("is_bridge_connected");
        useAppStore.getState().setBridgeConnected(connected);
      } catch (e) {}
    };

    setupListeners();

    // Load initial config
    const CLAUDE_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-5"];
    invoke<{
      model: string;
      hasApiKey: boolean;
      monitorDevice: string;
      provider: string;
      openaiUrl: string;
      openaiKey: string;
    }>("get_config").then((cfg) => {
      const store = useAppStore.getState();
      // Guard: if provider is anthropic but model is from a local LLM — reset to default
      const safeModel = cfg.provider === "anthropic" && !CLAUDE_MODELS.includes(cfg.model)
        ? "claude-haiku-4-5"
        : cfg.model;
      store.setModel(safeModel);
      store.setHasApiKey(cfg.hasApiKey);
      store.setMonitorDevice(cfg.monitorDevice as any);
      store.setApiProvider(cfg.provider);
      store.setOpenaiUrl(cfg.openaiUrl);
      if (cfg.openaiKey) store.setOpenaiKey(cfg.openaiKey);
      // If we had to fix the model, persist it silently
      if (safeModel !== cfg.model) {
        invoke("save_config", { model: safeModel }).catch(() => {});
      }
    }).catch(() => {});


    // Scan plugins on startup
    invoke<string[]>("scan_plugins", { customPaths: useAppStore.getState().customPluginPaths })
      .then((plugins) => useAppStore.getState().setAvailablePlugins(plugins))
      .catch(() => {});

    return () => { 
      unmounted = true;
      unlisteners.forEach((u) => u()); 
    };
  }, []);

  // Apply UI scale to root font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${uiScale * 14}px`;
  }, [uiScale]);

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden text-[0.9rem]">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
        {/* Left Panel */}
        {isLeftPanelOpen && (
          <div 
            className="flex-shrink-0 flex flex-col border-r border-border bg-surface transition-all"
            style={{ width: leftPanelWidth }}
          >
            {/* Mode Tabs */}
            <div className="flex border-b border-border">
              <button
                id="tab-daw"
                disabled={analysisProgress !== null}
                onClick={() => setMode("daw")}
                className={`flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors ${
                  mode === "daw"
                    ? "text-accent border-b-2 border-accent -mb-px bg-panel"
                    : analysisProgress !== null 
                      ? "text-muted/30 cursor-not-allowed"
                      : "text-muted hover:text-text"
                }`}
              >
                DAW Live
              </button>
              <button
                id="tab-file"
                onClick={() => setMode("file")}
                className={`flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors ${
                  mode === "file"
                    ? "text-accent border-b-2 border-accent -mb-px bg-panel"
                    : "text-muted hover:text-text"
                }`}
              >
                File Analysis
              </button>
            </div>

            {/* Mode-specific left panel content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {mode === "daw" && <DawMode />}
              {mode === "file" && <FileMode />}
            </div>

            {/* History Panel */}
            <HistoryPanel />
          </div>
        )}

        {/* Resizer */}
        {isLeftPanelOpen && (
          <div 
            className="w-1 cursor-col-resize hover:bg-accent/50 bg-transparent z-10 flex-shrink-0"
            style={{ marginLeft: -2, marginRight: -2 }}
            onMouseDown={startResizing}
          />
        )}

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg">
          <MultiFxConsole />
        </div>

        {/* Right Panel (Chat) */}
        {isChatOpen && (
          <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden border-l border-border bg-surface shadow-2xl z-20 transition-all">
            <Chat />
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && <Settings />}
    </div>
  );
}
