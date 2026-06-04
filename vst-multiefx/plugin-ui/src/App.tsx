import React, { useState, useRef, useEffect, memo } from 'react';
import { useJuceSlider, useJuceComboBox, useJuceToggle } from './hooks/useJuce';

const getTypeLabel = (type: number) => {
  switch (type) {
    case 1: return 'EQ';
    case 2: return 'Comp';
    case 3: return 'Exc';
    case 4: return 'Lim';
    default: return '---';
  }
};

const DUMMY_PRESETS = [
  { category: "Mastering", names: ["Clean Push", "Aggressive Limit", "Warm Tape", "Acoustic Polish"] },
  { category: "Drums", names: ["Punchy Kick", "Snare Crack", "Drum Bus Glue"] },
  { category: "Vocals", names: ["Airy Pop Vocal", "Thick Rock Vocal", "De-Ess & Comp"] },
];

const ROUTING_MODES = ["STEREO", "DUAL MONO", "MID / SIDE"];

const Slot = memo(({ index }: { index: number }) => {
  const [type, setType] = useJuceComboBox(`slot${index}_type`, index <= 4 ? index : 0);
  const [bypass, setBypass] = useJuceToggle(`slot${index}_bypass`, false);

  const isActive = type > 0 && !bypass;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={() => { if(type > 0) setBypass(!bypass); }}>
      <span className="text-[9px] text-slate-600 font-bold">{index}</span>
      <div className={`w-14 h-12 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300
        ${isActive 
          ? 'border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.4),inset_0_0_5px_rgba(0,229,255,0.2)] bg-[#0a121a] group-hover:bg-[#0d1822] group-hover:shadow-[0_0_15px_rgba(0,229,255,0.6)]' 
          : type > 0 
            ? 'border border-[#FF0055]/50 text-[#FF0055]/50 bg-[#120a0d] shadow-[0_0_5px_rgba(255,0,85,0.2)]'
            : 'border border-slate-800 text-slate-700 bg-[#0b0e14] group-hover:border-slate-700 group-hover:bg-[#11161d]'}`}>
        
        {type === 1 && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M5 12a5 5 0 0110 0M19 12a5 5 0 01-10 0" /></svg>}
        {type === 2 && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12V8m0 8v-4m8 4V8m0 8v-4m8 4V8m0 8v-4" /></svg>}
        {type === 3 && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        {type === 4 && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 12H6" /></svg>}
        {type === 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>}
      </div>
      <span className={`text-[9px] font-bold tracking-[0.1em] transition-colors ${isActive ? 'text-slate-300' : 'text-slate-700'}`}>
        {getTypeLabel(type)}
      </span>
    </div>
  );
});

const Knob = memo(({ paramId, label, defaultVal }: { paramId: string, label: string, defaultVal: number }) => {
  const [val, setVal] = useJuceSlider(paramId, defaultVal);
  const knobRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    
    let isDragging = false;
    let startY = 0;
    let startVal = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startY = e.clientY;
      startVal = val;
      if(window.juce && window.juce.getSliderState) {
        window.juce.getSliderState(paramId)?.sliderDragStarted();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dy = startY - e.clientY;
      let newVal = startVal + (dy * 0.005);
      newVal = Math.max(0, Math.min(1, newVal));
      setVal(newVal);
    };
    const onMouseUp = () => {
      if(isDragging) {
        if(window.juce && window.juce.getSliderState) {
          window.juce.getSliderState(paramId)?.sliderDragEnded();
        }
      }
      isDragging = false;
    };

    knob.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    return () => {
      knob.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [val, setVal, paramId]);

  return (
    <div className="w-28 flex flex-col items-center justify-center gap-4">
      <div className="relative w-24 h-24 cursor-ns-resize" ref={knobRef}>
        <div className="absolute inset-0 rounded-full bg-[#00E5FF] blur-md opacity-20"></div>
        <div className="absolute inset-1 rounded-full bg-gradient-to-b from-[#1e2430] to-[#0a0c10] border border-slate-700 flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
          <div className="w-14 h-14 rounded-full bg-gradient-to-t from-[#151921] to-[#1e2430] shadow-inner"></div>
          <div 
            className="absolute top-2 w-[3px] h-4 bg-[#00E5FF] rounded-full shadow-[0_0_8px_#00E5FF]" 
            style={{ transform: `rotate(${(val - 0.5) * 270}deg)`, transformOrigin: 'center 38px' }}
          ></div>
        </div>
      </div>
      <span className="text-[10px] tracking-[0.2em] text-slate-400 font-bold">{label}</span>
    </div>
  );
});

// Memoized Fake Meter so it doesn't re-render constantly
const Meter = memo(({ routingMode }: { routingMode: number }) => {
  return (
    <div className="flex-1 rounded-[50px] border border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3),inset_0_0_10px_rgba(0,229,255,0.1)] bg-[#07090d] relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute top-3 text-[9px] text-slate-500 font-bold tracking-[0.2em]">
        {routingMode === 2 ? 'MID / SIDE' : 'LEFT / RIGHT'}
      </div>
      <div className="flex items-end h-full gap-[3px] pt-4 w-full justify-center opacity-90">
          {Array.from({length: 40}).map((_, i) => {
            const height = 15 + Math.sin(i * 0.4) * 30 + Math.random() * 45;
            // Visual gap for dual mono / MS
            if (i === 20) return <div key={i} className="w-4" />;
            return (
              <div key={i} className="w-2 rounded-t-sm" style={{ 
                height: `${height}%`,
                background: height > 75 ? `linear-gradient(to top, #00E5FF, #FF0055)` : `linear-gradient(to top, #00E5FF, #0077FF)`
              }}/>
            )
          })}
      </div>
    </div>
  );
});

export default function App() {
  const [isPresetBrowserOpen, setIsPresetBrowserOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState("CLEAN PUSH");
  
  const [monoSwitch, setMonoSwitch] = useJuceToggle('mono_switch', false);
  const [globalBypass, setGlobalBypass] = useJuceToggle('global_bypass', false);
  const [routingMode, setRoutingMode] = useJuceComboBox('routing_mode', 0);

  const [uiScaleIdx, setUiScaleIdx] = useJuceComboBox('ui_scale', 1);
  const scaleValues = [0.75, 1.0, 1.25, 1.5, 2.0];
  const scaleLabels = ['75%', '100%', '125%', '150%', '200%'];
  const scale = scaleValues[uiScaleIdx] || 1.0;

  const [isScaleMenuOpen, setIsScaleMenuOpen] = useState(false);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-[#05080c] font-sans overflow-hidden">
      <div 
        className="w-[850px] h-[400px] flex flex-col p-5 bg-[#0e1218] rounded-xl border border-slate-800 shadow-[0_0_50px_rgba(0,229,255,0.05)] relative overflow-hidden"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-xl font-bold tracking-[0.2em] text-white">MIXMIND</h1>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsPresetBrowserOpen(!isPresetBrowserOpen)}>
              <span className="text-xs font-semibold text-slate-500 tracking-widest">PRESET:</span>
              <div className="flex items-center gap-1 text-xs font-bold text-[#00E5FF] tracking-widest group-hover:text-white transition-colors">
                {currentPreset}
                <svg className={`w-3 h-3 transition-transform duration-200 ${isPresetBrowserOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 tracking-widest">SCALE:</span>
              <div 
                className="flex items-center gap-1 text-xs font-bold text-[#00E5FF] cursor-pointer hover:text-white transition-colors tracking-widest"
                onClick={() => setIsScaleMenuOpen(!isScaleMenuOpen)}
              >
                {scaleLabels[uiScaleIdx]}
                <svg className={`w-3 h-3 transition-transform duration-200 ${isScaleMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              
              {isScaleMenuOpen && (
                <div className="absolute top-6 left-12 w-24 bg-[#0a0d12] border border-slate-700 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden">
                  {scaleLabels.map((lbl, idx) => (
                    <div 
                      key={idx}
                      className={`px-4 py-2 text-xs font-bold tracking-widest cursor-pointer transition-colors
                        ${idx === uiScaleIdx ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-slate-400 hover:bg-[#1a222d] hover:text-white'}`}
                      onClick={() => { setUiScaleIdx(idx); setIsScaleMenuOpen(false); }}
                    >
                      {lbl}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div 
            className="text-xs font-bold text-slate-400 tracking-widest cursor-pointer hover:text-white transition-colors border border-slate-700 px-3 py-1 rounded-md"
            onClick={() => setRoutingMode((routingMode + 1) % 3)}
          >
            {ROUTING_MODES[routingMode]}
          </div>
        </div>

        {/* Main Section */}
        <div className="flex flex-1 gap-6 mb-6 px-2">
          
          {/* Input Side */}
          <div className="flex flex-col items-center justify-center gap-6">
            <Knob paramId="in_gain" label="INPUT" defaultVal={0.5} />
            <button 
              onClick={() => setMonoSwitch(!monoSwitch)}
              className={`w-16 h-8 rounded-full text-[10px] font-bold tracking-widest transition-all
                ${monoSwitch 
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.4)]' 
                  : 'bg-[#11161d] text-slate-500 border border-slate-800 hover:border-slate-600'}`}
            >
              MONO
            </button>
          </div>

          <Meter routingMode={routingMode} />

          {/* Output Side */}
          <div className="flex flex-col items-center justify-center gap-6">
            <Knob paramId="out_gain" label="OUTPUT" defaultVal={0.5} />
            <button 
              onClick={() => setGlobalBypass(!globalBypass)}
              className={`w-16 h-8 rounded-full text-[10px] font-bold tracking-widest transition-all
                ${globalBypass 
                  ? 'bg-[#FF0055]/20 text-[#FF0055] border border-[#FF0055] shadow-[0_0_10px_rgba(255,0,85,0.4)]' 
                  : 'bg-[#11161d] text-slate-500 border border-slate-800 hover:border-slate-600'}`}
            >
              BYPASS
            </button>
          </div>
        </div>

        {/* Slots Section */}
        <div className="flex justify-between items-end h-20 px-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Slot key={i} index={i} />)}
        </div>

        {/* Preset Browser Overlay */}
        {isPresetBrowserOpen && (
          <div className="absolute inset-0 bg-[#05080c]/90 backdrop-blur-md z-50 flex flex-col p-8 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold tracking-[0.2em] text-[#00E5FF]">PRESET BROWSER</h2>
              <button onClick={() => setIsPresetBrowserOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex gap-12 flex-1 overflow-hidden">
              {DUMMY_PRESETS.map((cat, i) => (
                <div key={i} className="flex-1 flex flex-col gap-4">
                  <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase">{cat.category}</h3>
                  <div className="flex flex-col gap-2">
                    {cat.names.map((name, j) => (
                      <button 
                        key={j}
                        onClick={() => { setCurrentPreset(name.toUpperCase()); setIsPresetBrowserOpen(false); }}
                        className={`text-left px-4 py-3 rounded-lg text-sm tracking-wider font-semibold transition-all
                          ${currentPreset === name.toUpperCase() 
                            ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30' 
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
