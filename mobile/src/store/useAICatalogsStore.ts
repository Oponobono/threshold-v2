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

export type OnlineDataStatus = 'empty' | 'cached' | 'loaded';
export type OnlineRefreshStatus = 'idle' | 'refreshing' | 'error';

export interface AICatalogsState {
  onlineCatalog: OnlineModel[];
  localCatalog: LocalModelCatalogEntry[];
  
  onlineDataStatus: OnlineDataStatus;
  onlineRefreshStatus: OnlineRefreshStatus;
  
  // Status flags for UI loading states
  isFetchingLocal: boolean;
  lastOnlineFetchAt: number | null;
  lastLocalFetchAt: number | null;
  
  // Actions
  setOnlineCatalog: (models: OnlineModel[]) => void;
  setLocalCatalog: (models: LocalModelCatalogEntry[]) => void;
  setOnlineRefreshStatus: (status: OnlineRefreshStatus) => void;
  setFetchingLocal: (isFetching: boolean) => void;
  setOnlineDataStatus: (status: OnlineDataStatus) => void;
}

export const useAICatalogsStore = create<AICatalogsState>()(
  persist(
    (set) => ({
      onlineCatalog: [],
      localCatalog: [],
      onlineDataStatus: 'empty',
      onlineRefreshStatus: 'idle',
      isFetchingLocal: false,
      lastOnlineFetchAt: null,
      lastLocalFetchAt: null,

      setOnlineCatalog: (models) =>
        set({
          onlineCatalog: models,
          lastOnlineFetchAt: Date.now(),
          onlineDataStatus: models.length > 0 ? 'loaded' : 'empty',
          onlineRefreshStatus: 'idle',
        }),

      setLocalCatalog: (models) =>
        set({ localCatalog: models, lastLocalFetchAt: Date.now() }),

      setOnlineRefreshStatus: (status) =>
        set({ onlineRefreshStatus: status }),

      setFetchingLocal: (isFetching) => set({ isFetchingLocal: isFetching }),
      
      setOnlineDataStatus: (status) => set({ onlineDataStatus: status }),
    }),
    {
      name: 'ai-catalogs-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Solo persistimos los catálogos en sí para offline-first, ignoramos los flags efímeros
      partialize: (state) => ({
        onlineCatalog: state.onlineCatalog,
        localCatalog: state.localCatalog,
        lastOnlineFetchAt: state.lastOnlineFetchAt,
        lastLocalFetchAt: state.lastLocalFetchAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.onlineDataStatus = state.onlineCatalog.length > 0 ? 'cached' : 'empty';
          state.onlineRefreshStatus = 'idle';
        }
      },
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

/**
 * Espera de manera determinista a que la hidratación local del catálogo termine.
 * Esto debe llamarse durante el Bootstrap antes del READY.
 * Incluye un timeout para no bloquear la app indefinidamente si falla el storage.
 * @returns true si se hidrató correctamente, false si ocurrió un timeout.
 */
export async function waitForAICatalogHydration(): Promise<boolean> {
  if (useAICatalogsStore.persist.hasHydrated()) {
    return true;
  }
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[AICatalogStore] Hydration timeout reached');
        resolve(false);
      }
    }, 2000); // 2 segundos máximo de espera

    const unsub = useAICatalogsStore.persist.onFinishHydration(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(true);
      }
      unsub();
    });
  });
}
