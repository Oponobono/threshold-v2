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
  const { loadAllData, loadCachedDataOnly, hasLoadedOnce } = useDataStore();

  const loadDataProgressive = useCallback(async () => {
    if (hasLoadedOnce) {
      // Ya cargó una vez, solo actualizar
      console.log('[ProgressiveDataLoading] Datos ya cargados, actualizando...');
      await loadAllData(true);
      return;
    }

    // Primera carga: caché primero, luego servidor
    console.log('[ProgressiveDataLoading] 🚀 Iniciando carga progresiva...');
    
    // 1. Cargar del caché (muy rápido, <100ms)
    console.time('Load from cache');
    await loadCachedDataOnly();
    console.timeEnd('Load from cache');

    // 2. Actualizar desde servidor en paralelo (sin bloquear UI)
    console.log('[ProgressiveDataLoading] 🔄 Actualizando desde servidor...');
    loadAllData(true).catch((err) => {
      console.warn('[ProgressiveDataLoading] Error actualizando:', err);
    });
  }, [loadAllData, loadCachedDataOnly, hasLoadedOnce]);

  useEffect(() => {
    loadDataProgressive();
  }, [loadDataProgressive]);

  return { loadDataProgressive };
};
