import React, { useState } from 'react';
import { useVstStore } from '../../store/useVstStore';
import { useAppStore } from '../../store/appStore';
import { Knob } from '../ui/Knob';
import { VuMeter } from '../ui/VuMeter';

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtFreq  = (v: number) => { const hz = 20 * Math.pow(1000, v); return hz >= 1000 ? `${(hz/1000).toFixed(1)}k` : `${Math.round(hz)}Hz`; };
const fmtGain  = (v: number) => { const db = (v - 0.5) * 36; return `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`; };
const fmtQ     = (v: number) => (0.1 * Math.pow(100, v)).toFixed(2);
const fmtMs    = (v: number, max = 2000, min = 0.1) => { const ms = min + v * (max - min); return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(ms < 10 ? 1 : 0)}ms`; };
const fmtPct   = (v: number) => `${Math.round(v * 100)}%`;
const fmtRatio = (v: number) => `${(1 + v * 19).toFixed(1)}:1`;
const fmtDb60  = (v: number) => { const db = v * 60 - 60; return `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`; };

// ─── Shared UI primitives ─────────────────────────────────────────────────────
const Divider: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center gap-3 px-2">
    <div className="flex-1 h-px bg-white/[0.05]" />
    {label && <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/20">{label}</span>}
    <div className="flex-1 h-px bg-white/[0.05]" />
  </div>
);

interface PillGroupProps { options: string[]; value: number; onChange: (i: number) => void; color?: string; }
const PillGroup: React.FC<PillGroupProps> = ({ options, value, onChange, color = '#5B7CF6' }) => (
  <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/[0.06] gap-0.5">
    {options.map((opt, i) => (
      <button key={i} onClick={() => onChange(i)}
        className="px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200"
        style={value === i
          ? { background: `${color}22`, color, border: `1px solid ${color}44`, textShadow: `0 0 8px ${color}` }
          : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}>
        {opt}
      </button>
    ))}
  </div>
);

interface PowerButtonProps { active: boolean; color?: string; onClick: () => void; }
const PowerButton: React.FC<PowerButtonProps> = ({ active, color = '#10b981', onClick }) => (
  <button onClick={onClick}
    className="w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200"
    style={{ borderColor: active ? `${color}66` : 'rgba(255,255,255,0.08)', background: active ? `${color}18` : 'rgba(0,0,0,0.4)', boxShadow: active ? `0 0 12px ${color}44, inset 0 0 8px ${color}22` : 'none' }}>
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={active ? color : 'rgba(255,255,255,0.3)'} strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v6M4.93 4.93l1.41 1.41M19.07 4.93l-1.41 1.41M2 12h2M20 12h2M12 20a8 8 0 100-16" />
    </svg>
  </button>
);

interface CardProps { children: React.ReactNode; className?: string; glow?: string; }
const Card: React.FC<CardProps> = ({ children, className = '', glow }) => (
  <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm ${className}`}
    style={glow ? { boxShadow: `0 0 40px ${glow}18, inset 0 1px 0 rgba(255,255,255,0.04)` } : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
    {children}
  </div>
);

// ─── No signal placeholder ────────────────────────────────────────────────────
const NoSignal: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-30">
    <div className="text-[9px] font-bold tracking-widest uppercase text-white/40">{label}</div>
    <div className="text-[10px] text-white/20 font-mono">— no signal —</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EQ — FabFilter Pro-Q style, real params only
// ─────────────────────────────────────────────────────────────────────────────
const EqEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void }> = ({ p, sp }) => {
  const [selectedBand, setSelectedBand] = useState(2);
  const bands = [
    { name: 'HPF', fIdx: 1, gIdx: -1, qIdx: 2, aIdx: 0, color: '#00c8ff' },
    { name: 'Low',  fIdx: 3, gIdx: 4,  qIdx: 5,  aIdx: 6,  color: '#ffd600' },
    { name: 'Mid',  fIdx: 8, gIdx: 9,  qIdx: 10, aIdx: 7,  color: '#00e676' },
    { name: 'High', fIdx: 14, gIdx: 15, qIdx: 16, aIdx: 13, color: '#ff4081' },
    { name: 'LPF', fIdx: 17, gIdx: -1, qIdx: 18, aIdx: 19, color: '#b388ff' },
  ];
  const activeBand = bands[selectedBand];
  const W = 1000, H = 500;

  // EQ path from real params only
  let d = '';
  for (let x = 0; x <= W; x += 5) {
    let yDb = 0;
    bands.forEach(band => {
      if (p[band.aIdx] <= 0.5) return;
      const freqX = p[band.fIdx] * W;
      const gainDb = band.gIdx !== -1 ? (p[band.gIdx] - 0.5) * 36 : 0;
      const sigma  = 15 + (1 - p[band.qIdx]) * 285;
      if (band.name === 'HPF') {
        if (x < freqX) yDb -= 18 * (Math.sqrt(1 + Math.pow((freqX - x) / sigma, 2) * 2) - 1);
      } else if (band.name === 'LPF') {
        if (x > freqX) yDb -= 18 * (Math.sqrt(1 + Math.pow((x - freqX) / sigma, 2) * 2) - 1);
      } else if (band.name === 'Low') {
        if (x < freqX) { yDb += gainDb; }
        else { const dist = x - freqX; if (dist < sigma * 2) { const f = 1 - dist / (sigma * 2); yDb += gainDb * (f * f * (3 - 2 * f)); } }
      } else if (band.name === 'High') {
        if (x > freqX) { yDb += gainDb; }
        else { const dist = freqX - x; if (dist < sigma * 2) { const f = 1 - dist / (sigma * 2); yDb += gainDb * (f * f * (3 - 2 * f)); } }
      } else {
        yDb += gainDb * Math.exp(-Math.pow(x - freqX, 2) / (2 * sigma * sigma));
      }
    });
    const yPx = Math.max(0, Math.min(H, H / 2 - (yDb / 18) * (H / 2)));
    d += x === 0 ? `M ${x},${yPx}` : ` L ${x},${yPx}`;
  }

  const handleNodeMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setSelectedBand(idx);
    const band = bands[idx];
    const startX = e.clientX, startY = e.clientY;
    const startFreq = p[band.fIdx];
    const startGain = band.gIdx !== -1 ? p[band.gIdx] : 0.5;
    const onMove = (mv: MouseEvent) => {
      sp(band.fIdx, Math.max(0, Math.min(1, startFreq + (mv.clientX - startX) / 600)));
      if (band.gIdx !== -1) sp(band.gIdx, Math.max(0, Math.min(1, startGain - (mv.clientY - startY) / 300)));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      {/* EQ Graph */}
      <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/50 border border-white/[0.05] min-h-[180px]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[+18,+12,+6,0,-6,-12,-18].map(db => {
            const y = H/2 - (db/18)*(H/2);
            return <line key={db} x1={0} y1={y} x2={W} y2={y} stroke={db === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'} strokeWidth={db === 0 ? 1.5 : 1} />;
          })}
          {[20,50,100,200,500,1000,2000,5000,10000,20000].map((freq, i) => {
            const x = (Math.log10(freq/20) / Math.log10(1000)) * W;
            return <line key={i} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />;
          })}
        </svg>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeBand.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={activeBand.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${W},${H/2} L0,${H/2} Z`} fill="url(#eqFillGrad)" />
          <path d={d} fill="none" stroke={activeBand.color} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${activeBand.color}88)` }} />
        </svg>
        {/* Nodes */}
        {bands.map((band, idx) => {
          const freqVal = p[band.fIdx];
          const gainVal = band.gIdx !== -1 ? p[band.gIdx] : 0.5;
          const isActive = p[band.aIdx] > 0.5;
          const isSel = selectedBand === idx;
          return (
            <div key={idx} onMouseDown={e => handleNodeMouseDown(e, idx)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10"
              style={{ left: `${freqVal * 100}%`, top: `${(1 - gainVal) * 100}%`, transform: `translate(-50%,-50%) scale(${isSel ? 1.3 : 1})`, transition: 'transform 0.1s' }}>
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: band.color, background: isSel ? `${band.color}33` : 'rgba(0,0,0,0.6)', boxShadow: isSel ? `0 0 16px ${band.color}88` : 'none', opacity: isActive ? 1 : 0.3 }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: band.color }} />
              </div>
            </div>
          );
        })}
        {/* dB labels */}
        <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-3 pointer-events-none">
          {['+18','+12','+6','0','-6','-12','-18'].map(l => <span key={l} className="text-[8px] font-bold text-white/20 tabular-nums">{l}</span>)}
        </div>
        {/* Freq labels */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-between px-6 pointer-events-none">
          {['20','50','100','200','500','1k','2k','5k','10k','20k'].map(l => <span key={l} className="text-[8px] font-bold text-white/20">{l}</span>)}
        </div>
      </div>
      {/* Band selector */}
      <div className="flex gap-2">
        {bands.map((band, idx) => (
          <button key={idx} onClick={() => setSelectedBand(idx)}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all duration-200 border"
            style={selectedBand === idx
              ? { borderColor: `${band.color}55`, color: band.color, background: `${band.color}15`, boxShadow: `0 0 12px ${band.color}30` }
              : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', background: 'transparent' }}>
            {band.name}
          </button>
        ))}
      </div>
      {/* Active band controls */}
      <Card className="flex items-center gap-6 px-6 py-4">
        <PowerButton active={p[activeBand.aIdx] > 0.5} color={activeBand.color} onClick={() => sp(activeBand.aIdx, p[activeBand.aIdx] > 0.5 ? 0 : 1)} />
        <div className="flex gap-8">
          <Knob label="Freq" value={p[activeBand.fIdx]} onChange={v => sp(activeBand.fIdx, v)} formatValue={fmtFreq} showValue themeColor={activeBand.color} size="md" />
          {activeBand.gIdx !== -1
            ? <Knob label="Gain" value={p[activeBand.gIdx]} onChange={v => sp(activeBand.gIdx, v)} formatValue={fmtGain} showValue themeColor={activeBand.color} size="md" />
            : <div className="opacity-20 pointer-events-none"><Knob label="Gain" value={0.5} onChange={() => {}} formatValue={fmtGain} showValue themeColor={activeBand.color} size="md" /></div>}
          <Knob label={activeBand.gIdx !== -1 ? 'Q' : 'Slope'} value={p[activeBand.qIdx]} onChange={v => sp(activeBand.qIdx, v)} formatValue={fmtQ} showValue themeColor={activeBand.color} size="md" />
        </div>
        <div className="ml-auto">
          <PillGroup options={['L','R','Stereo','Mid','Side']} value={2} onChange={() => {}} color={activeBand.color} />
        </div>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESSOR
// ─────────────────────────────────────────────────────────────────────────────
const typeThemes = [
  { name: 'Clean', color: '#94a3b8' },
  { name: 'FET',   color: '#ef4444' },
  { name: 'Opto',  color: '#f59e0b' },
  { name: 'VCA',   color: '#06b6d4' },
];

const TransferCurve: React.FC<{ thresh: number; ratio: number; color: string }> = ({ thresh, ratio, color }) => {
  const W = 200, H = 200;
  const tDb = thresh * 60 - 60;
  const ratioVal = 1 + ratio * 19;
  const tX = ((tDb + 60) / 60) * W;
  let d = `M 0,${H}`;
  for (let x = 0; x <= W; x += 2) {
    const inDb = (x / W) * 60 - 60;
    const outDb = inDb <= tDb ? inDb : tDb + (inDb - tDb) / ratioVal;
    const y = H - ((outDb + 60) / 60) * H;
    d += ` L ${x},${Math.max(0, Math.min(H, y))}`;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <line x1={0} y1={H} x2={W} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="4 4" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      <circle cx={tX} cy={H - tX} r="4" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
    </svg>
  );
};

// Real GR bar — shows nothing if grDb is 0
const GrMeter: React.FC<{ grDb: number; color: string }> = ({ grDb, color }) => {
  const W = Math.max(0, Math.min(100, (-grDb / 30) * 100));
  if (W === 0) return <NoSignal label="GR — no compression" />;
  return (
    <div className="flex items-center gap-3 w-full">
      <span className="text-[9px] text-white/30 font-bold w-4 text-right">GR</span>
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.04]">
        <div className="h-full rounded-full transition-all duration-75"
          style={{ width: `${W}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="text-[10px] font-mono text-white/50 w-12 tabular-nums">{grDb.toFixed(1)} dB</span>
    </div>
  );
};

const CompressorEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; channel: any | null }> = ({ p, sp, channel }) => {
  const thresh = p[0], ratio = p[1], attack = p[2], release = p[3], makeup = p[5], mix = p[6];
  const typeIdx = Math.round(p[7] * 3);
  const theme = typeThemes[typeIdx];
  const grDb = channel ? channel.gainReduction : 0;

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex justify-center">
        <PillGroup options={typeThemes.map(t => t.name)} value={typeIdx} onChange={i => sp(7, i / 3)} color={theme.color} />
      </div>
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: transfer curve + real GR */}
        <Card className="flex flex-col items-center p-4 gap-3 w-52 flex-shrink-0" glow={theme.color}>
          <div className="text-[9px] font-black tracking-widest uppercase text-white/30">Transfer</div>
          <div className="w-36 h-36">
            <TransferCurve thresh={thresh} ratio={ratio} color={theme.color} />
          </div>
          <div className="w-full">
            <GrMeter grDb={grDb} color={theme.color} />
          </div>
          {/* Real IN/OUT meters — only if bridge connected */}
          {channel ? (
            <div className="flex gap-3 w-full">
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[8px] text-white/30 font-bold">L</span>
                <VuMeter orientation="vertical" segments={20} className="h-14 w-full" rmsL={channel.rmsL} rmsR={channel.rmsL} />
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[8px] text-white/30 font-bold">R</span>
                <VuMeter orientation="vertical" segments={20} className="h-14 w-full" rmsL={channel.rmsR} rmsR={channel.rmsR} />
              </div>
            </div>
          ) : <NoSignal label="meters" />}
        </Card>
        {/* Right: controls */}
        <Card className="flex-1 flex flex-col justify-center p-6 gap-6" glow={theme.color}>
          <div className="flex justify-around">
            <Knob label="Threshold" value={thresh} onChange={v => sp(0, v)} formatValue={fmtDb60} showValue themeColor={theme.color} size="lg" />
            <Knob label="Ratio" value={ratio} onChange={v => sp(1, v)} formatValue={fmtRatio} showValue themeColor={theme.color} size="lg" />
          </div>
          <Divider />
          <div className="flex justify-around">
            <Knob label="Attack" value={attack} onChange={v => sp(2, v)} formatValue={v => fmtMs(v, 200, 0.1)} showValue themeColor={theme.color} size="md" />
            <Knob label="Release" value={release} onChange={v => sp(3, v)} formatValue={v => fmtMs(v, 2000, 10)} showValue themeColor={theme.color} size="md" />
            <Knob label="Makeup" value={makeup} onChange={v => sp(5, v)} formatValue={v => `+${(v * 24).toFixed(1)}dB`} showValue themeColor={theme.color} size="md" />
            <Knob label="Mix" value={mix} onChange={v => sp(6, v)} formatValue={fmtPct} showValue themeColor={theme.color} size="md" />
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCITER
// ─────────────────────────────────────────────────────────────────────────────
const exciterTypes = [
  { name: 'Tube', color: '#f97316' }, { name: 'Tape', color: '#06b6d4' },
  { name: 'Warm', color: '#eab308' }, { name: 'Clip', color: '#ef4444' }, { name: 'Fuzz', color: '#a855f7' },
];

const ExciterEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; channel: any | null }> = ({ p, sp, channel }) => {
  const drive = p[0], freq = p[1], mix = p[2], typeVal = p[3], color = p[4], output = p[5];
  const typeIdx = Math.round(typeVal * 4);
  const theme = exciterTypes[typeIdx];

  const handleDriveDrag = (e: React.MouseEvent) => {
    const startY = e.clientY, startVal = drive;
    const onMove = (mv: MouseEvent) => sp(0, Math.max(0, Math.min(1, startVal + (startY - mv.clientY) / 200)));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex justify-center">
        <PillGroup options={exciterTypes.map(t => t.name)} value={typeIdx} onChange={i => sp(3, i / 4)} color={theme.color} />
      </div>
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Drive column */}
        <Card className="flex flex-col items-center justify-center p-6 gap-4 w-52 flex-shrink-0" glow={theme.color}>
          {/* FFT spectrum from plugin — real data only */}
          {channel && channel.fftBands && channel.fftBands.length > 0 ? (
            <div className="w-full">
              <div className="text-[9px] font-black tracking-widest uppercase text-white/30 text-center mb-2">Spectrum</div>
              <div className="flex items-end gap-[2px] h-12 w-full">
                {(channel.fftBands as number[]).filter((_: number, i: number) => i % 3 === 0).map((db: number, i: number) => {
                  const h = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
                  return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: theme.color, opacity: 0.6 + h / 250 }} />;
                })}
              </div>
            </div>
          ) : <NoSignal label="spectrum" />}

          {/* Drive knob */}
          <div className="relative w-28 h-28 rounded-full cursor-ns-resize flex items-center justify-center"
            onMouseDown={handleDriveDrag} onDoubleClick={() => sp(0, 0)}
            style={{ background: `radial-gradient(circle at 35% 30%, #2a2d3d, #0d0e14)`, boxShadow: `0 0 ${20 + drive * 50}px ${theme.color}${Math.round(drive * 60 + 20).toString(16).padStart(2,'0')}, 0 4px 16px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.06)`, border: `2px solid ${theme.color}${Math.round(drive * 50 + 15).toString(16).padStart(2,'0')}` }}>
            <div className="absolute inset-4 rounded-full" style={{ background: `radial-gradient(circle, ${theme.color}${Math.round(drive * 40).toString(16).padStart(2,'0')}, transparent)` }} />
            <div className="relative z-10 flex flex-col items-center">
              <div className="text-2xl font-black font-mono" style={{ color: theme.color, textShadow: `0 0 12px ${theme.color}` }}>{Math.round(drive * 100)}</div>
              <div className="text-[8px] font-bold tracking-widest text-white/40 uppercase">Drive%</div>
            </div>
          </div>
        </Card>
        {/* Controls */}
        <Card className="flex-1 flex flex-col justify-center p-6 gap-6" glow={theme.color}>
          <div className="flex justify-around">
            <Knob label="Frequency" value={freq} onChange={v => sp(1, v)} formatValue={fmtFreq} showValue themeColor={theme.color} size="lg" />
            <Knob label="Color" value={color} onChange={v => sp(4, v)} formatValue={fmtPct} showValue themeColor={theme.color} size="lg" />
          </div>
          <Divider />
          <div className="flex justify-around items-center">
            <Knob label="Mix" value={mix} onChange={v => sp(2, v)} formatValue={fmtPct} showValue themeColor={theme.color} size="md" />
            <Knob label="Output" value={output} onChange={v => sp(5, v)} formatValue={v => { const db = (v - 0.5) * 36; return `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`; }} showValue themeColor={theme.color} size="md" />
            <div className="flex flex-col items-center gap-2">
              <PowerButton active={p[6] > 0.5} color="#ef4444" onClick={() => sp(6, p[6] > 0.5 ? 0 : 1)} />
              <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider">Limit</span>
            </div>
          </div>
          {/* Real output meter */}
          {channel ? <VuMeter orientation="horizontal" segments={28} className="w-full" rmsL={channel.rmsL} rmsR={channel.rmsR} />
                   : <NoSignal label="output meter" />}
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIMITER — real GR from plugin
// ─────────────────────────────────────────────────────────────────────────────
const LimiterEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; channel: any | null }> = ({ p, sp, channel }) => {
  const thresh = p[0], ceil = p[1], release = p[2];
  const modeIdx = Math.round(p[3] * 3);
  const color = '#00e5ff';

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex justify-center">
        <PillGroup options={['Transparent','Balanced','Aggressive','IRC']} value={modeIdx} onChange={i => sp(3, i / 3)} color={color} />
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Real meter area */}
        <Card className="flex-1 flex flex-col p-4 gap-3" glow={color}>
          <div className="text-[9px] font-black tracking-widest uppercase text-white/30 text-center">Gain Reduction</div>
          {channel ? (
            <>
              {/* Real FFT as waveform bar display */}
              <div className="flex-1 bg-black/40 rounded-xl border border-white/[0.04] overflow-hidden relative min-h-[80px]">
                <div className="absolute inset-0 flex items-end gap-[2px] px-2 pb-2">
                  {(channel.fftBands as number[]).map((db: number, i: number) => {
                    const h = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
                    return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: color, opacity: 0.5, boxShadow: h > 50 ? `0 0 4px ${color}` : 'none' }} />;
                  })}
                </div>
                <div className="absolute left-0 right-0 border-t border-dashed border-cyan-400/30 pointer-events-none"
                  style={{ top: `${(1 - thresh) * 100}%` }}>
                  <span className="absolute right-2 -top-3 text-[8px] text-cyan-400/50 font-bold">THRESH</span>
                </div>
              </div>
              <GrMeter grDb={channel.gainReduction} color={color} />
              <VuMeter orientation="horizontal" segments={24} className="w-full" rmsL={channel.rmsL} rmsR={channel.rmsR} />
            </>
          ) : <NoSignal label="waiting for plugin signal" />}
        </Card>
        {/* Controls */}
        <Card className="flex flex-col justify-center p-6 gap-6 w-52 flex-shrink-0" glow={color}>
          <Knob label="Threshold" value={thresh} onChange={v => sp(0, v)} formatValue={v => `${(v * 60 - 60).toFixed(1)}dBFS`} showValue themeColor={color} size="xl" />
          <div className="flex justify-around">
            <Knob label="Ceiling" value={ceil} onChange={v => sp(1, v)} formatValue={v => `${(v * 3 - 3).toFixed(2)}dBTP`} showValue themeColor={color} size="md" />
            <Knob label="Release" value={release} onChange={v => sp(2, v)} formatValue={v => fmtMs(v, 1000, 10)} showValue themeColor={color} size="md" />
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REVERB
// ─────────────────────────────────────────────────────────────────────────────
const ReverbEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; channel: any | null }> = ({ p, sp, channel }) => {
  const size = p[0], damp = p[1], wet = p[2], dry = p[3], width = p[4], freeze = p[5];
  const color = '#7c3aed';
  const isFreeze = freeze > 0.5;

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex-1 flex gap-3 min-h-0">
        <Card className="flex-1 flex flex-col p-4 gap-3" glow={color}>
          <div className="text-[9px] font-black tracking-widest uppercase text-white/30 text-center">Stereo Field</div>
          {channel ? (
            <>
              {/* Real stereo correlation */}
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-white/30 font-bold w-16">Correlation</span>
                <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.04] relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-white/20" />
                  </div>
                  <div className="h-full rounded-full transition-all duration-150 absolute"
                    style={{ width: `${((channel.correlation + 1) / 2) * 100}%`, left: 0, background: `linear-gradient(90deg, ${color}44, ${color})` }} />
                </div>
                <span className="text-[9px] font-mono text-white/40 w-10 tabular-nums">{channel.correlation.toFixed(2)}</span>
              </div>
              {/* Mid/Side levels */}
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-white/30 font-bold">Mid</span>
                  <VuMeter orientation="vertical" segments={16} className="h-12 w-full" rmsL={channel.midLevel} rmsR={channel.midLevel} />
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-white/30 font-bold">Side</span>
                  <VuMeter orientation="vertical" segments={16} className="h-12 w-full" rmsL={channel.sideLevel} rmsR={channel.sideLevel} />
                </div>
              </div>
              {/* Width bar */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/30 font-bold w-8">Width</span>
                <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/[0.04]">
                  <div className="h-full rounded-full" style={{ width: `${width * 100}%`, background: `linear-gradient(90deg, ${color}44, ${color})` }} />
                </div>
                <span className="text-[9px] text-white/40 font-mono w-8">{fmtPct(width)}</span>
              </div>
            </>
          ) : <NoSignal label="waiting for plugin signal" />}
        </Card>
        <Card className="flex flex-col p-5 gap-4 w-64 flex-shrink-0 justify-center" glow={color}>
          <div className="flex justify-around">
            <Knob label="Size" value={size} onChange={v => sp(0, v)} formatValue={v => `${(v * 100).toFixed(0)}%`} showValue themeColor={color} size="lg" />
            <Knob label="Damp" value={damp} onChange={v => sp(1, v)} formatValue={fmtPct} showValue themeColor={color} size="lg" />
          </div>
          <Divider />
          <div className="flex justify-around">
            <Knob label="Wet" value={wet} onChange={v => sp(2, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
            <Knob label="Dry" value={dry} onChange={v => sp(3, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
            <Knob label="Width" value={width} onChange={v => sp(4, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
          </div>
          <div className="flex justify-center">
            <button onClick={() => sp(5, isFreeze ? 0 : 1)}
              className="px-6 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all duration-300"
              style={isFreeze
                ? { borderColor: color, color, background: `${color}22`, boxShadow: `0 0 20px ${color}44` }
                : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', background: 'transparent' }}>
              ❄ Freeze
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELAY
// ─────────────────────────────────────────────────────────────────────────────
const DelayEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; channel: any | null }> = ({ p, sp, channel }) => {
  const timeL = p[0], timeR = p[1], feedback = p[2], mix = p[3];
  const color = '#10b981';

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex-1 flex gap-3 min-h-0">
        <Card className="flex-1 flex flex-col p-4 gap-3" glow={color}>
          <div className="text-[9px] font-black tracking-widest uppercase text-white/30 text-center">Output</div>
          {channel
            ? <VuMeter orientation="horizontal" segments={32} className="w-full" rmsL={channel.rmsL} rmsR={channel.rmsR} />
            : <NoSignal label="waiting for plugin signal" />}
          {/* BPM sync indicator from real plugin data */}
          {channel && channel.bpm > 0 && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-[9px] text-white/30 font-bold">BPM</span>
              <span className="text-[11px] font-mono font-bold" style={{ color }}>{channel.bpm.toFixed(1)}</span>
              <div className={`w-1.5 h-1.5 rounded-full ml-auto ${channel.isPlaying ? 'bg-emerald-400' : 'bg-white/20'}`}
                style={channel.isPlaying ? { boxShadow: '0 0 6px #10b981' } : {}} />
              <span className="text-[9px] text-white/30">{channel.isPlaying ? 'Playing' : 'Stopped'}</span>
            </div>
          )}
        </Card>
        <Card className="flex flex-col p-5 gap-5 w-52 flex-shrink-0 justify-center" glow={color}>
          <Knob label="Time L" value={timeL} onChange={v => sp(0, v)} formatValue={v => fmtMs(v, 1000, 10)} showValue themeColor={color} size="lg" />
          <Knob label="Time R" value={timeR} onChange={v => sp(1, v)} formatValue={v => fmtMs(v, 1000, 10)} showValue themeColor={color} size="lg" />
          <Divider />
          <div className="flex justify-around">
            <Knob label="Feedback" value={feedback} onChange={v => sp(2, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
            <Knob label="Mix" value={mix} onChange={v => sp(3, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHORUS / FLANGER
// ─────────────────────────────────────────────────────────────────────────────
const ModulationEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; isFlanger: boolean; channel: any | null }> = ({ p, sp, isFlanger, channel }) => {
  const rate = p[0], depth = p[1], delayOrFreq = p[2], feedback = p[3], mix = p[4];
  const color = isFlanger ? '#f59e0b' : '#a78bfa';

  // LFO shape — derived from real params, no random
  const lfoPath = (() => {
    let d = '';
    for (let x = 0; x <= 400; x += 4) {
      const phase = (x / 400) * Math.PI * 4 * (0.2 + rate * 0.8);
      const y = 40 - Math.sin(phase) * depth * 35;
      d += x === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
    }
    return d;
  })();

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex-1 flex gap-3 min-h-0">
        <Card className="flex-1 flex flex-col p-4 gap-3" glow={color}>
          <div className="text-[9px] font-black tracking-widest uppercase text-white/30 text-center">
            LFO — {isFlanger ? 'Flanger' : 'Chorus'}
          </div>
          {/* LFO shape — computed from real params, no Math.random */}
          <div className="flex-1 bg-black/40 rounded-xl border border-white/[0.04] overflow-hidden relative min-h-[60px]">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none">
              <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <path d={lfoPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 5px ${color}88)` }} />
            </svg>
          </div>
          {/* Real output levels */}
          {channel
            ? <VuMeter orientation="horizontal" segments={28} className="w-full" rmsL={channel.rmsL} rmsR={channel.rmsR} />
            : <NoSignal label="waiting for plugin signal" />}
        </Card>
        <Card className="flex flex-col p-5 gap-5 w-64 flex-shrink-0 justify-center" glow={color}>
          <div className="flex justify-around">
            <Knob label="Rate" value={rate} onChange={v => sp(0, v)} formatValue={v => `${(0.05 + v * 9.95).toFixed(2)}Hz`} showValue themeColor={color} size="lg" />
            <Knob label="Depth" value={depth} onChange={v => sp(1, v)} formatValue={fmtPct} showValue themeColor={color} size="lg" />
          </div>
          <Divider />
          <div className="flex justify-around">
            <Knob label={isFlanger ? 'Freq' : 'Delay'} value={delayOrFreq} onChange={v => sp(2, v)} formatValue={v => isFlanger ? fmtFreq(v) : fmtMs(v, 40, 1)} showValue themeColor={color} size="md" />
            <Knob label="Feedback" value={feedback} onChange={v => sp(3, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
            <Knob label="Mix" value={mix} onChange={v => sp(4, v)} formatValue={fmtPct} showValue themeColor={color} size="md" />
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC (Limiter/Reverb/Delay/Chorus/Flanger fallthrough for params display)
// ─────────────────────────────────────────────────────────────────────────────
const GenericEditor: React.FC<{ p: number[]; sp: (i: number, v: number) => void; slotType: number; channel: any | null }> = ({ p, sp, slotType, channel }) => {
  const color = '#5B7CF6';
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="p-8 flex flex-wrap gap-8 justify-center" glow={color}>
        {slotType === 4 && (<><Knob label="Thresh" value={p[0]} onChange={v=>sp(0,v)} showValue themeColor={color} size="md" /><Knob label="Ceil" value={p[1]} onChange={v=>sp(1,v)} showValue themeColor={color} size="md" /><Knob label="Release" value={p[2]} onChange={v=>sp(2,v)} showValue themeColor={color} size="md" /><Knob label="Mode" value={p[3]} onChange={v=>sp(3,v)} step={1} showValue themeColor={color} size="md" /></>)}
        {slotType === 5 && (<><Knob label="Size" value={p[0]} onChange={v=>sp(0,v)} showValue themeColor={color} size="md" /><Knob label="Damp" value={p[1]} onChange={v=>sp(1,v)} showValue themeColor={color} size="md" /><Knob label="Width" value={p[4]} onChange={v=>sp(4,v)} showValue themeColor={color} size="md" /><Knob label="Wet" value={p[2]} onChange={v=>sp(2,v)} showValue themeColor={color} size="md" /><Knob label="Dry" value={p[3]} onChange={v=>sp(3,v)} showValue themeColor={color} size="md" /></>)}
        {slotType === 6 && (<><Knob label="Time L" value={p[0]} onChange={v=>sp(0,v)} showValue themeColor={color} size="md" /><Knob label="Time R" value={p[1]} onChange={v=>sp(1,v)} showValue themeColor={color} size="md" /><Knob label="Feedback" value={p[2]} onChange={v=>sp(2,v)} showValue themeColor={color} size="md" /><Knob label="Mix" value={p[3]} onChange={v=>sp(3,v)} showValue themeColor={color} size="md" /></>)}
        {(slotType === 7 || slotType === 8) && (<><Knob label="Rate" value={p[0]} onChange={v=>sp(0,v)} showValue themeColor={color} size="md" /><Knob label="Depth" value={p[1]} onChange={v=>sp(1,v)} showValue themeColor={color} size="md" /><Knob label="Delay" value={p[2]} onChange={v=>sp(2,v)} showValue themeColor={color} size="md" /><Knob label="Feedback" value={p[3]} onChange={v=>sp(3,v)} showValue themeColor={color} size="md" /><Knob label="Mix" value={p[4]} onChange={v=>sp(4,v)} showValue themeColor={color} size="md" /></>)}
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL DSP EDITOR
// ─────────────────────────────────────────────────────────────────────────────
export const DspEditor: React.FC = () => {
  const activeSlotIdx = useVstStore(s => s.activeSlotIdx);
  const slots = useVstStore(s => s.slots);
  const setParam = useVstStore(s => s.setSlotParam);
  const channels = useAppStore(s => s.channels);
  const bridgeConnected = useAppStore(s => s.isBridgeConnected);

  const slot = slots[activeSlotIdx];
  if (!slot) return null;

  const p  = slot.p || Array(20).fill(0.5);
  const sp = (idx: number, val: number) => setParam(activeSlotIdx, idx, val);

  // Always use the most recently updated active channel
  const activeChannel = bridgeConnected && channels.length > 0
    ? channels.reduce((best, ch) => ch.lastUpdate > best.lastUpdate ? ch : best, channels[0])
    : null;

  const effectMeta: Record<number, { label: string; color: string }> = {
    1: { label: 'Equalizer',  color: '#00c8ff' },
    2: { label: 'Compressor', color: '#ef4444' },
    3: { label: 'Exciter',    color: '#f97316' },
    4: { label: 'Limiter',    color: '#00e5ff' },
    5: { label: 'Reverb',     color: '#7c3aed' },
    6: { label: 'Delay',      color: '#10b981' },
    7: { label: 'Chorus',     color: '#a78bfa' },
    8: { label: 'Flanger',    color: '#f59e0b' },
  };

  if (slot.type === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
        <div className="text-sm font-bold tracking-widest text-white/20 uppercase">Empty Slot</div>
        <div className="text-xs text-white/10">Select an effect from the chain above</div>
      </div>
    );
  }

  const meta = effectMeta[slot.type] || { label: 'Effect', color: '#5B7CF6' };

  const renderEditor = () => {
    switch (slot.type) {
      case 1: return <EqEditor p={p} sp={sp} />;
      case 2: return <CompressorEditor p={p} sp={sp} channel={activeChannel} />;
      case 3: return <ExciterEditor p={p} sp={sp} channel={activeChannel} />;
      case 4: return <LimiterEditor p={p} sp={sp} channel={activeChannel} />;
      case 5: return <ReverbEditor p={p} sp={sp} channel={activeChannel} />;
      case 6: return <DelayEditor p={p} sp={sp} channel={activeChannel} />;
      case 7: return <ModulationEditor p={p} sp={sp} isFlanger={false} channel={activeChannel} />;
      case 8: return <ModulationEditor p={p} sp={sp} isFlanger={true}  channel={activeChannel} />;
      default: return <GenericEditor p={p} sp={sp} slotType={slot.type} channel={activeChannel} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.color}08 0%, transparent 65%)` }} />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2.5 border-b border-white/[0.05] bg-black/20 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: meta.color }}>{meta.label}</span>
        </div>

        {/* Bridge channel info — real only */}
        {activeChannel && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #10b981' }} />
            <span className="text-[10px] font-bold text-white/60">{activeChannel.displayName || 'MixMind Bridge'}</span>
            {activeChannel.sampleRate > 0 && (
              <span className="text-[9px] text-white/30 font-mono">{(activeChannel.sampleRate / 1000).toFixed(0)}kHz</span>
            )}
          </div>
        )}

        {/* Real-time LUFS from plugin */}
        {activeChannel && activeChannel.lufsM > -99 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold" style={{ color: meta.color }}>
              {activeChannel.lufsM.toFixed(1)}
            </span>
            <span className="text-[9px] text-white/30">LUFS</span>
          </div>
        )}

        {/* Real level bars from plugin — only if fresh data */}
        {activeChannel && activeChannel.fresh && (
          <div className="flex items-center gap-2 ml-auto">
            <VuMeter orientation="horizontal" segments={18} className="w-28"
              rmsL={activeChannel.rmsL} rmsR={activeChannel.rmsR} />
          </div>
        )}

        {/* Bridge disconnected indicator */}
        {!activeChannel && (
          <div className="ml-auto flex items-center gap-2 text-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="text-[9px] font-bold">No plugin connected</span>
          </div>
        )}

        <div className="text-[10px] font-bold text-white/20 ml-auto">SLOT {activeSlotIdx + 1}</div>
      </div>

      {/* Editor content */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        {renderEditor()}
      </div>
    </div>
  );
};
