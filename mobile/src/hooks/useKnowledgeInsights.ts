import { useState, useEffect, useCallback, useRef } from 'react';
import { KnowledgeProjection } from '../domain/knowledge/KnowledgeProjection';
import { SnapshotBuildReason } from '../domain/knowledge/SnapshotTelemetryTypes';
import type { KnowledgeSnapshot } from '../domain/knowledge/types';
import { repositoryEventBus } from '../services/events/RepositoryEventBus';
import type { EntityEvent } from '../services/events/RepositoryEventBus';

const REBUILD_DEBOUNCE_MS = 300;

const RELEVANT_ENTITY_TYPES = ['flashcards', 'flashcard_decks'] as const;

type RelevantEntityType = typeof RELEVANT_ENTITY_TYPES[number];

const ENTITY_TO_REASON: Record<RelevantEntityType, SnapshotBuildReason> = {
  flashcards: SnapshotBuildReason.FLASHCARD_UPDATED,
  flashcard_decks: SnapshotBuildReason.ENTITY_UPDATED,
};

interface UseKnowledgeInsights {
  snapshot: KnowledgeSnapshot | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useKnowledgeInsights(userId: string | null | undefined): UseKnowledgeInsights {
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const projectionRef = useRef<KnowledgeProjection | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReasonRef = useRef<SnapshotBuildReason | null>(null);

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
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.warn('[useKnowledgeInsights] Error building snapshot:', e.message);
      setError(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    await buildSnapshot(SnapshotBuildReason.MANUAL_REFRESH, false);
  }, [buildSnapshot]);

  useEffect(() => {
    buildSnapshot(SnapshotBuildReason.BOOT, false);
  }, [buildSnapshot]);

  useEffect(() => {
    if (!userId) return;

    const scheduleRebuild = (reason: SnapshotBuildReason) => {
      if (!pendingReasonRef.current) {
        pendingReasonRef.current = reason;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const r = pendingReasonRef.current ?? SnapshotBuildReason.ENTITY_UPDATED;
        pendingReasonRef.current = null;
        buildSnapshot(r, true);
      }, REBUILD_DEBOUNCE_MS);
    };

    const handleEvent = (event: EntityEvent) => {
      const entityType = event.entityType as RelevantEntityType;
      const reason = ENTITY_TO_REASON[entityType] ?? SnapshotBuildReason.ENTITY_UPDATED;
      scheduleRebuild(reason);
    };

    const unsubs = RELEVANT_ENTITY_TYPES.map(entityType =>
      repositoryEventBus.on(entityType, handleEvent)
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
