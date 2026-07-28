import { useRef, useMemo } from 'react';

export function useStableArray<T>(
  items: T[],
  keyFn: (item: T, index: number) => string | number = (_, i) => i
): T[] {
  const prevRef = useRef<T[]>([]);

  return useMemo(() => {
    if (
      prevRef.current.length === items.length &&
      prevRef.current.every((p, i) => keyFn(p, i) === keyFn(items[i], i))
    ) {
      return prevRef.current;
    }
    prevRef.current = items;
    return items;
  }, [items, keyFn]);
}
