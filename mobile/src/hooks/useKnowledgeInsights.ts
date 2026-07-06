import { useState, useEffect, useCallback, useRef } from 'react';
import { KnowledgeProjection } from '../domain/knowledge/KnowledgeProjection';
import type { KnowledgeSnapshot } from '../domain/knowledge/types';

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

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      if (!projectionRef.current) {
        projectionRef.current = new KnowledgeProjection();
      }
      const result = await projectionRef.current.buildSnapshot(userId);
      setSnapshot(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.warn('[useKnowledgeInsights] Error building snapshot:', e.message);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}
