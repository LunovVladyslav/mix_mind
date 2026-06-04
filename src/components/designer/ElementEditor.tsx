import { useDesignStore } from '../../store/designStore';
import { HexColorPicker } from 'react-colorful';
import { useState, useEffect } from 'react';

export default function ElementEditor() {
  const selectedElementId = useDesignStore(s => s.selectedElementId);
  const updateManualStyle = useDesignStore(s => s.updateManualStyle);
  const manualStyles = useDesignStore(s => s.manualStyles);
  const generatedCode = useDesignStore(s => s.generatedCode);

  const [bgColor, setBgColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [borderRadius, setBorderRadius] = useState(0);

  // When selection changes, we could parse the style, but for simplicity, we just manage overrides
  useEffect(() => {
    if (selectedElementId && manualStyles[selectedElementId]) {
      const s = manualStyles[selectedElementId];
      setBgColor(s.backgroundColor as string || '');
      setTextColor(s.color as string || '');
      
      const br = s.borderRadius as string;
      if (br && br.endsWith('px')) {
        setBorderRadius(parseInt(br, 10));
      } else {
        setBorderRadius(0);
      }
    } else {
      setBgColor('');
      setTextColor('');
      setBorderRadius(0);
    }
  }, [selectedElementId, manualStyles]);

  if (!selectedElementId) {
    return (
      <div className="w-[300px] border-l border-border bg-surface flex flex-col items-center justify-center p-4 text-center">
        <svg className="w-12 h-12 text-muted/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p className="text-xs text-muted">Select an element on the canvas to edit its properties.</p>
      </div>
    );
  }

  const handleStyleChange = (prop: string, value: string | number) => {
    updateManualStyle(selectedElementId, { [prop]: value });
  };

  const copyComponentCode = () => {
    navigator.clipboard.writeText(generatedCode);
    alert('Component code copied to clipboard!');
  };

  return (
    <div className="w-[300px] border-l border-border bg-surface flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border bg-card flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-text">Element Editor</h2>
          <p className="text-[10px] text-accent font-mono mt-1 bg-accent/10 inline-block px-1 rounded">
            {selectedElementId}
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Background Color */}
        <div>
          <label className="text-xs font-semibold text-text mb-2 block flex justify-between">
            Background Color
            {bgColor && <span className="font-mono text-muted">{bgColor}</span>}
          </label>
          <div className="custom-color-picker-wrapper">
            <HexColorPicker 
              color={bgColor} 
              onChange={(c) => {
                setBgColor(c);
                handleStyleChange('backgroundColor', c);
              }} 
              style={{ width: '100%', height: '120px' }}
            />
          </div>
        </div>

        {/* Text Color */}
        <div className="pt-4 border-t border-border/50">
          <label className="text-xs font-semibold text-text mb-2 block flex justify-between">
            Text Color
            {textColor && <span className="font-mono text-muted">{textColor}</span>}
          </label>
          <div className="custom-color-picker-wrapper">
            <HexColorPicker 
              color={textColor} 
              onChange={(c) => {
                setTextColor(c);
                handleStyleChange('color', c);
              }} 
              style={{ width: '100%', height: '120px' }}
            />
          </div>
        </div>

        {/* Border Radius */}
        <div className="pt-4 border-t border-border/50">
          <label className="text-xs font-semibold text-text mb-2 flex justify-between">
            <span>Border Radius</span>
            <span className="font-mono text-accent">{borderRadius}px</span>
          </label>
          <input 
            type="range" 
            min="0" max="50" 
            value={borderRadius}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setBorderRadius(val);
              handleStyleChange('borderRadius', `${val}px`);
            }}
            className="w-full accent-accent"
          />
        </div>
      </div>

      <div className="p-4 border-t border-border bg-card">
        <button 
          onClick={copyComponentCode}
          className="w-full py-2 bg-accent/20 text-accent font-semibold text-xs rounded hover:bg-accent/30 transition-colors border border-accent/30"
        >
          Copy Full React Code
        </button>
      </div>
    </div>
  );
}
