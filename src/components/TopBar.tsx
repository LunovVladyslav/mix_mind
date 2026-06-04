// MixMind — Top Bar Component
// Connection status, monitor selector, settings button

import { useAppStore } from "../store/appStore";



export default function TopBar() {
  const isBridgeConnected = useAppStore(s => s.isBridgeConnected);
  const mode = useAppStore(s => s.mode);
  const setShowSettings = useAppStore(s => s.setShowSettings);
  const hasApiKey = useAppStore(s => s.hasApiKey);
  const apiProvider = useAppStore(s => s.apiProvider);

  const bridgeVisible = mode === "daw";

  return (
    <div className="h-10 flex items-center px-4 border-b border-border bg-surface flex-shrink-0 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00E5FF] to-[#0077FF] flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.4)]">
          <span className="text-[10px] font-black text-[#05080c]">M</span>
        </div>
        <span className="font-bold text-white text-sm tracking-widest uppercase">MixMind</span>
        <span className="text-accent text-[10px] font-bold tracking-widest ml-1">v0.1</span>
      </div>

      {/* Left Panel Toggle */}
      <button
        onClick={() => useAppStore.getState().setIsLeftPanelOpen(!useAppStore.getState().isLeftPanelOpen)}
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${useAppStore.getState().isLeftPanelOpen ? "text-accent bg-accent/10" : "text-muted hover:text-text hover:bg-card"}`}
        title="Toggle Left Panel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bridge status (DAW mode only) */}
      {bridgeVisible && (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.5)] ${
            isBridgeConnected
              ? "bg-accent animate-pulse"
              : "bg-muted animate-pulse-dot"
          }`} />
          <span className="text-xs font-semibold tracking-widest text-slate-400">
            {isBridgeConnected ? "BRIDGE CONNECTED" : "NO VST"}
          </span>
        </div>
      )}

      {/* API key warning */}
      {!hasApiKey && apiProvider !== "openai" && (
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1 text-[10px] font-bold tracking-widest text-warn hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span>NO API KEY</span>
        </button>
      )}

      {/* Right Panel Toggle */}
      <button
        onClick={() => useAppStore.getState().setIsChatOpen(!useAppStore.getState().isChatOpen)}
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${useAppStore.getState().isChatOpen ? "text-accent bg-accent/10" : "text-muted hover:text-text hover:bg-card"}`}
        title="Toggle AI Chat"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
      </button>

      {/* Settings button */}
      <button
        id="btn-settings"
        onClick={() => setShowSettings(true)}
        className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-accent hover:bg-card transition-colors"
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
    </div>
  );
}
