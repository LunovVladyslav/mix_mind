import { useDesignStore, NodeType, DesignNode } from '../../store/designStore';
import { exportToReact } from '../../utils/exportToReact';

export default function Toolbar() {
  const addNode = useDesignStore((s) => s.addNode);
  const selectedId = useDesignStore((s) => s.selectedId) || 'root'; // default to root if nothing selected
  const nodes = useDesignStore((s) => s.nodes);

  const handleExport = async () => {
    const code = exportToReact(nodes, 'root');
    try {
      await navigator.clipboard.writeText(code);
      alert('Code exported to clipboard!');
    } catch (err) {
      console.error('Failed to copy code: ', err);
      alert('Export failed. Check console.');
    }
  };

  const handleAdd = (type: NodeType) => {
    const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 6)}`;
    const newNode: DesignNode = {
      id,
      type,
      props: { name: `${type} 1` },
      style: {
        padding: type === 'Frame' ? '20px' : undefined,
        backgroundColor: type === 'Frame' ? '#ffffff10' : undefined,
        border: type === 'Frame' ? '1px solid #ffffff20' : undefined,
      },
      children: [],
      parentId: selectedId,
    };

    if (type === 'Text') newNode.props.text = 'Text Element';
    if (type === 'Button') {
      newNode.props.text = 'Button';
      newNode.style = {
        padding: '8px 16px',
        backgroundColor: '#4a90e2',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'center',
        ...newNode.style,
      };
    }
    if (type === 'Knob') {
      newNode.props.value = 50;
      newNode.style = {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#333',
        border: '2px solid #555',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '10px',
        ...newNode.style,
      };
    }

    addNode(newNode, selectedId);
  };

  return (
    <div className="h-12 border-b border-border bg-surface flex items-center px-4 space-x-2">
      <button onClick={() => handleAdd('Frame')} className="px-3 py-1 bg-panel hover:bg-white/10 text-xs rounded border border-border">Frame</button>
      <button onClick={() => handleAdd('Text')} className="px-3 py-1 bg-panel hover:bg-white/10 text-xs rounded border border-border">Text</button>
      <button onClick={() => handleAdd('Button')} className="px-3 py-1 bg-panel hover:bg-white/10 text-xs rounded border border-border">Button</button>
      <button onClick={() => handleAdd('Knob')} className="px-3 py-1 bg-panel hover:bg-white/10 text-xs rounded border border-border">Knob</button>
      <div className="flex-1" />
      <button onClick={handleExport} className="px-3 py-1 bg-accent text-bg font-bold text-xs rounded hover:opacity-90 transition-opacity">Export Code</button>
    </div>
  );
}
