import React from 'react';

interface LedButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: 'blue' | 'red' | 'green' | 'orange' | 'white';
}

const colorMap = {
  blue:   { bg: 'bg-blue-500',   shadow: 'shadow-[0_0_12px_rgba(59,130,246,0.8)]' },
  red:    { bg: 'bg-red-500',    shadow: 'shadow-[0_0_12px_rgba(239,68,68,0.8)]' },
  green:  { bg: 'bg-green-500',  shadow: 'shadow-[0_0_12px_rgba(34,197,94,0.8)]' },
  orange: { bg: 'bg-orange-500', shadow: 'shadow-[0_0_12px_rgba(249,115,22,0.8)]' },
  white:  { bg: 'bg-white',      shadow: 'shadow-[0_0_12px_rgba(255,255,255,0.8)]' },
};

export const LedButton: React.FC<LedButtonProps> = ({ 
  label, 
  active, 
  onClick, 
  color = 'blue' 
}) => {
  const c = colorMap[color];

  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1 group focus:outline-none"
    >
      <div className={`w-8 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center transition-colors ${active ? 'border-slate-600' : 'group-hover:border-slate-600'}`}>
        <div 
          className={`w-3 h-1.5 rounded-full transition-all duration-200 ${active ? `${c.bg} ${c.shadow}` : 'bg-slate-900 shadow-inner'}`} 
        />
      </div>
      <div className="text-[9px] text-slate-400 font-medium tracking-wider uppercase">{label}</div>
    </button>
  );
};
