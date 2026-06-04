import { create } from 'zustand';
import { BaseDirectory, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';

export interface DesignState {
  generatedCode: string;
  selectedElementId: string | null;
  manualStyles: Record<string, React.CSSProperties>; // Map of element ID to style overrides
  
  setGeneratedCode: (code: string) => void;
  setSelectedElementId: (id: string | null) => void;
  updateManualStyle: (id: string, style: React.CSSProperties) => void;
  
  saveSelection: () => Promise<void>;
  loadCode: () => Promise<void>;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  generatedCode: '',
  selectedElementId: null,
  manualStyles: {},

  setGeneratedCode: (code) => set({ generatedCode: code }),
  
  setSelectedElementId: (id) => {
    set({ selectedElementId: id });
    get().saveSelection();
  },

  updateManualStyle: (id, style) => {
    set((state) => ({
      manualStyles: {
        ...state.manualStyles,
        [id]: { ...(state.manualStyles[id] || {}), ...style }
      }
    }));
  },

  saveSelection: async () => {
    try {
      const stateToSave = {
        selectedElementId: get().selectedElementId,
      };
      await writeTextFile('design-selection.json', JSON.stringify(stateToSave, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error('Failed to save design selection:', e);
    }
  },

  loadCode: async () => {
    try {
      // the AI writes to design-component.tsx in the root of the project.
      // Wait, we need to read from the project root. But Tauri can't read from outside scopes easily.
      // Actually we allowed reading from AppLocalData earlier. So AI will write to AppLocalData.
      // Let's use `design-component.tsx` in AppLocalData.
      const fileExists = await exists('design-component.tsx', { baseDir: BaseDirectory.AppLocalData });
      if (fileExists) {
        const content = await readTextFile('design-component.tsx', { baseDir: BaseDirectory.AppLocalData });
        set({ generatedCode: content });
      }
    } catch (e) {
      console.error('Failed to load generated code:', e);
    }
  },
}));
