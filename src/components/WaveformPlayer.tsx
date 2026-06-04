// MixMind — Waveform Player
// Canvas-based waveform display + Web Audio API playback + real-time freq visualizer

import { useRef, useEffect, useState, useCallback } from "react";
import { readFile } from "@tauri-apps/plugin-fs";

interface Props {
  filePath: string;
  fileName: string;
}

export default function WaveformPlayer({ filePath, fileName }: Props) {
  const waveCanvasRef  = useRef<HTMLCanvasElement>(null);
  const freqCanvasRef  = useRef<HTMLCanvasElement>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const sourceRef      = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const gainRef        = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const rafRef         = useRef<number>(0);
  const startTimeRef   = useRef<number>(0);
  const pausedAtRef    = useRef<number>(0);
  const playingRef     = useRef<boolean>(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);

  // ── Load + decode audio ──────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    setCurrentTime(0);
    setIsPlaying(false);
    playingRef.current = false;
    pausedAtRef.current = 0;

    // Clean up previous context
    cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
    if (audioCtxRef.current) { audioCtxRef.current.close(); }

    const load = async () => {
      try {
        // Load via Tauri native fs plugin (bypasses browser CORS/fetch limits)
        const fileData = await readFile(filePath);
        // readFile returns Uint8Array, converting to ArrayBuffer for decodeAudioData
        const ab = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);

        const ctx = new AudioContext({ sampleRate: 48000 });
        audioCtxRef.current = ctx;

        const decoded = await ctx.decodeAudioData(ab);
        audioBufferRef.current = decoded;
        setDuration(decoded.duration);
        drawWaveform(decoded);
        setIsLoading(false);
      } catch (e: any) {
        setLoadError(e.message ?? "Failed to load audio");
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
      if (audioCtxRef.current) { audioCtxRef.current.close(); }
    };
  }, [filePath]);

  // ── Draw static waveform ──────────────────────────────────────────────────
  function drawWaveform(buffer: AudioBuffer, playhead = 0) {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const dataL = buffer.getChannelData(0);
    const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;
    const step = Math.ceil(dataL.length / W);
    const midH = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0F0F0F";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const playheadX = (playhead / (buffer.duration || 1)) * W;

    for (let x = 0; x < W; x++) {
      let minL = 0, maxL = 0, minR = 0, maxR = 0;
      let sumSqL = 0, sumSqR = 0;
      
      for (let i = 0; i < step; i++) {
        const idx = x * step + i;
        const sl = dataL[idx] ?? 0;
        const sr = dataR[idx] ?? 0;
        if (sl < minL) minL = sl; if (sl > maxL) maxL = sl;
        if (sr < minR) minR = sr; if (sr > maxR) maxR = sr;
        sumSqL += sl * sl;
        sumSqR += sr * sr;
      }

      const rmsL = Math.sqrt(sumSqL / step);
      const rmsR = Math.sqrt(sumSqR / step);
      const played = x < playheadX;
      
      // Color based on RMS, not absolute peak, so dense tracks don't look completely red
      const getColors = (rms: number, played: boolean) => {
        if (played) {
          if (rms > 0.4) return { peak: "#E05252", rms: "#FF7777" };
          if (rms > 0.25) return { peak: "#E0A050", rms: "#FFC87A" };
          return { peak: "#1D9E75", rms: "#40C49D" };
        } else {
          if (rms > 0.4) return { peak: "#7A2020", rms: "#9A3030" };
          if (rms > 0.25) return { peak: "#7A5020", rms: "#9A7030" };
          return { peak: "#145F46", rms: "#208060" };
        }
      };

      // ── L channel (top half) ──
      const colL = getColors(rmsL, played);
      
      // Draw peak (faded/background line)
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colL.peak;
      ctx.beginPath();
      ctx.moveTo(x, midH / 2 * (1 - maxL));
      ctx.lineTo(x, midH / 2 * (1 - minL));
      ctx.stroke();

      // Draw RMS (solid inner line)
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = colL.rms;
      ctx.beginPath();
      ctx.moveTo(x, midH / 2 * (1 - rmsL));
      ctx.lineTo(x, midH / 2 * (1 + rmsL)); // -(-rms) is +rms
      ctx.stroke();

      // ── R channel (bottom half) ──
      const colR = getColors(rmsR, played);
      const rBase = midH;
      
      // Draw peak
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colR.peak;
      ctx.beginPath();
      ctx.moveTo(x, rBase + midH / 2 * (1 - maxR));
      ctx.lineTo(x, rBase + midH / 2 * (1 - minR));
      ctx.stroke();

      // Draw RMS
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = colR.rms;
      ctx.beginPath();
      ctx.moveTo(x, rBase + midH / 2 * (1 - rmsR));
      ctx.lineTo(x, rBase + midH / 2 * (1 + rmsR));
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Center divider
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, midH); ctx.lineTo(W, midH); ctx.stroke();

    // L/R labels
    ctx.fillStyle = "#444";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("L", 6, 14);
    ctx.fillText("R", 6, H - 4);
  }

  // ── Play ─────────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Disconnect old
    cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) { try { sourceRef.current.stop(); sourceRef.current.disconnect(); } catch {} }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    const gain = ctx.createGain();
    // Use exponential curve for natural perceived volume
    gain.gain.value = volume * volume;
    gainRef.current = gain;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    const offset = Math.min(pausedAtRef.current, Math.max(0, buffer.duration - 0.01));
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    sourceRef.current = source;
    playingRef.current = true;

    source.onended = () => {
      if (!playingRef.current) return;
      playingRef.current = false;
      setIsPlaying(false);
      pausedAtRef.current = 0;
      setCurrentTime(0);
      if (audioBufferRef.current) drawWaveform(audioBufferRef.current, 0);
    };

    setIsPlaying(true);
    startAnimation();
  }, [volume]);

  // ── Pause ────────────────────────────────────────────────────────────────
  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !sourceRef.current) return;
    pausedAtRef.current = ctx.currentTime - startTimeRef.current;
    playingRef.current = false;
    try { sourceRef.current.stop(); } catch {}
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    clearFreqCanvas();
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────────
  function startAnimation() {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const ctx = audioCtxRef.current;
      const analyser = analyserRef.current;
      const buffer = audioBufferRef.current;
      if (!ctx || !analyser || !buffer) return;

      const t = Math.min(ctx.currentTime - startTimeRef.current, buffer.duration);
      setCurrentTime(t);

      // Redraw waveform with playhead
      drawWaveform(buffer, t);

      // Frequency bars
      const freqCanvas = freqCanvasRef.current;
      if (!freqCanvas) return;
      const fc = freqCanvas.getContext("2d");
      if (!fc) return;

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      fc.clearRect(0, 0, freqCanvas.width, freqCanvas.height);
      fc.fillStyle = "#0a0a0a";
      fc.fillRect(0, 0, freqCanvas.width, freqCanvas.height);

      const barW = freqCanvas.width / freqData.length;
      for (let i = 0; i < freqData.length; i++) {
        const v = freqData[i] / 255;
        const h = v * freqCanvas.height;
        const alpha = 0.6 + v * 0.4;
        const r = v > 0.85 ? 224 : v > 0.6 ? 224 : 29;
        const g = v > 0.85 ? 82  : v > 0.6 ? 160 : 158;
        const b = v > 0.85 ? 82  : v > 0.6 ? 80  : 117;
        fc.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        fc.fillRect(i * barW, freqCanvas.height - h, barW - 0.5, h);
        // Reflection
        fc.fillStyle = `rgba(${r},${g},${b},${alpha * 0.15})`;
        fc.fillRect(i * barW, freqCanvas.height, barW - 0.5, h * 0.2);
      }
    };
    draw();
  }

  function clearFreqCanvas() {
    const c = freqCanvasRef.current?.getContext("2d");
    if (!c || !freqCanvasRef.current) return;
    c.fillStyle = "#0a0a0a";
    c.fillRect(0, 0, freqCanvasRef.current.width, freqCanvasRef.current.height);
  }

  // ── Seek ─────────────────────────────────────────────────────────────────
  function handleSeek(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = ratio * duration;
    pausedAtRef.current = Math.max(0, Math.min(t, duration));
    setCurrentTime(pausedAtRef.current);
    if (audioBufferRef.current) drawWaveform(audioBufferRef.current, pausedAtRef.current);
    if (isPlaying) { playingRef.current = false; play(); }
  }

  // ── Volume ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // Exponential curve
    if (gainRef.current) gainRef.current.gain.value = volume * volume;
  }, [volume]);

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col bg-[#0F0F0F] rounded-xl border border-border/60 overflow-hidden">
      {/* Waveform canvas */}
      <div className="relative cursor-pointer group" onClick={handleSeek}>
        <canvas
          ref={waveCanvasRef}
          width={800}
          height={100}
          className="w-full block"
          style={{ imageRendering: "crisp-edges" }}
        />
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-none"
          style={{ left: `${progress}%` }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted">
              <div className="w-3 h-3 rounded-full border border-accent border-t-transparent animate-spin" />
              Decoding waveform...
            </div>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80">
            <div className="text-xs text-danger">{loadError}</div>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-colors pointer-events-none" />
      </div>

      {/* Frequency visualizer */}
      <canvas
        ref={freqCanvasRef}
        width={800}
        height={48}
        className="w-full block"
        style={{ background: "#0a0a0a" }}
      />

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface">
        {/* Play / Pause */}
        <button
          id="btn-play-pause"
          onClick={isPlaying ? pause : play}
          disabled={isLoading || !!loadError}
          className="w-9 h-9 rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1" width="3.5" height="12" fill="white" rx="1"/>
              <rect x="8.5" y="1" width="3.5" height="12" fill="white" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="2,1 13,7 2,13" fill="white"/>
            </svg>
          )}
        </button>

        {/* Time */}
        <span className="text-[11px] font-mono text-muted flex-shrink-0 w-20">
          {fmt(currentTime)} <span className="text-muted/50">/</span> {fmt(duration)}
        </span>

        {/* Progress bar */}
        <div
          className="flex-1 h-1.5 bg-border/60 rounded-full overflow-hidden cursor-pointer group/bar"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-accent rounded-full group-hover/bar:bg-accent/90 transition-colors"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Volume icon + slider */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 4H4L7 1V11L4 8H1V4Z" fill="#666"/>
            {volume > 0.5 && <path d="M9 2C10.3 3 11 4.4 11 6C11 7.6 10.3 9 9 10" stroke="#666" strokeWidth="1.2" strokeLinecap="round"/>}
            {volume > 0 && <path d="M8 4C8.7 4.7 9 5.3 9 6C9 6.7 8.7 7.3 8 8" stroke="#666" strokeWidth="1.2" strokeLinecap="round"/>}
          </svg>
          <input
            type="range" min={0} max={1} step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-14"
            style={{ accentColor: "#1D9E75" }}
          />
        </div>

        {/* File name */}
        <span className="text-[10px] text-muted/60 truncate max-w-[160px] font-mono">
          {fileName}
        </span>
      </div>
    </div>
  );
}
