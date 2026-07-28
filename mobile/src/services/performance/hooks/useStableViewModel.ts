import { useRef, useMemo, DependencyList } from 'react';

export function useStableViewModel<T>(
  builder: () => T,
  deps: DependencyList,
  comparator?: (prev: T, next: T) => boolean
): T {
  const prevRef = useRef<T | undefined>(undefined);

  return useMemo(() => {
    const next = builder();
    if (prevRef.current && comparator?.(prevRef.current, next)) {
      return prevRef.current;
    }
    prevRef.current = next;
    return next;
  }, deps);
}
