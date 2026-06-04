import React from 'react';

interface MeterProps {
  value: number; // typically -60 to 0 dB
  min?: number;
  max?: number;
  height?: number;
  width?: number;
}

export const Meter: React.FC<MeterProps> = ({ 
  value, 
  min = -60, 
  max = 0, 
  height = 120,
  width = 12 
}) => {
  const percent = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <div 
      className="relative bg-slate-950 rounded border border-slate-800 overflow-hidden shadow-inner"
      style={{ height, width }}
    >
      {/* Scale markers */}
      <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between py-1 z-0 opacity-20 pointer-events-none">
        <div className="h-px bg-white w-full" />
        <div className="h-px bg-white w-full" />
        <div className="h-px bg-white w-full" />
        <div className="h-px bg-white w-full" />
      </div>

      {/* Fill */}
      <div 
        className="absolute bottom-0 left-0 right-0 transition-all duration-75 ease-out z-10"
        style={{ 
          height: `${percent * 100}%`,
          background: `linear-gradient(to top, #3b82f6 0%, #22c55e 60%, #eab308 85%, #ef4444 100%)`
        }}
      />
    </div>
  );
};
