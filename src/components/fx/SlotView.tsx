import React from 'react';
import { useVstStore } from '../../store/useVstStore';
import { Knob } from '../ui/Knob';
import { LedButton } from '../ui/LedButton';

interface SlotViewProps {
  slotIdx: number;
}

export const SlotView: React.FC<SlotViewProps> = ({ slotIdx }) => {
  const slot = useVstStore(s => s.slots[slotIdx]);
  const setType = useVstStore(s => s.setSlotType);
  const setBypass = useVstStore(s => s.setSlotBypass);
  const setParallel = useVstStore(s => s.setSlotParallel);
  const setParam = useVstStore(s => s.setSlotParam);

  const fxTypes = [
    'Empty', 'EQ', 'Compressor', 'Exciter', 'Limiter', 'Reverb', 'Delay', 'Chorus', 'Flanger'
  ];

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setType(slotIdx, parseInt(e.target.value));
  };

  const renderParams = () => {
    const p = slot.p;
    const sp = (idx: number, val: number) => setParam(slotIdx, idx, val);

    switch (slot.type) {
      case 1: // EQ
        return (
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-4">
              <div className="text-xs text-slate-400 text-center font-bold">HPF</div>
              <Knob label="Freq" value={p[1]} onChange={v=>sp(1,v)} />
              <Knob label="Slope" value={p[2]} onChange={v=>sp(2,v)} />
            </div>
            <div className="space-y-4">
              <div className="text-xs text-slate-400 text-center font-bold">Low</div>
              <Knob label="Freq" value={p[3]} onChange={v=>sp(3,v)} />
              <Knob label="Gain" value={p[4]} onChange={v=>sp(4,v)} />
            </div>
            <div className="space-y-4">
              <div className="text-xs text-slate-400 text-center font-bold">Mid</div>
              <Knob label="Freq" value={p[8]} onChange={v=>sp(8,v)} />
              <Knob label="Gain" value={p[9]} onChange={v=>sp(9,v)} />
              <Knob label="Q" value={p[10]} onChange={v=>sp(10,v)} />
            </div>
            <div className="space-y-4">
              <div className="text-xs text-slate-400 text-center font-bold">High</div>
              <Knob label="Freq" value={p[14]} onChange={v=>sp(14,v)} />
              <Knob label="Gain" value={p[15]} onChange={v=>sp(15,v)} />
            </div>
            <div className="space-y-4">
              <div className="text-xs text-slate-400 text-center font-bold">LPF</div>
              <Knob label="Freq" value={p[17]} onChange={v=>sp(17,v)} />
              <Knob label="Slope" value={p[18]} onChange={v=>sp(18,v)} />
            </div>
          </div>
        );
      case 2: // Compressor
        return (
          <div className="grid grid-cols-4 gap-4">
             <Knob label="Thresh" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Ratio" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label="Attack" value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Release" value={p[3]} onChange={v=>sp(3,v)} />
             <Knob label="Makeup" value={p[5]} onChange={v=>sp(5,v)} />
             <Knob label="Mix" value={p[6]} onChange={v=>sp(6,v)} />
             <Knob label="Type" value={p[7]} onChange={v=>sp(7,v)} step={0.333} />
          </div>
        );
      case 3: // Exciter
        return (
          <div className="grid grid-cols-4 gap-4">
             <Knob label="Drive" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Freq" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label="Mix" value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Type" value={p[3]} onChange={v=>sp(3,v)} step={0.25} />
          </div>
        );
      case 4: // Limiter
        return (
          <div className="grid grid-cols-4 gap-4">
             <Knob label="Thresh" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Ceil" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label="Release" value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Mode" value={p[3]} onChange={v=>sp(3,v)} step={1} />
          </div>
        );
      case 5: // Reverb
        return (
          <div className="grid grid-cols-3 gap-4">
             <Knob label="Size" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Damp" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label="Width" value={p[4]} onChange={v=>sp(4,v)} />
             <Knob label="Wet" value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Dry" value={p[3]} onChange={v=>sp(3,v)} />
             <Knob label="Freeze" value={p[5]} onChange={v=>sp(5,v)} step={1} />
          </div>
        );
      case 6: // Delay
        return (
          <div className="grid grid-cols-4 gap-4">
             <Knob label="Time L" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Time R" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label="Feedbk" value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Mix" value={p[3]} onChange={v=>sp(3,v)} />
          </div>
        );
      case 7: // Chorus
      case 8: // Flanger
        return (
          <div className="grid grid-cols-5 gap-4">
             <Knob label="Rate" value={p[0]} onChange={v=>sp(0,v)} />
             <Knob label="Depth" value={p[1]} onChange={v=>sp(1,v)} />
             <Knob label={slot.type === 8 ? "Freq" : "Delay"} value={p[2]} onChange={v=>sp(2,v)} />
             <Knob label="Feedbk" value={p[3]} onChange={v=>sp(3,v)} />
             <Knob label="Mix" value={p[4]} onChange={v=>sp(4,v)} />
          </div>
        );
      default:
        return <div className="text-slate-500 italic flex items-center justify-center h-full">Empty Slot</div>;
    }
  };

  return (
    <div className={`p-4 rounded-xl transition-all border ${slot.type === 0 ? 'bg-card border-border' : 'plugin-body border-accent/30 shadow-[0_0_15px_rgba(0,229,255,0.15)]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-text">
            <span className="text-accent mr-2">{slotIdx + 1}</span>
          </div>
          <select 
            value={slot.type}
            onChange={handleTypeChange}
            className="bg-surface border border-border text-text text-sm rounded px-2 py-1 outline-none focus:border-accent focus:shadow-[0_0_10px_rgba(0,229,255,0.2)] appearance-none"
          >
            {fxTypes.map((t, i) => (
              <option key={i} value={i}>{t}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-4">
          {slot.type > 0 && (
            <div className="flex items-center gap-3">
              <LedButton label="Par" active={slot.parallel} color="orange" onClick={() => setParallel(slotIdx, !slot.parallel)} />
              <LedButton label="On" active={!slot.bypass} color="blue" onClick={() => setBypass(slotIdx, !slot.bypass)} />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-[140px] flex items-center justify-center">
        {renderParams()}
      </div>
    </div>
  );
};
