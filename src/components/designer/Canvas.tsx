import { useDesignStore } from '../../store/designStore';

export default function Canvas() {
  const nodes = useDesignStore((s) => s.nodes);
  const selectedId = useDesignStore((s) => s.selectedId);
  const setSelectedId = useDesignStore((s) => s.setSelectedId);

  const renderNode = (id: string) => {
    const node = nodes[id];
    if (!node) return null;

    const isSelected = selectedId === id;
    const isRoot = id === 'root';

    const baseStyle: React.CSSProperties = {
      ...node.style,
      boxSizing: 'border-box',
    };

    if (isSelected && !isRoot) {
      baseStyle.outline = '2px solid #4a90e2';
      baseStyle.outlineOffset = '-2px';
    }

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedId(id);
    };

    if (node.type === 'Text') {
      return (
        <div key={id} style={baseStyle} onClick={handleClick}>
          {node.props.text}
        </div>
      );
    }

    if (node.type === 'Button') {
      return (
        <button key={id} style={baseStyle} onClick={handleClick}>
          {node.props.text}
        </button>
      );
    }

    if (node.type === 'Knob') {
      return (
        <div key={id} style={baseStyle} onClick={handleClick}>
          <div style={{
            position: 'absolute',
            width: '4px',
            height: '50%',
            backgroundColor: '#4a90e2',
            top: 0,
            left: '50%',
            transform: `translateX(-50%) rotate(${(node.props.value || 50) * 2.7 - 135}deg)`,
            transformOrigin: 'bottom center',
          }} />
          <span style={{ position: 'absolute', zIndex: 10 }}>{node.props.value}%</span>
        </div>
      );
    }

    if (node.type === 'Image') {
      return (
        <img key={id} src={node.props.src || 'https://via.placeholder.com/150'} style={baseStyle} onClick={handleClick} alt="Node" />
      );
    }

    // Default: Frame
    return (
      <div key={id} style={baseStyle} onClick={handleClick}>
        {node.children.map((childId) => renderNode(childId))}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-surface p-8 overflow-auto flex items-center justify-center">
      <div 
        className="shadow-2xl border border-border"
        style={{ width: 800, height: 600, overflow: 'hidden' }}
      >
        {renderNode('root')}
      </div>
    </div>
  );
}
