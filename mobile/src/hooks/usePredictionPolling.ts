import { useEffect, useRef } from 'react';
import type { MMKV } from 'react-native-mmkv';
import type { PredictionResponse } from '../store/useDataStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports (moved inside getMMKV)

const PREDICTIONS_CACHE_KEY = 'predictions_cache_v1';
const PREDICTIONS_SCHEMA_VERSION = 1;
const POLLING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

// Lazy init: el require() está DENTRO de la función para que se ejecute en el primer
// call (post-bootstrap, nativo listo), no en la evaluación del módulo.
// Expo Router evalúa los módulos al escanear rutas antes de que el TurboModule de MMKV esté registrado.
let _mmkv: MMKV | null = null;
function getMMKV(): MMKV {
  if (!_mmkv) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv');
    _mmkv = createMMKV({ id: 'predictions-cache' });
  }
  return _mmkv!;
}

export interface CachedPredictionsPayload {
  schemaVersion: number;
  generatedAt: number;
  userId: string;
  predictions: PredictionResponse;
}

/**
 * Lee el Boot Presentation Cache de forma síncrona (MMKV).
 *
 * Responsabilidad única: hidratar la UI inmediatamente al arranque.
 * No decide si el dato es "fresco" — eso es trabajo del refresco de fondo.
 *
 * Retorna null solo en tres casos:
 *   1. No existe caché.
 *   2. El userId no coincide (protección contra sesiones cruzadas).
 *   3. El schemaVersion es incompatible.
 */
export function loadPredictionsFromCache(userId: string): CachedPredictionsPayload | null {
  try {
    const raw = getMMKV().getString(PREDICTIONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPredictionsPayload;
    if (
      parsed.schemaVersion !== PREDICTIONS_SCHEMA_VERSION ||
      parsed.userId !== userId ||
      !parsed.predictions
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Guarda el resultado de un cálculo fresco de SQLite en el Boot Presentation Cache.
 * Síncrono — no cruza el bridge JS-Native.
 */
export function savePredictionsToCache(userId: string, predictions: PredictionResponse): void {
  try {
    const payload: CachedPredictionsPayload = {
      schemaVersion: PREDICTIONS_SCHEMA_VERSION,
      generatedAt: Date.now(),
      userId,
      predictions,
    };
    getMMKV().set(PREDICTIONS_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[PredictionsCache] Error guardando cache', e);
  }
}

/**
 * Hook que:
 * 1. Lanza la primera actualización de predicciones cuando el core del
 *    Dashboard ya terminó (coreReady=true), garantizando que el Flashcards
 *    JOIN no compita con Schedule/GPA/Knowledge.
 * 2. Hace polling cada 15 minutos a partir de ese punto.
 *
 * @param userId    - ID del usuario
 * @param enabled   - Si el polling está habilitado
 * @param coreReady - Señal del DashboardCoordinator: true cuando Schedule+GPA
 *                    completaron. La primera carga espera esta señal.
 */
export const usePredictionPolling = (
  userId: string | number | null | undefined,
  enabled: boolean = true,
  coreReady: boolean = true,
) => {
  const { useDataStore } = require('../store/useDataStore') as typeof import('../store/useDataStore');
  const { refreshPredictions } = useDataStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstRunDoneRef = useRef(false);

  // Primera actualización: espera coreReady (Schedule+GPA done).
  // Sin timer fijo — el coordinator es la señal real.
  useEffect(() => {
    if (!enabled || !userId || !coreReady || firstRunDoneRef.current) return;
    firstRunDoneRef.current = true;
    refreshPredictions(userId);
  }, [userId, enabled, coreReady, refreshPredictions]);

  // Polling recurrente cada 15 minutos
  useEffect(() => {
    if (!enabled || !userId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      refreshPredictions(userId);
    }, POLLING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, enabled, refreshPredictions]);
};
