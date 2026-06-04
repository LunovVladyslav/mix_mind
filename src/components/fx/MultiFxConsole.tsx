import React, { useEffect, useState } from 'react';
import { useVstStore } from '../../store/useVstStore';
import { useAppStore } from '../../store/appStore';
import { Fader } from '../ui/Fader';
import { Meter } from '../ui/Meter';
import { SlotView } from './SlotView'; // keeping for legacy/future use
import { EffectChain } from './EffectChain';
import { DspEditor } from './DspEditor';

export const MultiFxConsole: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`flex flex-col bg-surface text-text overflow-hidden rounded-xl border border-border m-4 shadow-[0_0_50px_rgba(0,229,255,0.02)] transition-all duration-300 ${isCollapsed ? 'h-auto' : 'h-full'}`}>
      
      {/* Top Header & Toggles */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-panel">
        <div className="text-[10px] font-bold tracking-widest text-muted flex items-center gap-2">
          <span>RACK</span>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted hover:text-accent p-1 transition-colors"
          title={isCollapsed ? "Expand Editor" : "Collapse Editor"}
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      <EffectChain />
      
      {/* Editor is hidden when collapsed */}
      {!isCollapsed && <DspEditor />}
    </div>
  );
};
