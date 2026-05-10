import { useMemo, useRef } from 'react';
import { FlatList } from 'react-native';
import { type Subject } from '../services/api';

const SUBJECT_LOOP_THRESHOLD = 4;
const SUBJECT_LOOP_MULTIPLIER = 16;
export const SUBJECT_CARD_WIDTH = 208;
export const SUBJECT_CARD_GAP = 12;

export function useSubjectCarousel(subjects: Subject[]) {
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);
  const shouldUseInfiniteCarousel = subjects.length > SUBJECT_LOOP_THRESHOLD;

  const carouselSubjects = useMemo<(Subject & { __key: string })[]>(() => {
    if (!subjects.length) return [];
    if (!shouldUseInfiniteCarousel) {
      return subjects.map((s) => ({ ...s, __key: `${s.id}` }));
    }
    const result: (Subject & { __key: string })[] = [];
    for (let loop = 0; loop < SUBJECT_LOOP_MULTIPLIER; loop++) {
      for (const s of subjects) {
        result.push({ ...s, __key: `${s.id}-${loop}` });
      }
    }
    return result;
  }, [subjects, shouldUseInfiniteCarousel]);

  const initialScrollIndex = useMemo(() => {
    if (!shouldUseInfiniteCarousel || !subjects.length) return 0;
    return Math.floor(SUBJECT_LOOP_MULTIPLIER / 2) * subjects.length;
  }, [subjects.length, shouldUseInfiniteCarousel]);

  const normalizeCarouselPosition = (xOffset: number) => {
    if (!shouldUseInfiniteCarousel || !subjectsCarouselRef.current || !subjects.length) return;
    const itemSpan = SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP;
    const rawIndex = Math.round(xOffset / itemSpan);
    const lowerBoundary = subjects.length * 2;
    const upperBoundary = subjects.length * (SUBJECT_LOOP_MULTIPLIER - 2);
    if (rawIndex <= lowerBoundary || rawIndex >= upperBoundary) {
      const normalizedIndex = ((rawIndex % subjects.length) + subjects.length) % subjects.length;
      const targetIndex = initialScrollIndex + normalizedIndex;
      requestAnimationFrame(() => {
        subjectsCarouselRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      });
    }
  };

  return { subjectsCarouselRef, carouselSubjects, initialScrollIndex, normalizeCarouselPosition };
}
