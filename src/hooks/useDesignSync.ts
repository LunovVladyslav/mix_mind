import { useEffect } from 'react';
import { watch, BaseDirectory } from '@tauri-apps/plugin-fs';
import { useDesignStore } from '../store/designStore';

export function useDesignSync() {
  const loadCode = useDesignStore((s) => s.loadCode);

  useEffect(() => {
    // Initial load
    loadCode();

    // Watch for AI changes to the file
    let unwatch: (() => void) | null = null;

    const setupWatcher = async () => {
      try {
        unwatch = await watch(
          'design-component.tsx',
          (event) => {
            if (event.type === 'any' || event.type === 'modify') {
               loadCode();
            }
          },
          { baseDir: BaseDirectory.AppLocalData }
        );
      } catch (e) {
        console.error('Failed to setup file watcher for design component:', e);
      }
    };

    setupWatcher();

    return () => {
      if (unwatch) {
        unwatch();
      }
    };
  }, [loadCode]);
}
