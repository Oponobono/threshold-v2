/**
 * useConnectivityStore.ts
 *
 * Store Zustand para manejar el estado de conectividad y sincronización.
 * Se mantiene sincronizado con NetInfo y offlineSyncService.
 */

import { create } from 'zustand';

export type ConnectivityState = 'online' | 'offline' | 'syncing' | 'success';

interface ConnectivityStoreState {
  // Estado
  isOnline: boolean;
  isSyncing: boolean;
  syncMessage: string;
  pendingCount: number;
  state: ConnectivityState;

  // Acciones
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setSyncMessage: (message: string) => void;
  setPendingCount: (count: number) => void;
  setSuccess: () => void;
  reset: () => void;
}

export const useConnectivityStore = create<ConnectivityStoreState>((set) => ({
  isOnline: true,
  isSyncing: false,
  syncMessage: '',
  pendingCount: 0,
  state: 'online',

  setOnline: (isOnline: boolean) => {
    set((state) => {
      const newState: ConnectivityState = isOnline ? 'online' : 'offline';
      return {
        isOnline,
        state: newState,
        // Limpiar mensaje cuando vuelve online
        syncMessage: isOnline && state.state === 'offline' ? '' : state.syncMessage,
      };
    });
  },

  setSyncing: (isSyncing: boolean) => {
    set({
      isSyncing,
      state: isSyncing ? 'syncing' : 'online',
      syncMessage: isSyncing ? 'Sincronizando...' : '',
    });
  },

  setSyncMessage: (message: string) => {
    set({ syncMessage: message });
  },

  setPendingCount: (count: number) => {
    set({ pendingCount: count });
  },

  setSuccess: () => {
    set({
      state: 'success',
      syncMessage: '✓ Sincronización completada',
      isSyncing: false,
      pendingCount: 0,
    });
    // Auto-hide después de 2 segundos
    setTimeout(() => {
      set({ state: 'online', syncMessage: '' });
    }, 2000);
  },

  reset: () => {
    set({
      isOnline: true,
      isSyncing: false,
      syncMessage: '',
      pendingCount: 0,
      state: 'online',
    });
  },
}));
