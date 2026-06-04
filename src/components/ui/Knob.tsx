import React, { useState, useRef, useEffect, MouseEvent } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  formatValue?: (val: number) => string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showValue?: boolean;
  themeColor?: string;
}

export const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  min = 0, 
  max = 1, 
  step = 0.01, 
  onChange,
  formatValue = (v) => v.toFixed(2),
  size = 'md',
  showValue = false,
  themeColor = '#5B7CF6'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const percent = Math.max(0, Math.min(1, (value - min) / (max - min)));

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = startY.current - e.clientY;
      const deltaVal = (deltaY / 100) * (max - min);
      let newVal = startVal.current + deltaVal;
      
      if (step > 0) newVal = Math.round(newVal / step) * step;
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
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
    startY.current = e.clientY;
    startVal.current = value;
  };

  const handleDoubleClick = () => {
    const defaultVal = min < 0 && max > 0 ? 0 : min;
    onChange(defaultVal);
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
  };

  const pointerClasses = {
    sm: 'w-[1.5px] h-2.5 mt-[2px]',
    md: 'w-[2px] h-3.5 mt-1',
    lg: 'w-[2.5px] h-5 mt-1.5',
    xl: 'w-[3px] h-7 mt-2',
  };

  // Arc track radius and center depend on size
  const svgSize = { sm: 40, md: 56, lg: 80, xl: 128 }[size];
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = svgSize * 0.38;
  const startAngle = -225; // degrees (bottom-left)
  const endAngle   =  45;  // degrees (bottom-right)
  const sweepAngle = endAngle - startAngle; // 270°

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const describeArc = (from: number, to: number) => {
    const s = { x: cx + r * Math.cos(toRad(from)), y: cy + r * Math.sin(toRad(from)) };
    const e = { x: cx + r * Math.cos(toRad(to)),   y: cy + r * Math.sin(toRad(to))   };
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const filledEnd = startAngle + sweepAngle * percent;
  const rotation  = startAngle + sweepAngle * percent - 90; // for needle

  return (
    <div className="flex flex-col items-center justify-center gap-1 group select-none relative">
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        {/* SVG Arc track + fill */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgSize} height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Track */}
          <path
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={size === 'xl' ? 4 : 3}
            strokeLinecap="round"
          />
          {/* Fill */}
          {percent > 0 && (
            <path
              d={describeArc(startAngle, filledEnd)}
              fill="none"
              stroke={themeColor}
              strokeWidth={size === 'xl' ? 4 : 3}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 4px ${themeColor}88)`,
              }}
            />
          )}
        </svg>

        {/* Knob body */}
        <div 
          className="w-[75%] h-[75%] cursor-ns-resize rounded-full relative"
          style={{
            background: `radial-gradient(circle at 35% 30%, #32364a, #14161f)`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04)`,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Rotating needle */}
          <div
            className="absolute inset-0 flex justify-center"
            style={{ transform: `rotate(${rotation + 90}deg)` }}
          >
            <div
              className={`rounded-b-full ${pointerClasses[size]}`}
              style={{
                background: themeColor,
                boxShadow: `0 0 4px ${themeColor}`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center text-center drop-shadow-lg">
        {showValue && (
          <div
            className={`font-mono font-bold ${size === 'xl' ? 'text-sm' : 'text-[10px]'}`}
            style={{ color: themeColor, textShadow: `0 0 10px ${themeColor}66` }}
          >
            {formatValue(value)}
          </div>
        )}
        {label && (
          <div className={`text-[9px] text-[#6b7280] font-black tracking-[0.15em] uppercase mt-0.5 ${size === 'xl' ? 'text-[10px]' : ''}`}>
            {label}
          </div>
        )}
      </div>

      {/* Tooltip on hover (hidden if showValue is true) */}
      {!showValue && (
        <div
          className="text-xs font-mono bg-[#0d0e14]/95 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 z-10 pointer-events-none border border-white/10 shadow-xl whitespace-nowrap"
          style={{ color: themeColor }}
        >
          {formatValue(value)}
        </div>
      )}
    </div>
  );
};
