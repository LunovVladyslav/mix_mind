import { useDesignStore, NodeType, DesignNode } from '../../store/designStore';

export default function LayersPanel() {
  const nodes = useDesignStore((s) => s.nodes);
  const selectedId = useDesignStore((s) => s.selectedId);
  const setSelectedId = useDesignStore((s) => s.setSelectedId);

  const renderNode = (id: string, depth: number) => {
    const node = nodes[id];
    if (!node) return null;

    const isSelected = selectedId === id;

    return (
      <div key={id}>
        <div
          className={`px-3 py-1 cursor-pointer text-xs flex items-center hover:bg-white/5 ${isSelected ? 'bg-accent/20 text-accent font-semibold' : 'text-muted'}`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => setSelectedId(id)}
        >
          <span className="mr-2 opacity-50">{node.type}</span>
          <span>{node.props.name || id}</span>
        </div>
        {node.children.map((childId) => renderNode(childId, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto py-2">
      <div className="px-3 pb-2 text-[10px] font-bold text-muted uppercase tracking-widest">Layers</div>
      {renderNode('root', 0)}
    </div>
  );
}
