import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { useHistoryStore, HistorySession } from "../store/historyStore";

export default function HistoryPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyHeight, setHistoryHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    if (!isExpanded) setIsExpanded(true);
  }, [isExpanded]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newHeight = window.innerHeight - e.clientY;
      setHistoryHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 100)));
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);
  const setMode = useAppStore(s => s.setMode);
  const setFileAnalysis = useAppStore(s => s.setFileAnalysis);
  const setFileName = useAppStore(s => s.setFileName);
  const setReferenceAnalysis = useAppStore(s => s.setReferenceAnalysis);
  const setReferenceName = useAppStore(s => s.setReferenceName);
  const setMessages = (m: any) => useAppStore.setState({ messages: m });
  
  const { sessions, deleteSession, clearHistory } = useHistoryStore();

  const loadSession = (s: HistorySession) => {
    setMode(s.mode);
    setMessages(s.messages);
    if (s.mode === "file") {
      setFileAnalysis(s.fileAnalysis ?? null);
      if (s.filePath) {
        setFileName(s.filePath.split(/[\\/]/).pop() || "Loaded Session");
      }
      setReferenceAnalysis(null);
      setReferenceName(null);
    }
  };

  return (
    <div 
      className={`flex flex-col bg-surface border-t border-border transition-all ease-in-out relative flex-shrink-0 ${!isResizing ? 'duration-300' : 'duration-0'}`}
      style={{ height: isExpanded ? historyHeight : 36 }}
    >
      {/* Resizer Handle */}
      {isExpanded && (
        <div 
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-accent/50 z-10 flex-shrink-0"
          style={{ marginTop: -2, marginBottom: -2 }}
          onMouseDown={startResizing}
        />
      )}

      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-border bg-card cursor-pointer select-none hover:bg-card/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg className={`w-3 h-3 text-muted transition-transform duration-300 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h2 className="text-[11px] font-semibold tracking-wide text-text uppercase">History</h2>
        </div>
        {isExpanded && sessions.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clearHistory(); }}
            className="text-[10px] text-danger hover:text-red-400 transition-colors px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-muted/60 text-[10px]">
            No chat history
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded hover:bg-card transition-colors group cursor-pointer border border-transparent hover:border-border/50" onClick={() => loadSession(s)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${s.mode === "daw" ? "bg-accent/20 text-accent" : "bg-blue-500/20 text-blue-400"}`}>
                      {s.mode}
                    </span>
                    <span className="text-[11px] font-medium text-text truncate">{s.title}</span>
                  </div>
                  <div className="text-[9px] text-muted flex items-center gap-1.5">
                    <span>{new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span>•</span>
                    <span>{s.messages.length} msg</span>
                  </div>
                </div>
                
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-danger opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/20"
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
