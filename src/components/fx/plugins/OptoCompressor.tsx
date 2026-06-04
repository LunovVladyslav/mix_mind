import React from 'react';

// --- Pure CSS Photorealistic Gold Knob ---
interface OptoKnobProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
  ticks?: React.ReactNode;
}

const OptoKnob: React.FC<OptoKnobProps> = ({ label, value, onChange, size = 'lg', ticks }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startVal = value;
    const handleMouseMove = (moveE: MouseEvent) => {
      let newVal = startVal + ((startY - moveE.clientY) / 100);
      newVal = Math.max(0, Math.min(1, newVal));
      onChange(newVal);
    };
    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const rotation = -135 + value * 270;
  
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center cursor-ns-resize group relative" onMouseDown={handleMouseDown}>
      {/* Ticks SVG Overlay */}
      {ticks && <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0">{ticks}</div>}
      
      {/* Knob Base (Generated via Canvas from AI texture) */}
      <div className={`relative z-10 ${sizeClasses[size]}`}>
           {/* The knob image includes its own drop shadow and 3D lighting */}
           <div className="absolute inset-[-8px] pointer-events-none" style={{
             backgroundImage: "url('/plugins/opto/opto_knob_gold.png')",
             backgroundSize: "contain",
             backgroundPosition: "center",
             backgroundRepeat: "no-repeat"
           }}></div>

           {/* Rotating Indicator */}
           <div className="absolute inset-0 flex justify-center pointer-events-none" style={{ transform: `rotate(${rotation}deg)` }}>
              <div className="w-[1.5px] h-[25%] mt-[15%] bg-[#0a0a0a] shadow-[0_1px_0_rgba(255,255,255,0.4)] rounded-full"></div>
           </div>
      </div>
      <div className="mt-2 text-[9px] text-[#dbab5c] font-semibold tracking-widest uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
          {label}
      </div>
    </div>
  );
};

interface OptoCompressorProps {
  thresh: number;
  ratio: number;
  attack: number;
  release: number;
  makeup: number;
  mix: number;
  limit: number;
  sp: (index: number, val: number) => void;
  renderTypeSelector: (className?: string) => React.ReactNode;
}

export const OptoCompressor: React.FC<OptoCompressorProps> = ({ thresh, ratio, attack, release, makeup, mix, limit, sp, renderTypeSelector }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-2 relative w-full h-full">
      {/* Main Faceplate */}
      <div className="bg-[#242528] rounded shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_inset_0_0_80px_rgba(0,0,0,0.8),_0_20px_40px_rgba(0,0,0,0.9)] p-6 relative overflow-hidden z-10 w-[500px] h-[500px] flex flex-col justify-between border border-[#111]"
           style={{
             backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.2)), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`
           }}>
        
        {/* Corner Screws */}
        {[
          { top: '0.8rem', left: '0.8rem', rotate: '45deg' },
          { top: '0.8rem', right: '0.8rem', rotate: '110deg' },
          { bottom: '0.8rem', left: '0.8rem', rotate: '12deg' },
          { bottom: '0.8rem', right: '0.8rem', rotate: '70deg' },
        ].map((style, i) => (
          <div key={i} className="absolute w-4 h-4 rounded-full bg-gradient-to-br from-[#555] to-[#222] border border-[#111] shadow-[0_1px_1px_rgba(255,255,255,0.1),_inset_0_2px_4px_rgba(0,0,0,0.8)] flex items-center justify-center" style={style}>
            <div className="w-full h-[1.5px] bg-[#0a0a0a] shadow-[0_1px_0_rgba(255,255,255,0.15)]"></div>
          </div>
        ))}

        {/* 3-Column Layout */}
        <div className="flex-1 grid grid-cols-3 gap-2 pt-2 px-1 h-full">
           
           {/* LEFT COLUMN */}
           <div className="flex flex-col items-center justify-between py-1">
             <OptoKnob label="INPUT" value={mix} onChange={(v:number)=>sp(4,v)} size="lg" ticks={
               <svg className="absolute w-[90px] h-[90px] opacity-60 pointer-events-none" viewBox="0 0 100 100">
                 {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                   const ang = -135 + (n/10) * 270;
                   const rad = ang * Math.PI / 180;
                   return <line key={n} x1={50 + 38 * Math.sin(rad)} y1={50 - 38 * Math.cos(rad)} x2={50 + 44 * Math.sin(rad)} y2={50 - 44 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                 })}
               </svg>
             } />
             <OptoKnob label="THRESHOLD" value={thresh} onChange={(v:number)=>sp(0,v)} size="lg" ticks={
               <svg className="absolute w-[110px] h-[110px] opacity-70 pointer-events-none" viewBox="0 0 100 100">
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                    const ang = -135 + (n/10) * 270;
                    const rad = ang * Math.PI / 180;
                    const tx = 50 + 45 * Math.sin(rad);
                    const ty = 50 - 45 * Math.cos(rad);
                    return (
                      <g key={n}>
                        <line x1={50 + 32 * Math.sin(rad)} y1={50 - 32 * Math.cos(rad)} x2={50 + 36 * Math.sin(rad)} y2={50 - 36 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                        <text x={tx} y={ty} fill="#dbab5c" fontSize="6" textAnchor="middle" alignmentBaseline="middle" fontFamily="sans-serif">{n}</text>
                      </g>
                    )
                  })}
               </svg>
             } />
             <div className="h-2"></div>
             <OptoKnob label="ATTACK" value={attack} onChange={(v:number)=>sp(2,v)} size="md" ticks={
                <>
                  <svg className="absolute w-[70px] h-[70px] opacity-60 pointer-events-none" viewBox="0 0 100 100">
                   {[0,1,2,3,4,5,6].map(n => {
                     const ang = -135 + (n/6) * 270;
                     const rad = ang * Math.PI / 180;
                     return <line key={n} x1={50 + 36 * Math.sin(rad)} y1={50 - 36 * Math.cos(rad)} x2={50 + 42 * Math.sin(rad)} y2={50 - 42 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                   })}
                  </svg>
                  <div className="absolute w-[75px] flex justify-between items-end opacity-70 text-[#dbab5c] text-[8px] -bottom-1">
                    <span className="font-serif italic">fast</span><span className="font-serif italic">slow</span>
                  </div>
                </>
             }/>
           </div>

           {/* CENTER COLUMN */}
           <div className="flex flex-col items-center justify-between">
              
              {/* Top: Opto LED & Comp Switch */}
              <div className="flex justify-between w-[90%] px-2 mt-0">
                 <div className="flex flex-col items-center gap-1">
                   <div className="w-4 h-4 rounded-full bg-[#ffcc44] shadow-[0_0_15px_rgba(255,204,68,0.8),_inset_0_0_6px_rgba(255,255,255,0.8)]"></div>
                   <span className="text-[#dbab5c] text-[8px] font-bold tracking-widest uppercase mt-1">OPTO</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[#dbab5c] text-[8px] font-bold tracking-widest uppercase mb-1">LIMIT</span>
                    <div 
                      className="w-2.5 h-6 bg-[#111] rounded-full shadow-[inset_0_3px_6px_rgba(0,0,0,1)] relative cursor-pointer"
                      onClick={() => sp(6, limit > 0.5 ? 0 : 1)}
                    >
                      <div className={`absolute w-2.5 h-3 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.5)] transition-all duration-200 bg-gradient-to-b from-[#dcb25b] to-[#8a6a2a] ${limit > 0.5 ? 'top-0' : 'bottom-0'}`}></div>
                    </div>
                    <span className="text-[#dbab5c] text-[8px] font-bold tracking-widest uppercase mt-1">COMP</span>
                 </div>
              </div>

              {/* Center: Canvas Generated VU Meter */}
              <div className="w-[180px] h-[135px] relative mt-2">
                 <img src="/plugins/opto/opto_vu_meter.png" alt="VU Meter" className="w-full h-full object-contain pointer-events-none drop-shadow-[0_15px_20px_rgba(0,0,0,0.9)]" />
                 
                 {/* Needle */}
                 <div className="absolute bottom-[22px] left-1/2 w-[1.5px] h-[70px] bg-[#111] shadow-[2px_0_3px_rgba(0,0,0,0.6)] origin-bottom -translate-x-1/2 z-10 transition-transform duration-100" style={{ transform: `rotate(${-20 + Math.random() * -5}deg)` }}>
                 </div>
              </div>

              {/* Bottom: Makeup Gain */}
              <div className="mb-0">
                <OptoKnob label="MAKEUP GAIN" value={makeup} onChange={(v:number)=>sp(5,v)} size="sm" />
              </div>
           </div>

           {/* RIGHT COLUMN */}
           <div className="flex flex-col items-center justify-between py-1">
             <OptoKnob label="OUTPUT" value={makeup} onChange={(v:number)=>sp(5,v)} size="lg" ticks={
               <svg className="absolute w-[90px] h-[90px] opacity-60 pointer-events-none" viewBox="0 0 100 100">
                 {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                   const ang = -135 + (n/10) * 270;
                   const rad = ang * Math.PI / 180;
                   return <line key={n} x1={50 + 38 * Math.sin(rad)} y1={50 - 38 * Math.cos(rad)} x2={50 + 44 * Math.sin(rad)} y2={50 - 44 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                 })}
               </svg>
             } />
             <OptoKnob label="RATIO" value={ratio} onChange={(v:number)=>sp(1,v)} size="lg" ticks={
               <svg className="absolute w-[110px] h-[110px] opacity-70 pointer-events-none" viewBox="0 0 100 100">
                  {['1.5:1','2:1','4:1','8:1','20:1'].map((n, i) => {
                    const ang = -120 + (i/4) * 180;
                    const rad = ang * Math.PI / 180;
                    const tx = 50 + 45 * Math.sin(rad);
                    const ty = 50 - 45 * Math.cos(rad);
                    return (
                      <g key={n}>
                        <line x1={50 + 32 * Math.sin(rad)} y1={50 - 32 * Math.cos(rad)} x2={50 + 36 * Math.sin(rad)} y2={50 - 36 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                        <text x={tx} y={ty} fill="#dbab5c" fontSize="6" textAnchor="middle" alignmentBaseline="middle" fontFamily="sans-serif">{n}</text>
                      </g>
                    )
                  })}
               </svg>
             } />
             <div className="h-2"></div>
             <OptoKnob label="RELEASE" value={release} onChange={(v:number)=>sp(3,v)} size="md" ticks={
                <>
                  <svg className="absolute w-[70px] h-[70px] opacity-60 pointer-events-none" viewBox="0 0 100 100">
                   {[0,1,2,3,4,5,6].map(n => {
                     const ang = -135 + (n/6) * 270;
                     const rad = ang * Math.PI / 180;
                     return <line key={n} x1={50 + 36 * Math.sin(rad)} y1={50 - 36 * Math.cos(rad)} x2={50 + 42 * Math.sin(rad)} y2={50 - 42 * Math.cos(rad)} stroke="#dbab5c" strokeWidth="1.5" />
                   })}
                  </svg>
                  <div className="absolute w-[75px] flex justify-between items-end opacity-70 text-[#dbab5c] text-[8px] -bottom-1">
                    <span className="font-serif italic">fast</span><span className="font-serif italic">slow</span>
                  </div>
                </>
             } />
           </div>

        </div>

        {/* Render Type Selector (Hidden or Absolute) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-20 hover:opacity-100 transition-opacity">
            {renderTypeSelector("scale-[0.6]")}
        </div>
      </div>
    </div>
  );
};
