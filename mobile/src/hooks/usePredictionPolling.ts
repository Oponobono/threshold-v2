import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDataStore } from '../store/useDataStore';

const PREDICTIONS_CACHE_KEY = '@threshold_predictions_cache';
const PREDICTIONS_TIMESTAMP_KEY = '@threshold_predictions_timestamp';
const POLLING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Hook que:
 * 1. Carga predicciones del cache al iniciar
 * 2. Hace polling cada 15 minutos
 * 3. Guarda en cache automáticamente
 * 
 * @param userId - ID del usuario
 * @param enabled - Si está habilitado el polling
 */
export const usePredictionPolling = (
  userId: string | number | null | undefined,
  enabled: boolean = true
) => {
  const { refreshPredictions, loadCachedPredictions } = useDataStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  // Al iniciar: cargar del cache
  useEffect(() => {
    if (initializedRef.current || !enabled) return;
    initializedRef.current = true;

    const initializePredictions = async () => {
      try {
        console.log(`[PredictionPolling] Cargando predicciones del cache`);
        await loadCachedPredictions();
      } catch (error) {
        console.error('[PredictionPolling] Error cargando cache:', error);
      }
    };

    initializePredictions();
  }, [enabled, loadCachedPredictions]);

  // Polling cada 15 minutos
  useEffect(() => {
    if (!enabled || !userId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Limpieza previa
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Primera actualización inmediata
    console.log(`[PredictionPolling] Primera actualización de predicciones`);
    refreshPredictions(userId);

    // Configurar polling cada 15 minutos
    intervalRef.current = setInterval(() => {
      console.log(`[PredictionPolling] Actualizando predicciones (polling)`);
      refreshPredictions(userId);
    }, POLLING_INTERVAL_MS);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, enabled, refreshPredictions]);
};

/**
 * Guarda predicciones en cache
 */
export const savePredictionsToCache = async (predictions: any) => {
  try {
    const timestamp = new Date().toISOString();
    await Promise.all([
      AsyncStorage.setItem(PREDICTIONS_CACHE_KEY, JSON.stringify(predictions)),
      AsyncStorage.setItem(PREDICTIONS_TIMESTAMP_KEY, timestamp),
    ]);
    console.log(`[PredictionsCache] Guardado en cache: ${timestamp}`);
  } catch (error) {
    console.error('[PredictionsCache] Error guardando cache:', error);
  }
};

/**
 * Carga predicciones del cache
 */
const PREDICTIONS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export const loadPredictionsFromCache = async () => {
  try {
    const [cached, timestamp] = await Promise.all([
      AsyncStorage.getItem(PREDICTIONS_CACHE_KEY),
      AsyncStorage.getItem(PREDICTIONS_TIMESTAMP_KEY),
    ]);
    if (cached) {
      if (timestamp) {
        const age = Date.now() - new Date(timestamp).getTime();
        if (age > PREDICTIONS_CACHE_TTL_MS) {
          console.log(`[PredictionsCache] Cache expirado (${Math.round(age / 60000)}min > 30min), ignorando`);
          return null;
        }
      }
      console.log(`[PredictionsCache] Predicciones cargadas del cache`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[PredictionsCache] Error cargando cache:', error);
    return null;
  }
};

/**
 * Limpia el cache de predicciones
 */
export const clearPredictionsCache = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(PREDICTIONS_CACHE_KEY),
      AsyncStorage.removeItem(PREDICTIONS_TIMESTAMP_KEY),
    ]);
    console.log(`[PredictionsCache] Cache limpiado`);
  } catch (error) {
    console.error('[PredictionsCache] Error limpiando cache:', error);
  }
};
