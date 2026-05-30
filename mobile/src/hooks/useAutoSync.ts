/**
 * useAutoSync.ts
 *
 * Hook que detecta cambios en la conectividad de red y sincroniza
 * automáticamente las operaciones offline pendientes cuando recupera conexión.
 * Además refresca los datos principales (subjects, assessments, schedules)
 * para asegurar que el usuario vea la información más reciente.
 */

import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../store/useDataStore';
import { useConnectivityStore } from '../store/useConnectivityStore';
import { offlineSyncService } from '../services/offlineSyncService';

/**
 * Detecta cuando el usuario recupera conexión a internet y sincroniza automáticamente
 */
export const useAutoSync = () => {
  const { syncPendingOperations, loadAllData } = useDataStore();
  const { setOnline, setSyncing, setSuccess } = useConnectivityStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);
  const syncInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    // Subscribirse a cambios de conectividad
    unsubscribeRef.current = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const hasInternetAccess = state.isInternetReachable ?? false;
      const isOnline = isConnected && hasInternetAccess;

      // Actualizar estado de conectividad en el store
      setOnline(isOnline);

      // Detectar transición de offline a online
      if (
        wasOnlineRef.current === false &&
        isOnline === true &&
        !syncInProgressRef.current
      ) {
        console.log('[AutoSync] 🌐 Conexión recuperada, refrescando datos...');

        syncInProgressRef.current = true;
        setSyncing(true);

        // 1. Primero sincronizar operaciones offline pendientes (escrituras)
        // 2. Luego refrescar datos principales del servidor (lecturas)
        syncPendingOperations()
          .then((result) => {
            if (result.success > 0) {
              console.log(`[AutoSync] ✅ ${result.success} operaciones sincronizadas`);
            }
            // Refrescar datos aunque no haya operaciones pendientes
            // para asegurar datos actualizados
            return loadAllData(true);
          })
          .then(() => {
            console.log('[AutoSync] ✅ Datos refrescados exitosamente');
            setSuccess();
          })
          .catch((error) => {
            console.error('[AutoSync] ❌ Error en sincronización automática:', error);
            setSyncing(false);
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
  }, [syncPendingOperations, loadAllData, setOnline, setSyncing, setSuccess]);

  return {
    getPendingCount: () => offlineSyncService.getPendingCount(),
    manualSync: () => syncPendingOperations(),
  };
};
