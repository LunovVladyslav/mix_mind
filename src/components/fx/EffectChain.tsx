import React, { useState } from 'react';
import { useVstStore } from '../../store/useVstStore';
import { LedButton } from '../ui/LedButton';

const fxTypes = [
  'Empty', 'EQ', 'Compressor', 'Exciter', 'Limiter', 'Reverb', 'Delay', 'Chorus', 'Flanger'
];

export const EffectChain: React.FC = () => {
  const slots = useVstStore(s => s.slots);
  const activeSlotIdx = useVstStore(s => s.activeSlotIdx);
  const setActiveSlotIdx = useVstStore(s => s.setActiveSlotIdx);
  const reorderSlots = useVstStore(s => s.reorderSlots);
  const setType = useVstStore(s => s.setSlotType);
  const setBypass = useVstStore(s => s.setSlotBypass);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  if (!slots) return null;

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires some data to be set
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      reorderSlots(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handleDragEnter = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
  };

  const visibleSlots = slots.filter(s => s.type !== 0);
  const nextEmptyIdx = slots.findIndex(s => s.type === 0);

  const addSlot = () => {
    if (nextEmptyIdx !== -1) {
      setType(nextEmptyIdx, 1); // default to EQ
      setActiveSlotIdx(nextEmptyIdx);
    }
  };

  return (
    <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-border overflow-x-auto min-h-[90px]">
      
      {/* Compact IN GAIN */}
      <div className="flex flex-col items-center gap-1 border-r border-border pr-4">
        <div className="text-[9px] font-bold tracking-widest text-muted">IN</div>
        <div className="w-16">
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            value={useVstStore(s => s.inGain)}
            onChange={(e) => useVstStore.getState().setInGain(parseFloat(e.target.value))}
            className="w-full accent-accent h-1 bg-panel rounded-full appearance-none"
          />
        </div>
      </div>

      {/* Slots */}
      <div className="flex gap-2 flex-1">
        {slots.map((slot, idx) => {
          // Only show active slots, or empty slots if they are selected
          if (slot.type === 0 && activeSlotIdx !== idx) return null;

          const isActive = activeSlotIdx === idx;
          const isEmpty = slot.type === 0;

          return (
            <div
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnter={(e) => handleDragEnter(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveSlotIdx(idx)}
              className={`
                flex flex-col flex-shrink-0 w-28 h-16 rounded-lg border cursor-grab active:cursor-grabbing transition-all select-none
                ${isActive ? 'border-accent shadow-[0_0_15px_rgba(0,229,255,0.2)] bg-card' : 'border-border bg-panel hover:border-accent/50'}
                ${draggedIdx === idx ? 'opacity-50 border-dashed' : 'opacity-100'}
              `}
            >
              {/* Slot Header */}
              <div className={`flex items-center justify-between px-2 py-1 border-b ${isActive ? 'border-accent/30' : 'border-border'}`}>
                <span className={`text-[10px] font-black ${isActive ? 'text-accent' : 'text-muted'}`}>
                  {idx + 1}
                </span>
                {!isEmpty && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <LedButton 
                      label="" 
                      active={!slot.bypass} 
                      color="blue" 
                      onClick={() => setBypass(idx, !slot.bypass)} 
                    />
                  </div>
                )}
              </div>
              
              {/* Slot Body */}
              <div className="flex-1 flex items-center justify-center px-1">
                <select 
                  value={slot.type}
                  onChange={(e) => {
                    e.stopPropagation();
                    setType(idx, parseInt(e.target.value));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    w-full bg-transparent border-none outline-none appearance-none text-center text-[11px] font-semibold tracking-wider
                    ${isEmpty ? 'text-muted italic' : 'text-text'}
                  `}
                >
                  {fxTypes.map((t, i) => (
                    <option key={i} value={i} className="bg-panel text-text">{t}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Add Slot Button */}
        {nextEmptyIdx !== -1 && (
          <button 
            onClick={addSlot}
            className="w-12 h-16 flex items-center justify-center rounded-lg border border-dashed border-border bg-panel/50 hover:bg-card hover:border-accent/50 text-muted hover:text-accent transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        )}
      </div>

      {/* Compact OUT GAIN */}
      <div className="flex flex-col items-center gap-1 border-l border-border pl-4">
        <div className="text-[9px] font-bold tracking-widest text-muted">OUT</div>
        <div className="w-16">
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            value={useVstStore(s => s.outGain)}
            onChange={(e) => useVstStore.getState().setOutGain(parseFloat(e.target.value))}
            className="w-full accent-accent h-1 bg-panel rounded-full appearance-none"
          />
        </div>
      </div>

    </div>
  );
};
