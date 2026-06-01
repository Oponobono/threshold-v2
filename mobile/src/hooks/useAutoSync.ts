import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../store/useDataStore';
import { useConnectivityStore } from '../store/useConnectivityStore';
import { offlineSyncService } from '../services/offlineSyncService';
import { useLocalAIStore } from '../store/useLocalAIStore';

export const useAutoSync = () => {
  const { syncPendingOperations, loadAllData } = useDataStore();
  const { setOnline } = useConnectivityStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);
  const syncInProgressRef = useRef<boolean>(false);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    unsubscribeRef.current = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const hasInternetAccess = state.isInternetReachable ?? false;
      const isOnline = isConnected && hasInternetAccess;

      setOnline(isOnline);

      // Gestionar el toggle automático del modo Offline de la IA tras 60s
      if (!isOnline) {
        if (!offlineTimeoutRef.current) {
          offlineTimeoutRef.current = setTimeout(() => {
            console.log('[AutoSync] 60s sin red - activando modo offline IA local automáticamente');
            useLocalAIStore.getState().setForceOfflineMode(true);
          }, 60000);
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

        syncPendingOperations()
          .then((result) => {
            if (result.success > 0) {
              console.log(`[AutoSync] ✅ ${result.success} operaciones sincronizadas`);
            }
            return loadAllData(true);
          })
          .then(() => {
            console.log('[AutoSync] ✅ Datos refrescados exitosamente');
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
    getPendingCount: () => offlineSyncService.getPendingCount(),
    manualSync: () => syncPendingOperations(),
  };
};
