import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { performCleanup } from '../services/cacheCleanupService';

const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 6;

let lastCleanupTime = 0;
const MIN_CLEANUP_INTERVAL = 1000 * 60 * 30;

export function useCacheCleanup() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const cleanup = useCallback(async () => {
    const now = Date.now();
    if (now - lastCleanupTime < MIN_CLEANUP_INTERVAL) return;
    lastCleanupTime = now;
    await performCleanup();
  }, []);

  useEffect(() => {
    cleanup();

    intervalRef.current = setInterval(() => {
      cleanup();
    }, CLEANUP_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        cleanup();
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [cleanup]);

  return { cleanup };
}
