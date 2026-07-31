import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { KnowledgeProjection, invalidateKnowledgeCache } from '../domain/knowledge/KnowledgeProjection';
import { SnapshotBuildReason } from '../domain/knowledge/SnapshotTelemetryTypes';
import type { KnowledgeSnapshot } from '../domain/knowledge/types';
import { repositoryEventBus } from '../services/events/RepositoryEventBus';
import type { EntityEvent } from '../services/events/RepositoryEventBus';
import type { MMKV } from 'react-native-mmkv';

const REBUILD_DEBOUNCE_MS = 300;
const RELEVANT_ENTITY_TYPES = ['flashcards', 'flashcard_decks'] as const;
type RelevantEntityType = typeof RELEVANT_ENTITY_TYPES[number];

const ENTITY_TO_REASON: Record<RelevantEntityType, SnapshotBuildReason> = {
  flashcards: SnapshotBuildReason.FLASHCARD_UPDATED,
  flashcard_decks: SnapshotBuildReason.ENTITY_UPDATED,
};

// Lazy init: el require() está DENTRO de la función para que se ejecute en el primer
// call (post-bootstrap, nativo listo), no en la evaluación del módulo.
// Expo Router evalúa los módulos del dashboard al escanear rutas, antes de que
// el TurboModule de MMKV esté registrado — require() a nivel de módulo capturaría undefined.
let _mmkv: MMKV | null = null;
function getMMKV(): MMKV {
  if (!_mmkv) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv');
    _mmkv = createMMKV({ id: 'knowledge-cache' });
  }
  return _mmkv!;
}
const KNOWLEDGE_CACHE_KEY = 'cache:knowledge_snapshot:';
const KNOWLEDGE_SCHEMA_VERSION = 1;

interface CachedKnowledgePayload {
  snapshot: KnowledgeSnapshot;
  generatedAt: number;
  schemaVersion: number;
}

function loadCachedSnapshot(userId: string | null | undefined): KnowledgeSnapshot | null {
  if (!userId) return null;
  try {
    const data = getMMKV().getString(`${KNOWLEDGE_CACHE_KEY}${userId}`);
    if (!data) return null;
    const parsed = JSON.parse(data) as CachedKnowledgePayload;
    if (parsed.schemaVersion === KNOWLEDGE_SCHEMA_VERSION && parsed.snapshot) {
      return parsed.snapshot;
    }
  } catch (e) {
    console.warn('[useKnowledgeInsights] Error loading cache', e);
  }
  return null;
}

function saveCachedSnapshot(userId: string | null | undefined, snapshot: KnowledgeSnapshot) {
  if (!userId) return;
  try {
    const payload: CachedKnowledgePayload = {
      snapshot,
      generatedAt: Date.now(),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    };
    getMMKV().set(`${KNOWLEDGE_CACHE_KEY}${userId}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('[useKnowledgeInsights] Error saving cache', e);
  }
}

interface UseKnowledgeInsights {
  snapshot: KnowledgeSnapshot | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * useKnowledgeInsights
 *
 * Dispara el snapshot de arranque (BOOT) automáticamente en mount,
 * inmediatamente después de cargar la caché desde MMKV.
 * No depende del DashboardCoordinator — es completamente autónomo.
 *
 * bootDoneRef previene duplicados si el hook se re-monta o userId cambia.
 */
export function useKnowledgeInsights(
  userId: string | null | undefined,
): UseKnowledgeInsights {
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const projectionRef = useRef<KnowledgeProjection | null>(null);


  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReasonRef = useRef<SnapshotBuildReason | null>(null);
  const bootDoneRef = useRef(false);
  const buildSnapshotRef = useRef<((reason: SnapshotBuildReason, silent: boolean) => Promise<void>) | null>(null);

  const buildSnapshot = useCallback(async (reason: SnapshotBuildReason, silent: boolean) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (!projectionRef.current) {
        projectionRef.current = new KnowledgeProjection();
      }
      const result = await projectionRef.current.buildSnapshot(userId, reason);
      setSnapshot(result);
      saveCachedSnapshot(userId, result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.warn('[useKnowledgeInsights] Error building snapshot:', e.message);
      setError(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  // Mantener el ref actualizado con la última versión de buildSnapshot
  buildSnapshotRef.current = buildSnapshot;

  const refresh = useCallback(async () => {
    await buildSnapshot(SnapshotBuildReason.MANUAL_REFRESH, false);
  }, [buildSnapshot]);

  // Reset al cambiar sesión y disparar boot snapshot automáticamente
  useEffect(() => {
    bootDoneRef.current = false;
    if (!userId) {
      setSnapshot(null);
      return;
    }
    setSnapshot(loadCachedSnapshot(userId));
    // Diferir el build de BOOT hasta que las animaciones de transición
    // de pantalla hayan terminado. Evita bloquear el JS thread durante
    // la animación de entrada, que era la causa del "black flash".
    bootDoneRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      buildSnapshotRef.current?.(SnapshotBuildReason.BOOT, true);
    });
    return () => task.cancel();
  }, [userId]);

  const lastEventTimeRef = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const scheduleRebuild = (reason: SnapshotBuildReason) => {
      if (!pendingReasonRef.current) {
        pendingReasonRef.current = reason;
      }
      
      lastEventTimeRef.current = Date.now();

      if (!debounceTimerRef.current) {
        const checkDebounce = () => {
          const elapsed = Date.now() - lastEventTimeRef.current;
          if (elapsed < REBUILD_DEBOUNCE_MS) {
            debounceTimerRef.current = setTimeout(checkDebounce, REBUILD_DEBOUNCE_MS - elapsed);
          } else {
            debounceTimerRef.current = null;
            const r = pendingReasonRef.current ?? SnapshotBuildReason.ENTITY_UPDATED;
            pendingReasonRef.current = null;
            if (userId) invalidateKnowledgeCache(userId);
            buildSnapshot(r, true);
          }
        };
        debounceTimerRef.current = setTimeout(checkDebounce, REBUILD_DEBOUNCE_MS);
      }
    };

    const unsubs = RELEVANT_ENTITY_TYPES.map(entityType =>
      repositoryEventBus.onBatch(entityType, () => {
        const reason = ENTITY_TO_REASON[entityType] ?? SnapshotBuildReason.ENTITY_UPDATED;
        scheduleRebuild(reason);
      })
    );

    return () => {
      unsubs.forEach(unsub => unsub());
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingReasonRef.current = null;
    };
  }, [userId, buildSnapshot]);

  return { snapshot, loading, error, refresh };
}
