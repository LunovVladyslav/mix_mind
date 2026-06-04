import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface VstSlotState {
  type: number;
  bypass: boolean;
  parallel: boolean;
  p: number[];
}

interface VstState {
  inGain: number;
  outGain: number;
  slots: VstSlotState[];
  
  setInGain: (val: number) => void;
  setOutGain: (val: number) => void;
  setSlotType: (slotIdx: number, type: number) => void;
  setSlotBypass: (slotIdx: number, bypass: boolean) => void;
  setSlotParallel: (slotIdx: number, parallel: boolean) => void;
  setSlotParam: (slotIdx: number, paramIdx: number, val: number) => void;
  
  activeSlotIdx: number;
  setActiveSlotIdx: (idx: number) => void;
  reorderSlots: (fromIdx: number, toIdx: number) => void;
}

const defaultSlots = Array(8).fill(null).map(() => {
  // Create an array with flat gain (0.5) and spread out frequencies
  const p = Array(20).fill(0.5);
  // Sensible defaults for EQ frequencies (0.0 to 1.0 mapped to log freq)
  p[1] = 0.1;  // HPF
  p[3] = 0.25; // Low
  p[8] = 0.5;  // Mid
  p[14] = 0.75; // High
  p[17] = 0.9;  // LPF
  
  return {
    type: 0,
    bypass: false,
    parallel: false,
    p
  };
});

export const useVstStore = create<VstState>((set, get) => ({
  inGain: 0.5,
  outGain: 0.5,
  slots: defaultSlots,

  setInGain: (val) => {
    set({ inGain: val });
    invoke('send_vst_param', { param: 'in_gain', value: val }).catch(console.error);
  },
  
  setOutGain: (val) => {
    set({ outGain: val });
    invoke('send_vst_param', { param: 'out_gain', value: val }).catch(console.error);
  },

  setSlotType: (slotIdx, type) => {
    set((state) => {
      const slots = [...state.slots];
      // Reset parameters to default for the new type to avoid cross-contamination
      const p = Array(20).fill(0.5);
      if (type === 1) { // EQ
        p[1] = 0.1;  
        p[3] = 0.25; 
        p[8] = 0.5;  
        p[14] = 0.75; 
        p[17] = 0.9;  
      }
      slots[slotIdx] = { ...slots[slotIdx], type, p };
      return { slots };
    });
    invoke('send_vst_param', { param: `slot${slotIdx + 1}_type`, value: type }).catch(console.error);
    
    // Send all reset parameters to backend to keep DSP in sync
    const pDefaults = Array(20).fill(0.5);
    if (type === 1) {
      pDefaults[1] = 0.1;  
      pDefaults[3] = 0.25; 
      pDefaults[8] = 0.5;  
      pDefaults[14] = 0.75; 
      pDefaults[17] = 0.9;  
    }
    for (let i = 0; i < 20; i++) {
      invoke('send_vst_param', { param: `slot${slotIdx + 1}_p${i + 1}`, value: pDefaults[i] }).catch(console.error);
    }
  },

  setSlotBypass: (slotIdx, bypass) => {
    set((state) => {
      const slots = [...state.slots];
      slots[slotIdx] = { ...slots[slotIdx], bypass };
      return { slots };
    });
    invoke('send_vst_param', { param: `slot${slotIdx + 1}_bypass`, value: bypass ? 1.0 : 0.0 }).catch(console.error);
  },

  setSlotParallel: (slotIdx, parallel) => {
    set((state) => {
      const slots = [...state.slots];
      slots[slotIdx] = { ...slots[slotIdx], parallel };
      return { slots };
    });
    invoke('send_vst_param', { param: `slot${slotIdx + 1}_parallel`, value: parallel ? 1.0 : 0.0 }).catch(console.error);
  },

  setSlotParam: (slotIdx, paramIdx, val) => {
    set((state) => {
      const slots = [...state.slots];
      const p = [...slots[slotIdx].p];
      p[paramIdx] = val;
      slots[slotIdx] = { ...slots[slotIdx], p };
      return { slots };
    });
    invoke('send_vst_param', { param: `slot${slotIdx + 1}_p${paramIdx + 1}`, value: val }).catch(console.error);
  },

  activeSlotIdx: 0,
  setActiveSlotIdx: (idx) => set({ activeSlotIdx: idx }),

  reorderSlots: (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    set((state) => {
      const slots = [...state.slots];
      const [movedItem] = slots.splice(fromIdx, 1);
      slots.splice(toIdx, 0, movedItem);

      // Now we must send the new parameters to the backend for ALL slots, 
      // because the backend just stores slot[i]_type, slot[i]_p1 etc.
      // We loop over all 8 slots to ensure everything is perfectly synced
      slots.forEach((slot, idx) => {
        const prefix = `slot${idx + 1}`;
        invoke('send_vst_param', { param: `${prefix}_type`, value: slot.type }).catch(console.error);
        invoke('send_vst_param', { param: `${prefix}_bypass`, value: slot.bypass ? 1.0 : 0.0 }).catch(console.error);
        invoke('send_vst_param', { param: `${prefix}_parallel`, value: slot.parallel ? 1.0 : 0.0 }).catch(console.error);
        slot.p.forEach((val, pIdx) => {
          invoke('send_vst_param', { param: `${prefix}_p${pIdx + 1}`, value: val }).catch(console.error);
        });
      });

      // Keep the active slot focused on the same visual block if it moved
      let newActiveIdx = state.activeSlotIdx;
      if (state.activeSlotIdx === fromIdx) {
        newActiveIdx = toIdx;
      } else if (state.activeSlotIdx > fromIdx && state.activeSlotIdx <= toIdx) {
        newActiveIdx--;
      } else if (state.activeSlotIdx < fromIdx && state.activeSlotIdx >= toIdx) {
        newActiveIdx++;
      }

      return { slots, activeSlotIdx: newActiveIdx };
    });
  }
}));
