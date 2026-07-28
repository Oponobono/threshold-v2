import { useRef, useCallback } from 'react';

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef<T | undefined>(undefined);
  if (!ref.current) {
    ref.current = callback;
  } else {
    ref.current = callback;
  }
  return useCallback(((...args: any[]) => ref.current!(...args)) as unknown as T, []);
}
