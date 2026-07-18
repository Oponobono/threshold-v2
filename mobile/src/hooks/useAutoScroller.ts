import { useCallback, useEffect, useRef, useState } from 'react';

interface AutoScrollerPolicy {
  pixelsPerSecond?: number;
  pauseAtEnd?: number;
  returnDuration?: number;
  maxLoops?: number;
}

interface AutoScrollerResult {
  trigger: (dist: number) => void;
  cancel: () => void;
  isAnimating: boolean;
  loopsCompleted: number;
}

export function useAutoScroller(
  overflows: boolean,
  scrollTo: (x: number) => void,
  policy: AutoScrollerPolicy = {},
): AutoScrollerResult {
  const {
    pixelsPerSecond = 50,
    pauseAtEnd = 1000,
    returnDuration = 600,
    maxLoops = 0,
  } = policy;

  const [isAnimating, setIsAnimating] = useState(false);
  const [loopsCompleted, setLoopsCompleted] = useState(0);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const loopsRef = useRef(0);

  const clearTimers = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const animateLoop = useCallback(
    (dist: number) => {
      if (cancelledRef.current) return;

      const scrollMs = (dist / pixelsPerSecond) * 1000;
      let start: number | null = null;

      const scrollToEnd = (timestamp: number) => {
        if (cancelledRef.current) return;
        if (start === null) start = timestamp;

        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / scrollMs, 1);
        scrollTo(dist * progress);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(scrollToEnd);
        } else {
          timerRef.current = setTimeout(() => {
            if (cancelledRef.current) return;

            let returnStart: number | null = null;
            const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

            const scrollToStart = (ts: number) => {
              if (cancelledRef.current) return;
              if (returnStart === null) returnStart = ts;

              const elapsed = ts - returnStart;
              const progress = Math.min(elapsed / returnDuration, 1);
              scrollTo(dist * (1 - easeOut(progress)));

              if (progress < 1) {
                rafRef.current = requestAnimationFrame(scrollToStart);
              } else {
                loopsRef.current += 1;
                setLoopsCompleted(loopsRef.current);

                if (maxLoops > 0 && loopsRef.current < maxLoops) {
                  animateLoop(dist);
                } else {
                  setIsAnimating(false);
                }
              }
            };
            rafRef.current = requestAnimationFrame(scrollToStart);
          }, pauseAtEnd);
        }
      };

      rafRef.current = requestAnimationFrame(scrollToEnd);
    },
    [pixelsPerSecond, pauseAtEnd, returnDuration, maxLoops, scrollTo],
  );

  const trigger = useCallback(
    (dist: number) => {
      if (!overflows || isAnimating) return;
      if (maxLoops > 0 && loopsRef.current >= maxLoops) return;

      setIsAnimating(true);
      loopsRef.current = 0;
      setLoopsCompleted(0);
      cancelledRef.current = false;
      animateLoop(dist);
    },
    [overflows, isAnimating, maxLoops, animateLoop],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    setIsAnimating(false);
    scrollTo(0);
  }, [clearTimers, scrollTo]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimers();
    };
  }, [clearTimers]);

  return { trigger, cancel, isAnimating, loopsCompleted };
}
