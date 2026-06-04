// MixMind — DAW Mode Component
// Left panel: channel list | Right: channel map or detail

import { memo, useMemo } from "react";
import {
  ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import { useAppStore, ChannelSnapshot } from "../store/appStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, useRef, useCallback } from "react";

const CHANNEL_COLORS = ["#1D9E75", "#5B8FD4", "#8B6FD4", "#D4A450", "#E05252"];
const TYPE_NAMES = ["Instrument", "Drum Bus", "Bus", "Send", "Master"];

const BAND_LABELS = [
  "20", "", "31", "", "50", "", "80", "100", "", "160",
  "", "250", "", "400", "", "630", "", "1k", "", "1.6k",
  "", "2.5k", "", "4k", "", "6.3k", "", "10k", "", "16k", "20k"
];

/** Clamp dBFS value to 0–100 percentage for VU bar */
function dbfsToPercent(db: number): number {
  return Math.max(0, Math.min(100, (db + 60) / 60 * 100));
}

function vuColor(db: number): string {
  if (db > -6) return "#E05252";
  if (db > -18) return "#E0A050";
  return "#1D9E75";
}

// ── Mini VU bar ────────────────────────────────────────────
const VuBar = memo(({ db, width = 60 }: { db: number; width?: number }) => {
  const pct = dbfsToPercent(db);
  const color = vuColor(db);
  return (
    <div className="h-2 rounded overflow-hidden" style={{ width, background: "#111" }}>
      <div
        className="h-full transition-all duration-75"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
});

// ── Single channel row in left panel ──────────────────────
const ChannelRow = memo(({ ch, selected, excluded, onToggleExclude, onClick }: {
  ch: ChannelSnapshot;
  selected: boolean;
  excluded: boolean;
  onToggleExclude: (e: React.MouseEvent) => void;
  onClick: () => void;
}) => {
  const avgRms = (ch.rmsL + ch.rmsR) / 2;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-border/40 ${
        selected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-card"
      } ${!ch.fresh || excluded ? "opacity-40" : ""}`}
    >
      {/* Exclude Toggle */}
      <button 
        onClick={onToggleExclude}
        className="w-4 h-4 rounded border border-border flex items-center justify-center hover:bg-white/10 transition-colors mr-1"
        title={excluded ? "Include in Analysis" : "Exclude from Analysis"}
      >
        {!excluded && <div className="w-2 h-2 rounded-full bg-accent" />}
      </button>

      {/* Type color dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: CHANNEL_COLORS[ch.channelType] ?? "#666" }}
      />

      {/* Name + meter */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text text-xs truncate">{ch.displayName}</div>
        <div className="mt-1">
          <VuBar db={avgRms} width={80} />
        </div>
      </div>

      {/* LUFS */}
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] font-mono text-muted">
          {ch.lufsM.toFixed(1)}
        </div>
        <div className="text-[9px] text-muted/60">LUFS</div>
      </div>
    </button>
  );
});

// ── Spectrum chart (Canvas, high performance) ────────────────────────
const SpectrumCanvas = memo(({ bands }: { bands: number[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
    }

    const width = rect.width;
    const height = rect.height;
    
    // Draw 31 bands
    const barWidth = width / 31;
    const padding = 1;

    for (let i = 0; i < 31; i++) {
      const db = bands[i] ?? -100;
      // Value from 0 to 80 (where db goes from -80 to 0)
      const val = Math.max(0, db + 80);
      const pxHeight = (val / 80) * height;
      const x = i * barWidth;
      const y = height - pxHeight;

      // Color logic
      if (db > -6) ctx.fillStyle = "#E05252";
      else if (db > -18) ctx.fillStyle = "#E0A050";
      else ctx.fillStyle = "#1D9E75";

      ctx.fillRect(x + padding, y, barWidth - padding * 2, pxHeight);
      
      // Draw labels every 2nd or 3rd band at the bottom
      if (BAND_LABELS[i] && i % 2 !== 0) {
        ctx.fillStyle = "#555";
        ctx.font = "8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(BAND_LABELS[i], x + barWidth / 2, height - 2);
      }
    }
  }, [bands]);

  return (
    <div className="w-full h-full relative group">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Tooltip hint */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-black/50 flex flex-col items-center justify-center">
         <span className="text-[10px] text-white">Live Spectrum (31 bands)</span>
      </div>
    </div>
  );
});

// ── Mini Spectrum chart for cards ─────────────────────────
const MiniSpectrumCanvas = memo(({ bands, color }: { bands: number[], color: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
    }

    const width = rect.width;
    const height = rect.height;
    
    // Draw 31 bands
    const barWidth = width / 31;

    ctx.fillStyle = color;
    for (let i = 0; i < 31; i++) {
      const db = bands[i] ?? -100;
      // Value from 0 to 80 (where db goes from -80 to 0)
      const val = Math.max(0, db + 80);
      const pxHeight = (val / 80) * height;
      const x = i * barWidth;
      const y = height - pxHeight;

      ctx.fillRect(x, y, barWidth, pxHeight);
    }
  }, [bands, color]);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
});

// ── Stereo Lissajous canvas ────────────────────────────────
const Lissajous = memo(({ correlation }: { correlation: number }) => {
  const size = 100;
  // Simple correlation indicator (full Lissajous needs real-time samples)
  // Simple correlation indicator — angle = (1 - correlation) * 45 degrees
  const _angle = (1 - correlation) * 45;
  return (
    <div
      className="lissajous-canvas flex items-center justify-center"
      style={{ width: size, height: size, background: "#111" }}
    >
      <div className="text-center">
        <div className="text-[10px] text-muted">Corr</div>
        <div className="text-sm font-mono text-accent">{correlation.toFixed(2)}</div>
        <div className="text-[9px] text-muted mt-1">
          {correlation > 0.7 ? "Mono" : correlation > 0.3 ? "Wide" : correlation > 0 ? "Very wide" : "Phase!"}
        </div>
      </div>
    </div>
  );
});

// ── Channel Detail (right panel when channel selected) ─────
const ChannelDetail = memo(({ ch }: { ch: ChannelSnapshot }) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreview = async () => {
    if (isPreviewing) return;
    try {
      setIsPreviewing(true);
      await invoke('trigger_preview', { instanceId: ch.instanceId });
      
      // Wait 2.2s for capture to complete (capture is 2.0s)
      setTimeout(async () => {
        try {
          const path = await invoke<string>('get_preview_path', { instanceId: ch.instanceId });
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          const url = convertFileSrc(path);
          if (!audioRef.current) {
            audioRef.current = new Audio();
          }
          audioRef.current.src = url + "?t=" + Date.now(); // cache buster
          audioRef.current.play();
          audioRef.current.onended = () => setIsPreviewing(false);
          audioRef.current.onerror = () => setIsPreviewing(false);
        } catch (e) {
          console.error(e);
          setIsPreviewing(false);
        }
      }, 2200);
    } catch (e) {
      console.error("Preview trigger failed", e);
      setIsPreviewing(false);
    }
  };

  return (
  <div className="p-4 flex flex-col gap-4 animate-slide-up">
    {/* Header */}
    <div className="flex items-center gap-2 justify-between">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: CHANNEL_COLORS[ch.channelType] }}
        />
        <h2 className="text-sm font-bold text-text">{ch.displayName}</h2>
        <span className="text-[10px] text-muted px-1.5 py-0.5 bg-card rounded">
          {TYPE_NAMES[ch.channelType]}
        </span>
      </div>
      <button
        onClick={handlePreview}
        disabled={isPreviewing}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          isPreviewing 
            ? 'bg-accent/50 text-white cursor-wait'
            : 'bg-accent hover:bg-accent/80 text-white'
        }`}
      >
        {isPreviewing ? 'Capturing...' : 'Preview Audio'}
      </button>
    </div>

    {/* Spectrum */}
    <div className="h-40 bg-card rounded-md border border-border overflow-hidden">
      <SpectrumCanvas bands={ch.fftBands} />
    </div>

    {/* Metrics grid */}
    <div className="grid grid-cols-3 gap-2">
      {[
        ["RMS L",     `${ch.rmsL.toFixed(1)} dB`],
        ["RMS R",     `${ch.rmsR.toFixed(1)} dB`],
        ["Peak",      `${ch.peakL.toFixed(1)} dB`],
        ["LUFS-M",    `${ch.lufsM.toFixed(1)}`],
        ["LUFS-S",    `${ch.lufsS.toFixed(1)}`],
        ["True Peak", `${ch.truePeak.toFixed(1)} dBTP`],
        ["Crest",     `${ch.crestFactor.toFixed(1)} dB`],
        ["GR",        `${ch.gainReduction.toFixed(1)} dB`],
        ["BPM",       `${ch.bpm.toFixed(0)}`],
      ].map(([label, val]) => (
        <div key={label} className="bg-card rounded p-2">
          <div className="text-[10px] text-muted">{label}</div>
          <div className="text-xs font-mono text-text mt-0.5">{val}</div>
        </div>
      ))}
    </div>

    {/* Stereo field */}
    <div className="flex items-center gap-4">
      <Lissajous correlation={ch.correlation} />
      <div className="flex flex-col gap-2 flex-1">
        <div>
          <div className="text-[10px] text-muted mb-1">Mid Level</div>
          <VuBar db={ch.midLevel} width={140} />
          <div className="text-[10px] font-mono text-muted mt-0.5">{ch.midLevel.toFixed(1)} dBFS</div>
        </div>
        <div>
          <div className="text-[10px] text-muted mb-1">Side Level</div>
          <VuBar db={ch.sideLevel} width={140} />
          <div className="text-[10px] font-mono text-muted mt-0.5">{ch.sideLevel.toFixed(1)} dBFS</div>
        </div>
      </div>
    </div>
  </div>
)});

// ── Channel Card (mix map overview) ───────────────────────
const ChannelCard = memo(({ ch, onClick }: {
  ch: ChannelSnapshot;
  onClick: () => void;
}) => {
  const isMaster = ch.channelType === 4;
  return (
    <button
      onClick={onClick}
      className={`text-left bg-card rounded-lg p-3 border border-border/50 hover:border-accent/50 transition-all animate-fade-in ${
        isMaster ? "col-span-2" : ""
      } ${!ch.fresh ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0"
             style={{ background: CHANNEL_COLORS[ch.channelType] }} />
        <span className="text-xs font-semibold text-text truncate">{ch.displayName}</span>
        <span className="ml-auto text-[10px] text-muted">{TYPE_NAMES[ch.channelType]}</span>
      </div>

      {/* Mini spectrum */}
      <div className="h-10 mb-2">
        <MiniSpectrumCanvas bands={ch.fftBands} color={CHANNEL_COLORS[ch.channelType]} />
      </div>

      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted">{ch.lufsM.toFixed(1)} LUFS</span>
        <span className="text-muted">TP {ch.truePeak.toFixed(1)}</span>
      </div>
    </button>
  );
});

// ── No Bridge State ────────────────────────────────────────
function NoBridge() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-muted/30 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-muted animate-pulse-dot" />
        </div>
      </div>
      <div>
        <p className="text-text text-sm font-medium mb-1">No VST Plugin Detected</p>
        <p className="text-muted text-xs leading-relaxed">
          Load <strong className="text-accent">MixMind Bridge</strong> VST<br />
          on any DAW channel to start
        </p>
      </div>
      <div className="text-[10px] text-muted/60 bg-card rounded px-3 py-2 font-mono">
        Shared memory: MixMindBridge
      </div>
    </div>
  );
}

// ── DAW Mode ───────────────────────────────────────────────
export default function DawMode() {
  const { 
    channels, isBridgeConnected, selectedChannel, setSelectedChannel,
    excludedChannels, toggleExcludedChannel,
    isCapturing, setCapturing, hasCachedProfile, setHasCachedProfile
  } = useAppStore();

  const [captureTime, setCaptureTime] = useState(0);
  const [listHeight, setListHeight] = useState(() => 
    parseInt(localStorage.getItem("mixmind-daw-list-height") || "300", 10)
  );
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      // 104 is approx the top bar + tabs height
      const newHeight = e.clientY - 104; 
      // Clamp between 100px and windowHeight - 200px
      const clamped = Math.max(100, Math.min(newHeight, window.innerHeight - 200));
      setListHeight(clamped);
      localStorage.setItem("mixmind-daw-list-height", clamped.toString());
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

  useEffect(() => {
    let unlisten: any;
    listen("capture-done", () => {
      setCapturing(false);
      setHasCachedProfile(true);
      setCaptureTime(0);
    }).then(u => unlisten = u);
    return () => unlisten && unlisten();
  }, []);

  // Derived state: is any channel playing in the DAW?
  const isDawPlaying = useMemo(() => {
    return channels.some(ch => ch.isPlaying);
  }, [channels]);

  useEffect(() => {
    let interval: any;
    // Only tick the timer if we are capturing AND the DAW is actively playing
    if (isCapturing && isDawPlaying) {
      interval = setInterval(() => setCaptureTime(t => t + 1), 1000);
    }
    // If not capturing, reset time. If capturing but DAW paused, timer pauses.
    if (!isCapturing) {
      setCaptureTime(0);
    }
    return () => clearInterval(interval);
  }, [isCapturing, isDawPlaying]);

  const handleCaptureToggle = async () => {
    if (isCapturing) {
      await invoke("stop_daw_capture");
      setCapturing(false);
      setHasCachedProfile(true);
    } else {
      useAppStore.getState().clearMessages();
      setCapturing(true);
      setHasCachedProfile(false);
      await invoke("start_daw_capture", { excludedChannels });
    }
  };

  const sorted = useMemo(() =>
    [...channels].sort((a, b) => a.order - b.order),
    [channels]
  );

  const selected = useMemo(() =>
    sorted.find((c) => c.instanceId === selectedChannel),
    [sorted, selectedChannel]
  );

  // Left panel — channel list
  const leftPanel = (
    <div className="flex flex-col h-full overflow-y-auto">
      {!isBridgeConnected ? (
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse-dot" />
            Waiting for bridge...
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-[10px] text-muted">
            {sorted.length} channel{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Capture Section */}
      {isBridgeConnected && (
        <div className="p-3 border-b border-border bg-surface sticky top-0 z-10 flex flex-col gap-2 shadow-sm">
          <button
            onClick={handleCaptureToggle}
            className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              isCapturing 
                ? isDawPlaying 
                  ? "bg-danger/20 text-danger border border-danger/50 animate-pulse"
                  : "bg-warning/20 text-warning border border-warning/50"
                : "bg-accent hover:bg-accent/80 text-white border border-transparent shadow-sm"
            }`}
          >
            {isCapturing ? (
              isDawPlaying ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-danger animate-ping" />
                  Stop Capture ({captureTime}s)
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  Waiting for DAW playback... ({captureTime}s)
                </>
              )
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-white" />
                {hasCachedProfile ? "Recapture Mix" : "Start Capture (30s)"}
              </>
            )}
          </button>
          
          {hasCachedProfile && !isCapturing && (
            <div className="flex items-center justify-between bg-accent/10 rounded px-2 py-1.5 mt-1">
              <span className="text-[9px] text-accent">✓ Mix profile cached</span>
              <button
                onClick={() => {
                  useAppStore.getState().setHasCachedProfile(false);
                  useAppStore.getState().clearMessages();
                }}
                className="text-[9px] text-muted hover:text-danger transition-colors border border-transparent hover:border-danger/30 rounded px-1.5 py-0.5"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {sorted.map((ch) => (
        <ChannelRow
          key={ch.instanceId}
          ch={ch}
          selected={selectedChannel === ch.instanceId}
          excluded={excludedChannels.includes(ch.instanceId)}
          onToggleExclude={(e) => {
            e.stopPropagation();
            toggleExcludedChannel(ch.instanceId);
          }}
          onClick={() => {
                // If user clicks a Bridge plugin (no OSC control), find the
                // corresponding MultiFX instance with the same display name.
                // This ensures selectedChannel always points to the controllable instance.
                const isAlreadySelected = selectedChannel === ch.instanceId;
                if (isAlreadySelected) {
                  setSelectedChannel(null);
                } else if (ch.oscPort === 0) {
                  // Bridge plugin clicked — look for paired MultiFX on same track
                  const multifx = sorted.find(
                    c => c.oscPort > 0 && c.displayName.toLowerCase() === ch.displayName.toLowerCase()
                  );
                  setSelectedChannel(multifx ? multifx.instanceId : ch.instanceId);
                } else {
                  setSelectedChannel(ch.instanceId);
                }
              }}

        />
      ))}
    </div>
  );

  // Right panel content
  const rightContent = useMemo(() => {
    if (!isBridgeConnected && channels.length === 0) {
      return <NoBridge />;
    }
    if (selected) {
      return <ChannelDetail ch={selected} />;
    }
    // Mix map grid
    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((ch) => (
            <ChannelCard
              key={ch.instanceId}
              ch={ch}
              onClick={() => setSelectedChannel(ch.instanceId)}
            />
          ))}
        </div>
      </div>
    );
  }, [isBridgeConnected, channels.length, selected, sorted]);

  return (
    <div className={`flex flex-col h-full overflow-hidden relative ${isResizing ? 'select-none cursor-row-resize' : ''}`}>
      {/* Top: channel list */}
      <div className="flex-shrink-0 overflow-y-auto" style={{ height: listHeight }}>
        {leftPanel}
      </div>

      {/* Resizer */}
      <div 
        className="h-1 bg-border/50 hover:bg-accent/50 cursor-row-resize flex-shrink-0 z-20"
        onMouseDown={startResizing}
        style={{ marginTop: -2, marginBottom: -2 }}
      />

      {/* Bottom: detail or mix map */}
      <div className="flex-1 overflow-y-auto bg-bg border-t border-border">
        {rightContent}
      </div>
    </div>
  );
}
