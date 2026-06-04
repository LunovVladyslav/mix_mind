import React, { useEffect, useState, useRef } from 'react';
import * as Babel from '@babel/standalone';
import { useDesignStore } from '../../store/designStore';

import * as LucideIcons from 'lucide-react';

export default function DynamicCanvas() {
  const generatedCode = useDesignStore(s => s.generatedCode);
  const setSelectedElementId = useDesignStore(s => s.setSelectedElementId);
  const selectedElementId = useDesignStore(s => s.selectedElementId);
  const manualStyles = useDesignStore(s => s.manualStyles);
  
  const [Component, setComponent] = useState<React.FC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!generatedCode.trim()) {
      setComponent(null);
      setError(null);
      return;
    }

    try {
      // Compile the React code
      // We assume the AI exports a default function
      const transformed = Babel.transform(generatedCode, {
        presets: ['react'],
        filename: 'dynamic.tsx',
      }).code;

      if (!transformed) throw new Error("Compilation resulted in empty code");

      // Extract the component
      const exports: Record<string, any> = {};
      const require = (mod: string) => {
        if (mod === 'react') return React;
        if (mod === 'lucide-react') return LucideIcons;
        throw new Error(`Cannot find module '${mod}'`);
      };

      // Create a function that executes the transformed code with our mocked exports and require
      const execute = new Function('exports', 'require', 'React', transformed);
      execute(exports, require, React);

      const CompiledComponent = exports.default || Object.values(exports)[0];
      
      if (typeof CompiledComponent !== 'function') {
        throw new Error("Could not find a valid React component to render. Make sure to `export default function Component() {}`");
      }

      setComponent(() => CompiledComponent);
      setError(null);
    } catch (err: any) {
      console.error("Babel compilation error:", err);
      setError(err.message || String(err));
    }
  }, [generatedCode]);

  // Handle global clicks to select elements
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find closest element with data-design-id
      const target = e.target as HTMLElement;
      const designNode = target.closest('[data-design-id]');
      
      if (designNode) {
        e.stopPropagation();
        e.preventDefault(); // Prevent default actions if it's a link or form button
        const id = designNode.getAttribute('data-design-id');
        setSelectedElementId(id);
      } else if (containerRef.current && containerRef.current.contains(target)) {
        // Clicked on empty space inside canvas
        setSelectedElementId(null);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handleClick, { capture: true });
    }
    return () => {
      if (container) {
        container.removeEventListener('click', handleClick, { capture: true });
      }
    };
  }, [setSelectedElementId]);

  // Apply manual styles and selection borders via a mutation observer or a global style injection
  useEffect(() => {
    if (!containerRef.current) return;

    // We can inject a style tag that applies the manual styles and selection borders dynamically!
    // This is much more reliable than inline styles because it works for newly rendered components too.
    let cssString = '';

    // Selection outline
    if (selectedElementId) {
      cssString += `\n[data-design-id="${selectedElementId}"] { outline: 2px solid #00ffff !important; outline-offset: -2px; }`;
    }

    // Manual styles mapping
    for (const [id, style] of Object.entries(manualStyles)) {
      let rules = '';
      for (const [prop, val] of Object.entries(style)) {
        // Convert camelCase to kebab-case
        const kebab = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        rules += `${kebab}: ${val} !important; `;
      }
      if (rules) {
        cssString += `\n[data-design-id="${id}"] { ${rules} }`;
      }
    }

    const styleEl = document.getElementById('design-dynamic-styles') || document.createElement('style');
    styleEl.id = 'design-dynamic-styles';
    styleEl.textContent = cssString;
    
    if (!styleEl.parentNode) {
      document.head.appendChild(styleEl);
    }
    
    return () => {
      if (styleEl.parentNode && document.getElementById('design-dynamic-styles') === styleEl) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [selectedElementId, manualStyles]);

  return (
    <div className="flex-1 bg-bg relative overflow-auto flex items-center justify-center" ref={containerRef}>
      {error ? (
        <div className="p-4 bg-red-900/50 text-red-200 border border-red-500 rounded max-w-lg font-mono text-xs">
          <h3 className="font-bold mb-2">Compilation Error</h3>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      ) : Component ? (
        <div className="shadow-2xl border border-border bg-surface overflow-hidden" style={{ minWidth: 400, minHeight: 300 }}>
          <Component />
        </div>
      ) : (
        <div className="text-muted/50 text-sm flex flex-col items-center">
          <div className="mb-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </div>
          Waiting for AI to generate code...
        </div>
      )}
    </div>
  );
}
