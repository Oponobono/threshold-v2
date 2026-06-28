import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../store/useDataStore';
import { useConnectivityStore } from '../store/useConnectivityStore';
import { syncQueueRepository } from '../services/database';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { performCleanup } from '../services/cacheCleanupService';

export const useAutoSync = () => {
  const { syncPendingOperations, loadAllData } = useDataStore();
  const { setOnline } = useConnectivityStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);
  const syncInProgressRef = useRef<boolean>(false);
  const offlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    unsubscribeRef.current = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const hasInternetAccess = state.isInternetReachable ?? false;
      const isOnline = isConnected && hasInternetAccess;

      setOnline(isOnline);

      // Gestionar el toggle automático del modo Offline de la IA tras 10s (estándar UX móvil)
      if (!isOnline) {
        if (!offlineTimeoutRef.current) {
          offlineTimeoutRef.current = setTimeout(() => {
            console.log('[AutoSync] 10s sin red - activando modo offline IA local automáticamente');
            useLocalAIStore.getState().setForceOfflineMode(true);
          }, 10000);
        }
      } else {
        if (offlineTimeoutRef.current) {
          clearTimeout(offlineTimeoutRef.current);
          offlineTimeoutRef.current = null;
        }
        
        // Si estábamos en offline forzado automático, lo desactivamos al volver internet
        if (useLocalAIStore.getState().forceOfflineMode) {
          console.log('[AutoSync] Red restablecida - desactivando modo offline IA local automáticamente');
          useLocalAIStore.getState().setForceOfflineMode(false);
        }
      }

      if (
        wasOnlineRef.current === false &&
        isOnline === true &&
        !syncInProgressRef.current
      ) {
        syncInProgressRef.current = true;

        // OFFLINE-FIRST: al reconectar solo PUSH local → cloud.
        // No se hace pull de cloud → local porque el store local es la fuente de verdad.
        syncPendingOperations()
          .then((result) => {
            if (result.success > 0) {
              console.log(`[AutoSync] ✅ ${result.success} operaciones sincronizadas al cloud`);
            }
            performCleanup();
          })
          .catch((error) => {
            console.error('[AutoSync] ❌ Error en sincronización automática:', error);
          })
          .finally(() => {
            syncInProgressRef.current = false;
          });
      }

      wasOnlineRef.current = isOnline;
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [syncPendingOperations, loadAllData, setOnline]);

  return {
    getPendingCount: async () => syncQueueRepository.countPending(),
    manualSync: () => syncPendingOperations(),
  };
};
