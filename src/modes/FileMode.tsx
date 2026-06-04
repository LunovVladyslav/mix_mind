// MixMind — File Analysis Mode
// Drag & drop or open audio file → analysis → waveform player + metrics + AI chat

import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  Cell, ReferenceLine
} from "recharts";
import { useAppStore, AnalysisResult } from "../store/appStore";
import WaveformPlayer from "../components/WaveformPlayer";

// 31 1/3-octave band labels
const BAND_LABELS = [
  "20","","31","","50","","80","100","","160",
  "","250","","400","","630","","1k","","1.6k",
  "","2.5k","","4k","","6.3k","","10k","","16k","20k"
];

// ── Spectrum comparison chart ─────────────────────────────────────────────
function SpectrumCompare({
  mix, ref: refData, view
}: {
  mix: number[];
  ref: number[] | null;
  view: "mix" | "ref" | "delta";
}) {
  const data = mix.map((db, i) => {
    const rd = refData?.[i] ?? null;
    const delta = rd !== null ? db - rd : 0;
    return {
      name: BAND_LABELS[i] ?? "",
      mix: Math.max(0, db + 80),
      ref: rd !== null ? Math.max(0, rd + 80) : 0,
      delta,
      dbMix: db,
    };
  });

  if (view === "delta" && refData) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={0} barSize={10} margin={{ top: 4, bottom: 0, left: -20, right: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#555" }} interval={2} tickLine={false} axisLine={false} />
          <YAxis domain={[-15, 15]} tick={{ fontSize: 8, fill: "#555" }} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1A1A1A", border: "1px solid #333", fontSize: 11 }}
            formatter={(_v: number, _n: string, props: any) => [`${props.payload.delta.toFixed(1)} dB`, "Mix − Ref"]}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Bar dataKey="delta" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.delta > 3 ? "#E05252" : d.delta < -3 ? "#5B8FD4" : "#1D9E75"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={1} barSize={view === "mix" ? 10 : 5} margin={{ top: 4, bottom: 0, left: -20, right: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#555" }} interval={2} tickLine={false} axisLine={false} />
        <YAxis hide domain={[0, 80]} />
        <Tooltip
          contentStyle={{ background: "#1A1A1A", border: "1px solid #333", fontSize: 11 }}
          formatter={(_v: number, _n: string, props: any) => [`${props.payload.dbMix.toFixed(1)} dBFS`, "Level"]}
        />
        <Bar dataKey="mix" radius={[2, 2, 0, 0]} name="Mix">
          {data.map((d, i) => (
            <Cell key={i} fill={d.dbMix > -6 ? "#E05252" : d.dbMix > -18 ? "#E0A050" : "#1D9E75"} />
          ))}
        </Bar>
        {view === "ref" && refData && (
          <Bar dataKey="ref" radius={[2, 2, 0, 0]} fill="#5B8FD470" name="Reference" />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────
function MetricTile({ label, value, sub, warn }: {
  label: string; value: string; sub?: string; warn?: boolean;
}) {
  return (
    <div className={`bg-card rounded-lg p-2.5 border ${warn ? "border-danger/40" : "border-border/30"}`}>
      <div className="text-[10px] text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-bold ${warn ? "text-danger" : "text-text"}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted/60 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Drop Zone ─────────────────────────────────────────────────────────────
function DropZone({ onFile, isDragging }: { onFile: (path: string) => void; isDragging: boolean }) {
  const handleClick = useCallback(async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "mp3", "aac", "flac", "ogg", "m4a"] }],
      });
      if (result && typeof result === "string") {
        onFile(result);
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }, [onFile]);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 h-full cursor-pointer transition-all rounded-xl border-2 border-dashed mx-4 my-4 ${
        isDragging
          ? "border-accent bg-accent/10 scale-[0.99]"
          : "border-border/40 hover:border-accent/50 hover:bg-card/40"
      }`}
      onClick={handleClick}
    >
      {/* Waveform icon */}
      <div className="relative">
        <svg width="56" height="36" viewBox="0 0 56 36" fill="none">
          <rect x="0"  y="14" width="4" height="8"  rx="2" fill={isDragging ? "#1D9E75" : "#333"}/>
          <rect x="6"  y="8"  width="4" height="20" rx="2" fill={isDragging ? "#1D9E75" : "#3a3a3a"}/>
          <rect x="12" y="2"  width="4" height="32" rx="2" fill={isDragging ? "#1D9E75" : "#444"}/>
          <rect x="18" y="10" width="4" height="16" rx="2" fill={isDragging ? "#1D9E75" : "#3a3a3a"}/>
          <rect x="24" y="4"  width="4" height="28" rx="2" fill={isDragging ? "#22c495" : "#1D9E75"}/>
          <rect x="30" y="10" width="4" height="16" rx="2" fill={isDragging ? "#1D9E75" : "#3a3a3a"}/>
          <rect x="36" y="2"  width="4" height="32" rx="2" fill={isDragging ? "#1D9E75" : "#444"}/>
          <rect x="42" y="8"  width="4" height="20" rx="2" fill={isDragging ? "#1D9E75" : "#3a3a3a"}/>
          <rect x="48" y="14" width="4" height="8"  rx="2" fill={isDragging ? "#1D9E75" : "#333"}/>
        </svg>
        {isDragging && (
          <div className="absolute -inset-4 bg-accent/10 rounded-xl animate-pulse" />
        )}
      </div>

      <div className="text-center">
        <p className={`text-sm font-semibold mb-1 transition-colors ${isDragging ? "text-accent" : "text-text"}`}>
          {isDragging ? "Release to analyze" : "Drop audio file here"}
        </p>
        <p className="text-xs text-muted">or click to browse</p>
        <p className="text-[10px] text-muted/50 mt-2">WAV · MP3 · AAC · FLAC · OGG</p>
      </div>
    </div>
  );
}

// ── Main FileMode component ───────────────────────────────────────────────
export default function FileMode() {
  const {
    fileAnalysis, setFileAnalysis,
    fileName, setFileName,
    analysisProgress,
  } = useAppStore();

  const [filePath, setFilePath]       = useState<string | null>(null);
  const [refPath, setRefPath]         = useState<string | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<AnalysisResult | null>(null);
  const [specView, setSpecView]       = useState<"mix" | "ref" | "delta">("mix");
  const [isDragging, setIsDragging]   = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refAnalyzing, setRefAnalyzing] = useState(false);
  const unlisten = useRef<(() => void) | null>(null);

  // ── Register Tauri file-drop events ──────────────────────────────────────
  useEffect(() => {
    let unlistenDrop: (() => void) | null = null;
    let unlistenHover: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;

    (async () => {
      // Tauri v2 drag-drop events
      unlistenDrop = await listen<{ paths: string[] }>("tauri://drag-drop", (e) => {
        setIsDragging(false);
        const paths = e.payload?.paths ?? (e.payload as any);
        const arr = Array.isArray(paths) ? paths : [paths];
        const audio = arr.find((p: string) =>
          /\.(wav|mp3|aac|flac|ogg|m4a)$/i.test(p)
        );
        if (audio) handleFile(audio);
      });

      unlistenHover = await listen("tauri://drag-enter", () => setIsDragging(true));
      unlistenLeave = await listen("tauri://drag-leave", () => setIsDragging(false));
    })();

    return () => {
      unlistenDrop?.();
      unlistenHover?.();
      unlistenLeave?.();
    };
  }, []);

  // ── Analyze a file path ───────────────────────────────────────────────────
  const handleFile = useCallback(async (path: string) => {
    const name = path.split(/[\\/]/).pop() ?? path;
    useAppStore.getState().clearMessages();
    
    setFilePath(path);
    setFileName(name);
    setIsAnalyzing(true);
    setFileAnalysis(null);
    setSpecView("mix");

    try {
      const result = await invoke<AnalysisResult>("analyze_file", { path });
      setFileAnalysis(result);
      
      // Automatically trigger AI analysis chat
      setTimeout(() => {
        const store = useAppStore.getState();
        const msg = `Аналізуй мікс: ${name}`;
        store.addUserMessage(msg);
        
        const streamId = `stream-${Date.now()}`;
        store.addAssistantMessage(streamId, "");
        store.setStreamId(streamId);
        store.setStreaming(true);

        invoke("send_message", { 
          text: msg, 
          mode: "file",
          availablePlugins: [] // Assuming no custom plugins yet or handled by App.tsx
        }).catch(err => {
          console.error("Failed to auto-send message:", err);
          store.setStreaming(false);
        });
      }, 100);
      
    } catch (e) {
      if (e !== "Analysis cancelled") {
        console.error("Analysis failed:", e);
      }
    } finally {
      setIsAnalyzing(false);
      useAppStore.getState().setAnalysisProgress(null);
    }
  }, []);

  const handleCancel = useCallback(() => {
    invoke("cancel_analysis");
    setIsAnalyzing(false);
    useAppStore.getState().setAnalysisProgress(null);
  }, []);

  // ── Load reference file ────────────────────────────────────────────────────
  const handleReference = useCallback(async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "mp3", "aac", "flac", "ogg"] }],
      });
      if (!result || typeof result !== "string") return;
      setRefPath(result);
      setRefAnalyzing(true);
      setSpecView("ref");
      const res = await invoke<AnalysisResult>("analyze_file", { path: result });
      setRefAnalysis(res);
      setSpecView("delta");
    } catch (e) {
      console.error("Reference load failed:", e);
    } finally {
      setRefAnalyzing(false);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const hasResult = !!fileAnalysis;

  // No file loaded yet
  if (!hasResult && !isAnalyzing) {
    return <DropZone onFile={handleFile} isDragging={isDragging} />;
  }

  // Analyzing
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 h-full">
        {/* Simple Spinner */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <svg className="animate-spin w-full h-full text-border" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
             <span className="text-xs font-bold text-accent">{analysisProgress ? analysisProgress.pct : 0}%</span>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-text font-medium mb-1">Analyzing {fileName}...</p>
          <p className="text-xs text-muted mb-4">
            {analysisProgress?.stage === "decoding" && "Decoding waveform..."}
            {analysisProgress?.stage === "fft" && "Computing FFT & LUFS..."}
            {analysisProgress?.stage === "done" && "Finalizing..."}
            {!analysisProgress && "Processing..."}
          </p>
          
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 text-xs border border-border hover:border-danger hover:text-danger rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Results view
  const r = fileAnalysis!;
  const truePeakWarn = r.truePeak > -0.5;
  const lufsWarn = r.lufsIntegrated < -16 || r.lufsIntegrated > -6;

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {/* Waveform Player */}
      {filePath && (
        <WaveformPlayer filePath={filePath} fileName={fileName ?? ""} />
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setFilePath(null); setFileAnalysis(null); setFileName(null); setRefAnalysis(null); setRefPath(null); }}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-card hover:bg-border/60 text-muted hover:text-text transition-colors border border-border/40"
        >
          ← New file
        </button>
        <button
          onClick={handleReference}
          disabled={refAnalyzing}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-card hover:bg-border/60 text-muted hover:text-text transition-colors border border-border/40 disabled:opacity-50"
        >
          {refAnalyzing ? "Loading ref..." : refAnalysis ? "↺ Change ref" : "+ Load reference"}
        </button>
        <div className="ml-auto text-[10px] text-muted/50 font-mono truncate max-w-[180px]">{fileName}</div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Integrated LUFS" value={r.lufsIntegrated.toFixed(1)} sub="ITU-R BS.1770-4" warn={lufsWarn} />
        <MetricTile label="True Peak" value={`${r.truePeak.toFixed(1)} dBTP`} warn={truePeakWarn} />
        <MetricTile label="LRA" value={`${r.lufsRange.toFixed(1)} LU`} sub="Loudness range" />
        <MetricTile label="BPM" value={r.bpm > 0 ? r.bpm.toFixed(0) : "—"} />
        <MetricTile label="Key" value={r.key || "—"} />
        <MetricTile label="Stereo Corr." value={r.stereoCorrelation.toFixed(2)} sub={r.stereoCorrelation > 0.85 ? "Very mono" : r.stereoCorrelation < 0.2 ? "Wide" : "Normal"} />
        <MetricTile label="Crest Factor" value={`${r.dynamicRange.toFixed(1)} dB`} />
        <MetricTile label="Duration" value={`${Math.floor(r.durationSecs/60)}:${String(Math.floor(r.durationSecs%60)).padStart(2,"0")}`} />
        <MetricTile label="Sample Rate" value={`${(r.sampleRate/1000).toFixed(1)} kHz`} />
      </div>

      {/* Spectrum chart */}
      <div className="bg-card rounded-xl border border-border/30 p-3">
        {/* View toggle */}
        {refAnalysis && (
          <div className="flex gap-1 mb-3">
            {(["mix", "ref", "delta"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSpecView(v)}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                  specView === v ? "bg-accent text-white" : "bg-border/40 text-muted hover:text-text"
                }`}
              >
                {v === "mix" ? "My Mix" : v === "ref" ? "Reference" : "Δ Delta"}
              </button>
            ))}
          </div>
        )}
        <div className="h-36">
          <SpectrumCompare
            mix={r.fftProfile}
            ref={refAnalysis?.fftProfile ?? null}
            view={specView}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted/50 mt-1 px-1">
          <span>20 Hz</span>
          <span>1 kHz</span>
          <span>20 kHz</span>
        </div>
      </div>

      {/* True Peak warning */}
      {truePeakWarn && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 text-[11px] text-danger flex items-center gap-2">
          <span>⚠</span>
          <span>True Peak {r.truePeak.toFixed(1)} dBTP exceeds –0.5 dBTP limit for streaming platforms</span>
        </div>
      )}
    </div>
  );
}
