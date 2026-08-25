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
  const { loadAllData } = useDataStore();

  const loadDataProgressive = useCallback(async () => {
    console.log('[ProgressiveDataLoading] 🚀 Iniciando carga progresiva...');
    loadAllData().catch((err) => {
      console.warn('[ProgressiveDataLoading] Error actualizando:', err);
    });
  }, [loadAllData]);

  useEffect(() => {
    loadDataProgressive();
  }, [loadDataProgressive]);

  return { loadDataProgressive };
};
