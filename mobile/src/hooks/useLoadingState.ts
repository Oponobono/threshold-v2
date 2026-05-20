import { useState, useEffect } from 'react';

/**
 * Hook para controlar estados de loading de forma consistente
 * Asegura que haya al menos un tiempo mínimo de carga para evitar flicker
 */

interface UseLoadingStateOptions {
  minLoadingTime?: number; // Mínimo de ms para mostrar skeleton (evita flicker)
}

export type LoadingPhase = 'skeleton' | 'loading' | 'ready' | 'error';

interface UseLoadingStateReturn {
  phase: LoadingPhase;
  isLoading: boolean;
  isSkeleton: boolean;
  isReady: boolean;
  isError: boolean;
  setReady: () => void;
  setError: () => void;
  reset: () => void;
}

/**
 * Hook para manejar fases de loading
 * 
 * skeleton → loading → ready
 * 
 * Ejemplo:
 * ```tsx
 * const { phase, isSkeleton, isReady } = useLoadingState();
 * 
 * return (
 *   <>
 *     {isSkeleton && <DashboardLoadingState />}
 *     {isReady && <Dashboard {...data} />}
 *   </>
 * );
 * ```
 */
export const useLoadingState = (
  options: UseLoadingStateOptions = {}
): UseLoadingStateReturn => {
  const { minLoadingTime = 300 } = options;
  const [phase, setPhase] = useState<LoadingPhase>('skeleton');
  const [loadingStartTime, setLoadingStartTime] = useState(Date.now());

  const setReady = () => {
    const elapsedTime = Date.now() - loadingStartTime;
    const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

    if (remainingTime > 0) {
      setTimeout(() => setPhase('ready'), remainingTime);
    } else {
      setPhase('ready');
    }
  };

  const setError = () => setPhase('error');
  const reset = () => {
    setPhase('skeleton');
    setLoadingStartTime(Date.now());
  };

  return {
    phase,
    isLoading: phase === 'loading' || phase === 'skeleton',
    isSkeleton: phase === 'skeleton',
    isReady: phase === 'ready',
    isError: phase === 'error',
    setReady,
    setError,
    reset,
  };
};

/**
 * Hook para precargar datos con indicador de loading
 * Carga datos del caché primero, luego actualiza desde servidor
 */
interface UseProgressiveLoadOptions {
  initialData?: any;
  minSkeletonTime?: number;
  onError?: (error: Error) => void;
}

export const useProgressiveLoad = (
  loadFn: () => Promise<any>,
  options: UseProgressiveLoadOptions = {}
) => {
  const { initialData = null, minSkeletonTime = 300, onError } = options;
  const [data, setData] = useState(initialData);
  const [phase, setPhase] = useState<LoadingPhase>('skeleton');
  const loadStartRef = useRef(Date.now());

  useEffect(() => {
    loadStartRef.current = Date.now();
    let isMounted = true;

    const load = async () => {
      try {
        const result = await loadFn();
        if (!isMounted) return;

        // Respeta minSkeletonTime para evitar flicker
        const elapsedTime = Date.now() - loadStartRef.current;
        const remainingTime = Math.max(0, minSkeletonTime - elapsedTime);

        if (remainingTime > 0) {
          setTimeout(() => {
            if (isMounted) {
              setData(result);
              setPhase('ready');
            }
          }, remainingTime);
        } else {
          setData(result);
          setPhase('ready');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('[useProgressiveLoad] Error:', error);
        onError?.(error as Error);
        setPhase('error');
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [loadFn, minSkeletonTime, onError]);

  return {
    data,
    phase,
    isLoading: phase === 'skeleton' || phase === 'loading',
    isSkeleton: phase === 'skeleton',
    isReady: phase === 'ready',
    isError: phase === 'error',
  };
};

// Import React necesarios
import { useRef } from 'react';
