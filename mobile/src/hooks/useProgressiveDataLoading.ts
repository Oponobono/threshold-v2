import { useEffect, useCallback } from 'react';
import { useDataStore } from '../store/useDataStore';

/**
 * Hook para cargar datos de forma progresiva al reabrirse la app.
 * 
 * Estrategia:
 * 1. Primero carga del caché (instantáneo) - evita pantalla en blanco
 * 2. Luego actualiza del servidor en background (no bloquea)
 * 3. Guarda nuevos datos en caché para próxima apertura
 * 
 * Uso:
 * ```tsx
 * useProgressiveDataLoading();
 * ```
 */
export const useProgressiveDataLoading = () => {
  const { loadAllData, hasLoadedOnce } = useDataStore();

  const loadDataProgressive = useCallback(async () => {
    if (hasLoadedOnce) {
      // Bootstrap ya cargó los datos. El sync engine actualiza el store reactivamente.
      // No necesitamos re-leer SQLite completo aquí.
      return;
    }

    console.log('[ProgressiveDataLoading] 🚀 Iniciando carga progresiva...');
    loadAllData().catch((err) => {
      console.warn('[ProgressiveDataLoading] Error actualizando:', err);
    });
  }, [loadAllData, hasLoadedOnce]);

  useEffect(() => {
    loadDataProgressive();
  }, [loadDataProgressive]);

  return { loadDataProgressive };
};
