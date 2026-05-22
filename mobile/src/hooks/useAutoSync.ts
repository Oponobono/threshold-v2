/**
 * useAutoSync.ts
 *
 * Hook que detecta cambios en la conectividad de red y sincroniza
 * automáticamente las operaciones offline pendientes cuando recupera conexión.
 */

import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../store/useDataStore';
import { offlineSyncService } from '../services/offlineSyncService';

/**
 * Detecta cuando el usuario recupera conexión a internet y sincroniza automáticamente
 */
export const useAutoSync = () => {
  const { syncPendingOperations } = useDataStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);
  const syncInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    // Subscribirse a cambios de conectividad
    unsubscribeRef.current = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const hasInternetAccess = state.isInternetReachable ?? false;
      const isOnline = isConnected && hasInternetAccess;

      // Detectar transición de offline a online
      if (
        wasOnlineRef.current === false &&
        isOnline === true &&
        !syncInProgressRef.current
      ) {
        console.log('[AutoSync] 🌐 Conexión recuperada, sincronizando operaciones pendientes...');
        
        // Verificar si hay operaciones pendientes antes de sincronizar
        const pendingCount = offlineSyncService.getPendingCount();
        if (pendingCount > 0) {
          syncInProgressRef.current = true;
          syncPendingOperations()
            .then((result) => {
              console.log(`[AutoSync] ✅ Sincronización automática completada:`, result);
            })
            .catch((error) => {
              console.error('[AutoSync] ❌ Error en sincronización automática:', error);
            })
            .finally(() => {
              syncInProgressRef.current = false;
            });
        } else {
          console.log('[AutoSync] ℹ️ Conexión recuperada pero no hay operaciones pendientes');
        }
      }

      wasOnlineRef.current = isOnline;
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [syncPendingOperations]);

  return {
    getPendingCount: () => offlineSyncService.getPendingCount(),
    manualSync: () => syncPendingOperations(),
  };
};
