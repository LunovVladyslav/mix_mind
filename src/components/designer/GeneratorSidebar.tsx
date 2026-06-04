export default function GeneratorSidebar() {
  return (
    <div className="w-64 border-r border-border bg-surface flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-bold text-text mb-1">AI Generator</h2>
        <p className="text-[10px] text-muted">Real-time design integration</p>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-4 text-xs text-muted leading-relaxed">
        <p>
          I am connected directly to this canvas!
        </p>
        <div className="bg-accent/10 border border-accent/20 rounded p-3 text-text">
          <strong className="block text-accent mb-1">How to generate:</strong>
          Just ask me in the chat on the right: <br/>
          <span className="italic">"Generate a modern EQ plugin UI"</span> or drop a reference image!
        </div>
        
        <div className="bg-accent/10 border border-accent/20 rounded p-3 text-text">
          <strong className="block text-accent mb-1">How to edit:</strong>
          1. Click an element on the canvas to select it (it will get a cyan outline).<br/>
          2. Ask me in the chat: <br/>
          <span className="italic">"Make the selected element round and red"</span>.
        </div>
        
        <p className="mt-auto opacity-50 text-[10px]">
          Note: Ensure your prompt instructs me to add <code className="bg-black/30 px-1 rounded">data-design-id</code> attributes to elements!
        </p>
      </div>
    </div>
  );
}
