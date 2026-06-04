import React from 'react';

interface VuMeterProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
  segments?: number;
  /** Real RMS level in dBFS (-100..0). Required — no fake animation. */
  rmsL?: number;
  rmsR?: number;
}

const dbToPercent = (db: number) => Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

export const VuMeter: React.FC<VuMeterProps> = ({
  orientation = 'horizontal',
  label,
  className = '',
  segments = 24,
  rmsL,
  rmsR,
}) => {
  // If no real data provided — render empty state (no animation, no random)
  const levelL = rmsL !== undefined ? dbToPercent(rmsL) : 0;
  const levelR = rmsR !== undefined ? dbToPercent(rmsR) : 0;
  const hasData = rmsL !== undefined && rmsR !== undefined;

  const isHorizontal = orientation === 'horizontal';

  const renderChannel = (level: number) => (
    <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col-reverse'} gap-[2px] w-full h-full`}>
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = (i / segments) * 100;
        const isActive = hasData && level > threshold;

        let baseColor = '#10b981';
        let glowColor = 'rgba(16, 185, 129, 0.6)';
        if (i >= segments * 0.9)  { baseColor = '#ef4444'; glowColor = 'rgba(239, 68, 68, 0.7)'; }
        else if (i >= segments * 0.75) { baseColor = '#f59e0b'; glowColor = 'rgba(245, 158, 11, 0.6)'; }

        return (
          <div
            key={i}
            className={`rounded-[1px] ${isHorizontal ? 'flex-1 h-full' : 'w-full flex-1'}`}
            style={{
              backgroundColor: isActive ? baseColor : 'rgba(255,255,255,0.03)',
              boxShadow: isActive ? `0 0 3px ${glowColor}` : 'none',
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase text-center">{label}</div>}
      <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} gap-[3px] p-1.5 bg-black/60 rounded-md border border-white/[0.04] shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]`}>
        {renderChannel(levelL)}
        {renderChannel(levelR)}
      </div>
    </div>
  );
};
