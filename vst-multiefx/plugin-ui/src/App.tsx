import { useState, useRef, useEffect, memo } from 'react';
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



const ROUTING_MODES = ["STEREO", "DUAL MONO", "MID / SIDE"];

const Slot = memo(({ index }: { index: number }) => {
  const [type] = useJuceComboBox(`slot${index}_type`, 0);
  const [bypass, setBypass] = useJuceToggle(`slot${index}_bypass`, false);

  if (type === 0) return null;

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
    // We get the current value directly from the slider state to avoid dependency issues
    let startVal = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startY = e.clientY;
      if (window.juce && window.juce.getSliderState) {
          const state = window.juce.getSliderState(paramId);
          if (state) {
              startVal = state.getNormalisedValue();
              state.sliderDragStarted();
          } else {
              startVal = 0.5;
          }
      } else {
          startVal = 0.5;
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
      if (isDragging) {
        if (window.juce && window.juce.getSliderState) {
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
  }, [setVal, paramId]);

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

// Meter Component
const Meter = memo(({ routingMode }: { routingMode: number }) => {
  const [bands, setBands] = useState<number[]>(Array(40).fill(0));
  
  useEffect(() => {
    let animationFrameId: number;
    let isCancelled = false;

    const fetchFft = async () => {
      const getAnalyzerData = (window as any).__JUCE__?.backend?.getAnalyzerData || (window as any).getAnalyzerData;
      if (getAnalyzerData) {
        try {
          const data = await getAnalyzerData();
          if (!isCancelled && data && Array.isArray(data)) {
            // Map 31 bands into the 40 display bars
            const newBands = Array(40).fill(0);
            for (let i = 0; i < 40; i++) {
              if (i === 20) continue; // Gap
              const fftIdx = Math.floor((i / 40) * 31);
              if (fftIdx < data.length) {
                // Convert DB to % height
                const db = data[fftIdx];
                // Suppose -100dB to 0dB range
                let height = ((db + 80) / 80) * 100;
                if (height < 0) height = 0;
                if (height > 100) height = 100;
                newBands[i] = height;
              }
            }
            setBands(newBands);
          }
        } catch(e) {}
      }
      if (!isCancelled) {
        animationFrameId = requestAnimationFrame(fetchFft);
      }
    };

    fetchFft();

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="flex-1 rounded-[50px] border border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3),inset_0_0_10px_rgba(0,229,255,0.1)] bg-[#07090d] relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute top-3 text-[9px] text-slate-500 font-bold tracking-[0.2em]">
        {routingMode === 2 ? 'MID / SIDE' : 'LEFT / RIGHT'}
      </div>
      <div className="flex items-end h-full gap-[3px] pt-4 w-full justify-center opacity-90">
          {bands.map((height, i) => {
            if (i === 20) return <div key={i} className="w-4" />;
            return (
              <div key={i} className="w-2 rounded-t-sm" style={{ 
                height: `${Math.max(2, height)}%`,
                background: height > 75 ? `linear-gradient(to top, #00E5FF, #FF0055)` : `linear-gradient(to top, #00E5FF, #0077FF)`,
                transition: 'height 0.1s ease-out'
              }}/>
            )
          })}
      </div>
    </div>
  );
});

export default function App() {
  const [monoSwitch, setMonoSwitch] = useJuceToggle('mono_switch', false);
  const [globalBypass, setGlobalBypass] = useJuceToggle('global_bypass', false);
  const [routingMode, setRoutingMode] = useJuceComboBox('routing_mode', 0);

  const [uiScaleIdx, setUiScaleIdx] = useJuceComboBox('ui_scale', 1);
  const scaleValues = [0.75, 1.0, 1.25, 1.5, 2.0];
  const scaleLabels = ['75%', '100%', '125%', '150%', '200%'];
  const scale = scaleValues[uiScaleIdx] || 1.0;

  const [isScaleMenuOpen, setIsScaleMenuOpen] = useState(false);

  // New Routing parameters
  const [channelType, setChannelType] = useJuceComboBox('type', 0);
  const [channelIdx, setChannelIdx] = useJuceSlider('channel', 0);
  const CHANNEL_TYPES = ["Instrument", "Vocal", "Drums", "Bass", "Other"];

  return (
    <div className="w-screen h-screen bg-[#05080c] font-sans overflow-hidden flex items-center justify-center" style={{ zoom: scale }}>
      <div 
        className="w-[850px] h-[400px] flex flex-col p-5 bg-[#0e1218] border border-slate-800 shadow-[0_0_50px_rgba(0,229,255,0.05)] relative overflow-hidden rounded-xl"
      >
        
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-xl font-bold tracking-[0.2em] text-white">MIXMIND</h1>
          
          <div className="flex items-center gap-6">

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

          <div className="flex items-center gap-4">
            {/* Routing Controls */}
            <div className="flex items-center gap-3 bg-[#11161d] border border-slate-800 rounded-md px-3 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest">TYPE:</span>
              <select 
                value={channelType} 
                onChange={e => setChannelType(parseInt(e.target.value))}
                className="bg-transparent text-xs font-bold text-[#00E5FF] outline-none cursor-pointer tracking-widest appearance-none"
              >
                {CHANNEL_TYPES.map((t, i) => <option key={i} value={i} className="bg-[#0a0d12] text-white">{t}</option>)}
              </select>
              
              <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>
              
              <span className="text-[10px] font-bold text-slate-500 tracking-widest">CH:</span>
              <input 
                type="number" 
                min={0} max={64} 
                value={Math.round(channelIdx * 64)} 
                onChange={e => setChannelIdx(parseInt(e.target.value) / 64.0)}
                className="w-8 bg-transparent text-xs font-bold text-[#FF0055] outline-none text-center"
              />
            </div>

            <div 
              className="text-xs font-bold text-slate-400 tracking-widest cursor-pointer hover:text-white transition-colors border border-slate-700 px-3 py-1.5 rounded-md"
              onClick={() => setRoutingMode((routingMode + 1) % 3)}
            >
              {ROUTING_MODES[routingMode]}
            </div>
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
        <div className="flex justify-center items-end h-20 px-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Slot key={i} index={i} />)}
        </div>

        {/* Preset Browser Overlay Removed */}

      </div>
    </div>
  );
}
