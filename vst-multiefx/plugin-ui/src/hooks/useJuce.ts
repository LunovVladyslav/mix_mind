import { useState, useEffect } from 'react';

declare global {
  interface Window {
    juce: any;
  }
}

export function useJuceSlider(paramId: string, defaultValue: number = 0.5) {
  const [value, setValue] = useState<number>(defaultValue);

  useEffect(() => {
    if (!window.juce || !window.juce.getSliderState) return;

    try {
      const state = window.juce.getSliderState(paramId);
      if (!state) return;

      // Initial value
      const val = state.getNormalisedValue();
      setValue(val);

      // Listen for host changes
      const listenerId = state.valueChangedEvent.addListener(() => {
        setValue(state.getNormalisedValue());
      });

      return () => {
        state.valueChangedEvent.removeListener(listenerId);
      };
    } catch (e) {
      console.warn("JUCE Slider Error for", paramId, e);
    }
  }, [paramId]);

  const updateValue = (newVal: number) => {
    setValue(newVal);
    if (window.juce && window.juce.getSliderState) {
      try {
        const state = window.juce.getSliderState(paramId);
        if (state) {
          state.setNormalisedValue(newVal);
        }
      } catch (e) {
        // Handle gracefully
      }
    }
  };

  return [value, updateValue] as const;
}

export function useJuceComboBox(paramId: string, defaultValue: number = 0) {
  const [value, setValue] = useState<number>(defaultValue);

  useEffect(() => {
    if (!window.juce || !window.juce.getComboBoxState) return;

    try {
      const state = window.juce.getComboBoxState(paramId);
      if (!state) return;

      setValue(state.getChoiceIndex());

      const listenerId = state.valueChangedEvent.addListener(() => {
        setValue(state.getChoiceIndex());
      });

      return () => {
        state.valueChangedEvent.removeListener(listenerId);
      };
    } catch (e) {}
  }, [paramId]);

  const updateValue = (newVal: number) => {
    setValue(newVal);
    if (window.juce && window.juce.getComboBoxState) {
      try {
        const state = window.juce.getComboBoxState(paramId);
        if (state) {
          state.setChoiceIndex(newVal);
        }
      } catch (e) {}
    }
  };

  return [value, updateValue] as const;
}

export function useJuceToggle(paramId: string, defaultValue: boolean = false) {
  const [value, setValue] = useState<boolean>(defaultValue);

  useEffect(() => {
    if (!window.juce || !window.juce.getToggleButtonState) return;

    try {
      const state = window.juce.getToggleButtonState(paramId);
      if (!state) return;

      setValue(state.getToggleState());

      const listenerId = state.valueChangedEvent.addListener(() => {
        setValue(state.getToggleState());
      });

      return () => {
        state.valueChangedEvent.removeListener(listenerId);
      };
    } catch (e) {}
  }, [paramId]);

  const updateValue = (newVal: boolean) => {
    setValue(newVal);
    if (window.juce && window.juce.getToggleButtonState) {
      try {
        const state = window.juce.getToggleButtonState(paramId);
        if (state) {
          state.setToggleState(newVal);
        }
      } catch (e) {}
    }
  };

  return [value, updateValue] as const;
}
