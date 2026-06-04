import React, { useState, useRef, useEffect, MouseEvent } from 'react';

interface FaderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  formatValue?: (val: number) => string;
  height?: number;
}

export const Fader: React.FC<FaderProps> = ({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  formatValue = (v) => v.toFixed(2),
  height = 120
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const percent = (value - min) / (max - min);

  const updateValueFromEvent = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    // Invert Y: bottom is 0%, top is 100%
    const y = rect.bottom - clientY;
    let p = y / rect.height;
    p = Math.max(0, Math.min(1, p));
    
    let newVal = min + p * (max - min);
    if (step > 0) {
      newVal = Math.round(newVal / step) * step;
    }
    
    onChange(newVal);
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) return;
      updateValueFromEvent(e.clientY);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, max, min, step, onChange]);

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    updateValueFromEvent(e.clientY);
  };

  const handleDoubleClick = () => {
    const defaultVal = min < 0 && max > 0 ? 0 : min;
    onChange(defaultVal);
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none group">
      <div className="text-xs text-slate-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 min-w-[36px] text-center">
        {formatValue(value)}
      </div>
      
      <div 
        ref={trackRef}
        className="relative w-8 bg-slate-950 rounded-lg shadow-inner cursor-ns-resize overflow-hidden border border-slate-800"
        style={{ height }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Track center line */}
        <div className="absolute left-1/2 top-1 bottom-1 w-0.5 bg-slate-800 -translate-x-1/2 z-0" />
        
        {/* Fill */}
        <div 
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-900 to-blue-500 opacity-20 z-0 pointer-events-none transition-all duration-75"
          style={{ height: `${percent * 100}%` }}
        />
        
        {/* Handle */}
        <div 
          className={`absolute left-0.5 right-0.5 h-6 bg-slate-700 rounded border border-slate-500 shadow-md z-10 transition-shadow ${isDragging ? 'shadow-[0_0_8px_rgba(59,130,246,0.6)] border-blue-400' : 'group-hover:border-slate-400'}`}
          style={{ bottom: `calc(${percent * 100}% - 12px)` }}
        >
          <div className="absolute top-1/2 left-1 right-1 h-0.5 bg-slate-400 -translate-y-1/2 rounded" />
        </div>
      </div>
      
      <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{label}</div>
    </div>
  );
};
