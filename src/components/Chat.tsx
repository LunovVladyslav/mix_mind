// MixMind — Chat Component
// Streaming AI chat with markdown rendering, quick prompts, auto-scroll
// Includes: Style Selector (40+ genres), Reference Track input

import { useRef, useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore, ChatMessage } from "../store/appStore";

// ── Genre groups for the Style Selector ────────────────────
const GENRE_GROUPS: Record<string, string[]> = {
  "Electronic":     ["House", "Deep House", "Tech House", "Techno", "Trance", "Progressive Trance", "Dubstep", "Drum & Bass", "Jungle", "Breaks", "Ambient", "Chillout", "Garage"],
  "Hip-Hop":        ["Hip-Hop", "Trap", "Drill", "R&B", "Neo-Soul", "Lo-Fi"],
  "Rock / Metal":   ["Rock", "Alternative Rock", "Indie Rock", "Metal", "Heavy Metal", "Death Metal", "Punk", "Grunge", "Post-Rock", "Progressive Rock"],
  "Acoustic / Folk":["Folk", "Acoustic Pop", "Indie Pop", "Singer-Songwriter", "Country"],
  "Classical":      ["Classical", "Orchestral", "Cinematic", "Minimal Classical"],
  "Jazz / Soul":    ["Jazz", "Modern Jazz", "Blues", "Soul", "Funk", "Gospel"],
  "World":          ["Latin", "Reggaeton", "Afrobeat", "K-Pop", "J-Pop", "Reggae"],
};

const genreToKey = (g: string) => g.toLowerCase().replace(/[&\/\s]+/g, "_").replace(/\./g, "");

// ── Style Selector Dropdown ─────────────────────────────────
function StyleSelector() {
  const mixStyle    = useAppStore(s => s.mixStyle);
  const setMixStyle = useAppStore(s => s.setMixStyle);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayLabel = mixStyle
    ? Object.values(GENRE_GROUPS).flat().find(g => genreToKey(g) === mixStyle) ?? mixStyle
    : "Auto-detect";

  return (
    <div ref={ref} className="relative" id="style-selector">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-card/60 hover:border-accent/50 hover:bg-card transition-all text-[10px] text-muted hover:text-text"
        title="Select music genre for better AI recommendations"
      >
        <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm12-3c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zM9 10l12-3" /></svg>
        <span className="max-w-[80px] truncate">{displayLabel}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-[220px] bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Auto-detect option */}
          <div className="p-1 border-b border-border/40">
            <button
              onClick={() => { setMixStyle(null); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded text-[10px] transition-colors ${
                !mixStyle ? "bg-accent/15 text-accent font-medium" : "text-muted hover:bg-card hover:text-text"
              }`}
            >
              <span className="flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg> Auto-detect</span>
            </button>
          </div>
          {/* Genre groups */}
          <div className="max-h-[280px] overflow-y-auto p-1 space-y-1 scrollbar-thin">
            {Object.entries(GENRE_GROUPS).map(([group, genres]) => (
              <div key={group}>
                <div className="px-2 py-0.5 text-[9px] font-semibold text-muted/60 uppercase tracking-wider">{group}</div>
                {genres.map(genre => {
                  const key = genreToKey(genre);
                  return (
                    <button
                      key={key}
                      onClick={() => { setMixStyle(key); setOpen(false); }}
                      className={`w-full text-left px-3 py-1 rounded text-[10px] transition-colors ${
                        mixStyle === key
                          ? "bg-accent/15 text-accent font-medium"
                          : "text-text/80 hover:bg-card hover:text-text"
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MixMind Tool Block ─────────────────────────────────────
function MixMindToolBlock({ code }: { code: string }) {
  const [status, setStatus] = useState<"pending" | "applied" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [title, setTitle] = useState("Plugin Parameter Changes");

  useEffect(() => {
    try {
      const data = JSON.parse(code);
      if (data.title) setTitle(data.title);
    } catch (e) {}
  }, [code]);

  const handleApply = async () => {
    try {
      const data = JSON.parse(code);
      if (!data.instance_id || !data.parameters) {
        throw new Error("Invalid tool data format");
      }
      await invoke("apply_plugin_parameters", {
        instanceId: data.instance_id,
        parameters: data.parameters
      });
      setStatus("applied");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to apply");
    }
  };

  return (
    <div className="my-3 border border-accent/30 bg-accent/5 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-accent flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent" />
          {title}
        </span>
        {status === "pending" && (
          <button
            onClick={handleApply}
            className="px-2 py-1 bg-accent text-white rounded text-[10px] font-bold hover:bg-accent/80 transition-colors"
          >
            Apply Changes
          </button>
        )}
        {status === "applied" && (
          <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold border border-green-500/30 px-2 py-1 rounded bg-green-500/10">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Applied
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-[10px] text-danger font-bold">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> {errorMsg}
          </span>
        )}
      </div>
      <pre className="text-[9px] font-mono text-muted overflow-x-auto p-2 bg-black/20 rounded">
        {code}
      </pre>
    </div>
  );
}

const DAW_CHIPS  = ["Що не так з низькими?", "Порівняй канали", "Що покращити першим?"];
const FILE_CHIPS = ["Аналізуй мікс", "Порівняй з референсом", "Що потрібно для мастерингу?"];

// ── Single message bubble ──────────────────────────────────
function MessageBubble({ msg, isStreaming }: {
  msg: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 animate-slide-up`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#00E5FF] to-[#0077FF] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 shadow-[0_0_8px_rgba(0,229,255,0.3)]">
          <span className="text-[10px] text-[#05080c] font-black">M</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-accent text-white rounded-tr-sm"
            : "bg-card border border-border/50 text-text rounded-tl-sm"
        }`}
      >
        {isUser ? (
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="chat-markdown text-xs leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  if (!inline && match && match[1] === "mixmind_tool") {
                    return <MixMindToolBlock code={String(children).replace(/\n$/, "")} />;
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-blink" />
            )}
          </div>
        )}
        <div className="text-[9px] text-white/40 mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Quick prompt chip ──────────────────────────────────────
function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-3 py-1.5 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}

// ── Chat Component ─────────────────────────────────────────
export default function Chat() {
  const messages            = useAppStore(s => s.messages);
  const addUserMessage      = useAppStore(s => s.addUserMessage);
  const addAssistantMessage = useAppStore(s => s.addAssistantMessage);
  const isStreaming         = useAppStore(s => s.isStreaming);
  const setStreaming         = useAppStore(s => s.setStreaming);
  const setStreamId         = useAppStore(s => s.setStreamId);
  const mode                = useAppStore(s => s.mode);
  const aiMode              = useAppStore(s => s.aiMode);
  const setAiMode           = useAppStore(s => s.setAiMode);
  const selectedChannel     = useAppStore(s => s.selectedChannel);
  const clearMessages       = useAppStore(s => s.clearMessages);
  const hasApiKey           = useAppStore(s => s.hasApiKey);
  const apiProvider         = useAppStore(s => s.apiProvider);
  const availablePlugins    = useAppStore(s => s.availablePlugins);
  const hasCachedProfile    = useAppStore(s => s.hasCachedProfile);
  const isCapturing         = useAppStore(s => s.isCapturing);
  const mixStyle            = useAppStore(s => s.mixStyle);
  const referenceTrack      = useAppStore(s => s.referenceTrack);
  const setReferenceTrack   = useAppStore(s => s.setReferenceTrack);

  const [input, setInput] = useState("");
  const [showReference, setShowReference] = useState(false);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  }, [input]);

  const canSend = mode === "file" || (mode === "daw" && hasCachedProfile && !isCapturing);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !canSend) return;

    const isFirstMessage = messages.length === 0;
    const _userMsgId = addUserMessage(text.trim());
    setInput("");

    const streamId = `stream-${Date.now()}`;
    addAssistantMessage(streamId, "");
    setStreamId(streamId);
    setStreaming(true);

    try {
      if (isFirstMessage) {
        invoke("generate_chat_title", { message: text.trim() })
          .then((title: any) => { useAppStore.getState().setSessionTitle(title); })
          .catch(console.error);
      }

      await invoke("send_message", {
        text: text.trim(),
        mode,
        aiMode,
        selectedChannel,
        availablePlugins,
        mixStyle: mixStyle ?? null,
        referenceTrack: referenceTrack.trim() || null,
      });
    } catch (e: any) {
      console.error("send_message failed:", e);
    }
  }, [isStreaming, canSend, mode, aiMode, selectedChannel, availablePlugins,
      mixStyle, referenceTrack, addUserMessage, addAssistantMessage, setStreamId, setStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const chips = mode === "daw" ? DAW_CHIPS : FILE_CHIPS;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 border-t border-border" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="relative z-50 flex items-center px-3 py-2 border-b border-border flex-shrink-0 gap-2">
        <span className="text-xs font-semibold text-text mr-1">AI Assistant</span>

        {/* Agent / Ask toggle */}
        <div className="flex bg-card border border-border rounded p-0.5">
          <button
            onClick={() => setAiMode("agent")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors ${
              aiMode === "agent" ? "bg-accent text-white" : "text-muted hover:text-text"
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => setAiMode("ask")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors ${
              aiMode === "ask" ? "bg-accent text-white" : "text-muted hover:text-text"
            }`}
          >
            Ask
          </button>
        </div>

        {/* Style selector — only in DAW mode */}
        {mode === "daw" && <StyleSelector />}

        {/* Reference track toggle */}
        {mode === "daw" && (
          <button
            onClick={() => setShowReference(r => !r)}
            title="Set reference track for target sound"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] transition-all ${
              referenceTrack.trim()
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border/60 bg-card/60 text-muted hover:border-accent/40 hover:text-text"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm12-3c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2z" /></svg>
            <span className="hidden sm:inline">{referenceTrack.trim() ? "Ref Set" : "Ref"}</span>
          </button>
        )}

        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="ml-auto text-[10px] text-muted hover:text-text transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Reference track input (collapsible) */}
      {showReference && mode === "daw" && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-border/50 bg-card/30 flex items-center gap-2">
          <span className="text-[10px] text-muted whitespace-nowrap">Reference:</span>
          <input
            type="text"
            value={referenceTrack}
            onChange={e => setReferenceTrack(e.target.value)}
            placeholder="e.g. Daft Punk — One More Time, Tool — Schism..."
            className="flex-1 text-[10px] bg-transparent border border-border/50 rounded px-2 py-1 text-text placeholder:text-muted/50 focus:border-accent/60 focus:outline-none"
          />
          {referenceTrack.trim() && (
            <button
              onClick={() => setReferenceTrack("")}
              className="text-muted hover:text-text text-[10px]"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <p className="text-text text-xs font-medium mb-1">Ask MixMind anything</p>
              <p className="text-muted text-[10px]">
                {mode === "daw"
                  ? "DAW analysis active — I can see your mix"
                  : "Drop a file to analyze, then ask me anything"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {chips.map((c) => (
                <Chip key={c} label={c} onClick={() => sendMessage(c)} />
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
            />
          ))
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-surface relative flex flex-col">
        {!hasApiKey && apiProvider !== "openai" && (
          <div className="text-[10px] text-warn mb-2 px-1">
            ⚠ Add your Anthropic API key in Settings to use AI features
          </div>
        )}
        {!canSend && mode === "daw" && (
          <div className="absolute inset-0 bg-surface/80 flex items-center justify-center backdrop-blur-[1px] z-10">
            <span className="text-xs text-muted font-medium bg-card px-3 py-1.5 rounded-full shadow-sm border border-border">
              {isCapturing ? "Capturing mix..." : "Start a Capture in the DAW panel to ask AI"}
            </span>
          </div>
        )}
        <div className="flex gap-3 flex-1 h-[48px] min-h-0 items-stretch">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your mix... (Enter to send, Shift+Enter for newline)"
            disabled={isStreaming || (!hasApiKey && apiProvider !== "openai") || (!canSend && mode === "daw")}
            className="flex-1 resize-none text-xs leading-relaxed py-3 px-4 rounded-xl border border-border bg-card text-text placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50 h-full scrollbar-thin"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim() || (!hasApiKey && apiProvider !== "openai")}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent hover:bg-accent/80 text-white disabled:opacity-40 transition-all self-end mb-0.5"
            title="Send (Enter)"
          >
            {isStreaming ? (
              <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6L11 6M11 6L7 2M11 6L7 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
