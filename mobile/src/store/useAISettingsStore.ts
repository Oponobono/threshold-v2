import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AIProvider = 'groq' | 'gemini' | 'local';
export type AIModelMode = 'auto' | 'manual';

export type AIModelPreference =
  | { mode: 'auto' }
  | { mode: 'manual'; modelId: string };

export interface AISettingsState {
  preferences: {
    groq: AIModelPreference;
    gemini: AIModelPreference;
    local: AIModelPreference;
  };
  setPreference: (provider: AIProvider, preference: AIModelPreference) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PREFERENCES: AISettingsState['preferences'] = {
  groq: { mode: 'auto' },
  gemini: { mode: 'auto' },
  local: { mode: 'auto' },
};

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      preferences: DEFAULT_PREFERENCES,

      setPreference: (provider, preference) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            [provider]: preference,
          },
        })),

      resetToDefaults: () =>
        set(() => ({
          preferences: DEFAULT_PREFERENCES,
        })),
    }),
    {
      name: 'ai-settings-storage', // key in AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      version: 1, // useful for migrations
      migrate: (persistedState: any, version: number) => {
        // Robust validation/migration logic

        // Structural validation
        const isValidPreference = (pref: any): pref is AIModelPreference => {
          if (!pref || typeof pref !== 'object') return false;
          if (pref.mode === 'auto') return true;
          if (pref.mode === 'manual' && typeof pref.modelId === 'string' && pref.modelId.trim() !== '') {
            return true;
          }
          return false;
        };

        const state = persistedState as AISettingsState;
        
        // If state is corrupt or missing keys, fall back to defaults
        const validGroq = isValidPreference(state?.preferences?.groq) ? state.preferences.groq : DEFAULT_PREFERENCES.groq;
        const validGemini = isValidPreference(state?.preferences?.gemini) ? state.preferences.gemini : DEFAULT_PREFERENCES.gemini;
        const validLocal = isValidPreference(state?.preferences?.local) ? state.preferences.local : DEFAULT_PREFERENCES.local;

        return {
          preferences: {
            groq: validGroq,
            gemini: validGemini,
            local: validLocal,
          },
        };
      },
    }
  )
);
