import { useDesignStore } from '../../store/designStore';

export default function PropertiesPanel() {
  const selectedId = useDesignStore((s) => s.selectedId);
  const nodes = useDesignStore((s) => s.nodes);
  const updateNode = useDesignStore((s) => s.updateNode);

  if (!selectedId || !nodes[selectedId]) {
    return (
      <div className="p-4 text-xs text-muted/50 text-center border-t border-border mt-auto">
        No element selected
      </div>
    );
  }

  const node = nodes[selectedId];
  const style = node.style || {};
  const props = node.props || {};

  const handleStyleChange = (key: string, value: string) => {
    updateNode(selectedId, { style: { ...style, [key]: value } });
  };

  const handlePropChange = (key: string, value: string) => {
    updateNode(selectedId, { props: { ...props, [key]: value } });
  };

  return (
    <div className="flex-1 flex flex-col border-t border-border bg-panel overflow-y-auto max-h-[50%]">
      <div className="px-3 py-2 text-[10px] font-bold text-muted uppercase tracking-widest border-b border-border">Properties</div>
      <div className="p-3 space-y-3">
        {/* Basic Props */}
        <div>
          <label className="text-[10px] text-muted mb-1 block">Name</label>
          <input 
            type="text" 
            value={props.name || ''} 
            onChange={(e) => handlePropChange('name', e.target.value)}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
          />
        </div>
        {(node.type === 'Text' || node.type === 'Button') && (
          <div>
            <label className="text-[10px] text-muted mb-1 block">Text Content</label>
            <input 
              type="text" 
              value={props.text || ''} 
              onChange={(e) => handlePropChange('text', e.target.value)}
              className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>
        )}
        
        {/* Layout Styles */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted mb-1 block">Width</label>
            <input 
              type="text" 
              value={style.width || ''} 
              onChange={(e) => handleStyleChange('width', e.target.value)}
              className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
              placeholder="auto, 100%, 50px"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted mb-1 block">Height</label>
            <input 
              type="text" 
              value={style.height || ''} 
              onChange={(e) => handleStyleChange('height', e.target.value)}
              className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
              placeholder="auto, 100%, 50px"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted mb-1 block">Background</label>
            <input 
              type="text" 
              value={style.backgroundColor || ''} 
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted mb-1 block">Text Color</label>
            <input 
              type="text" 
              value={style.color || ''} 
              onChange={(e) => handleStyleChange('color', e.target.value)}
              className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        
        {/* Flexbox */}
        <div>
          <label className="text-[10px] text-muted mb-1 block">Display</label>
          <select 
            value={style.display || ''} 
            onChange={(e) => handleStyleChange('display', e.target.value)}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
          >
            <option value="">Default</option>
            <option value="flex">Flex</option>
            <option value="block">Block</option>
            <option value="grid">Grid</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
    </div>
  );
}
