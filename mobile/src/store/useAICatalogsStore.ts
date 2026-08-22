import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnlineModel {
  provider: 'groq' | 'gemini';
  modelId: string;
  capabilities: string[];
  isAvailable: boolean; // MUST mean strictly "exists in provider discovery", NOT "eligible for feature"
}

export interface LocalModelCatalogEntry {
  modelId: string;
  familyId: string;
  quantization: string;
  isListedRemotely: boolean;
  isInstalled: boolean;
  downloadUrl?: string;
  capabilities: string[];
  isNewFamily: boolean; // Pure metadata tag, not a UX state
  isNewQuantization: boolean; // Pure metadata tag
}

export type OnlineCatalogStatus = 'loading' | 'loaded' | 'cached' | 'empty';

export interface AICatalogsState {
  onlineCatalog: OnlineModel[];
  localCatalog: LocalModelCatalogEntry[];
  onlineCatalogStatus: OnlineCatalogStatus;
  
  // Status flags for UI loading states
  isFetchingOnline: boolean;
  isFetchingLocal: boolean;
  lastOnlineFetchAt: number | null;
  lastLocalFetchAt: number | null;
  
  // Actions
  setOnlineCatalog: (models: OnlineModel[]) => void;
  setLocalCatalog: (models: LocalModelCatalogEntry[]) => void;
  setFetchingOnline: (isFetching: boolean) => void;
  setFetchingLocal: (isFetching: boolean) => void;
  setOnlineCatalogStatus: (status: OnlineCatalogStatus) => void;
}

export const useAICatalogsStore = create<AICatalogsState>()(
  persist(
    (set) => ({
      onlineCatalog: [],
      localCatalog: [],
      onlineCatalogStatus: 'loading',
      isFetchingOnline: false,
      isFetchingLocal: false,
      lastOnlineFetchAt: null,
      lastLocalFetchAt: null,

      setOnlineCatalog: (models) =>
        set({ onlineCatalog: models, lastOnlineFetchAt: Date.now() }),

      setLocalCatalog: (models) =>
        set({ localCatalog: models, lastLocalFetchAt: Date.now() }),

      setFetchingOnline: (isFetching) => set({ isFetchingOnline: isFetching }),
      setFetchingLocal: (isFetching) => set({ isFetchingLocal: isFetching }),
      setOnlineCatalogStatus: (status) => set({ onlineCatalogStatus: status }),
    }),
    {
      name: 'ai-catalogs-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Solo persistimos los catálogos en sí para offline-first, ignoramos los flags de isFetching
      partialize: (state) => ({
        onlineCatalog: state.onlineCatalog,
        localCatalog: state.localCatalog,
        lastOnlineFetchAt: state.lastOnlineFetchAt,
        lastLocalFetchAt: state.lastLocalFetchAt,
      }),
      migrate: (persistedState: any, version: number) => {
        // En caso de corrupción, garantizamos al menos arrays vacíos
        const state = persistedState as Partial<AICatalogsState>;
        return {
          onlineCatalog: Array.isArray(state?.onlineCatalog) ? state.onlineCatalog : [],
          localCatalog: Array.isArray(state?.localCatalog) ? state.localCatalog : [],
          lastOnlineFetchAt: typeof state?.lastOnlineFetchAt === 'number' ? state.lastOnlineFetchAt : null,
          lastLocalFetchAt: typeof state?.lastLocalFetchAt === 'number' ? state.lastLocalFetchAt : null,
        } as AICatalogsState;
      },
    }
  )
);
