import { useDesignSync } from '../hooks/useDesignSync';
import GeneratorSidebar from '../components/designer/GeneratorSidebar';
import DynamicCanvas from '../components/designer/DynamicCanvas';
import ElementEditor from '../components/designer/ElementEditor';

export default function DesignMode() {
  // Initialize the file watcher hook
  useDesignSync();

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-bg text-text">
      {/* Left Sidebar (Generation Instructions) */}
      <GeneratorSidebar />
      
      {/* Center Canvas (Dynamic rendering) */}
      <DynamicCanvas />

      {/* Right Sidebar (Manual Editor) */}
      <ElementEditor />
    </div>
  );
}
