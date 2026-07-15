import { useState, useCallback, useMemo } from 'react';
import type { DocumentModel } from './DocumentModel';
import type { SearchQuery, SearchResult, SearchMatch } from './DocumentSearch';
import { DocumentSearchService } from './DocumentSearchService';

export interface SearchNavigatorState {
  readonly query: string;
  readonly results: SearchResult;
  readonly currentIndex: number;
  readonly currentMatch: SearchMatch | null;
  readonly isActive: boolean;
}

export function useSearchNavigator(model: DocumentModel) {
  const [state, setState] = useState<SearchNavigatorState>({
    query: '',
    results: { query: '', matches: [], total: 0 },
    currentIndex: -1,
    currentMatch: null,
    isActive: false,
  });

  const searchService = useMemo(() => new DocumentSearchService(), []);

  const search = useCallback(
    (query: SearchQuery) => {
      const results = searchService.search(model, query);
      const firstMatch = results.matches[0] || null;
      setState({
        query: query.text,
        results,
        currentIndex: firstMatch ? 0 : -1,
        currentMatch: firstMatch,
        isActive: query.text.trim().length > 0,
      });
      return results;
    },
    [model, searchService],
  );

  const next = useCallback(() => {
    setState(prev => {
      if (prev.results.matches.length === 0) return prev;
      const nextIndex = (prev.currentIndex + 1) % prev.results.matches.length;
      return {
        ...prev,
        currentIndex: nextIndex,
        currentMatch: prev.results.matches[nextIndex],
      };
    });
  }, []);

  const prev = useCallback(() => {
    setState(prev => {
      if (prev.results.matches.length === 0) return prev;
      const prevIndex =
        (prev.currentIndex - 1 + prev.results.matches.length) %
        prev.results.matches.length;
      return {
        ...prev,
        currentIndex: prevIndex,
        currentMatch: prev.results.matches[prevIndex],
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState({
      query: '',
      results: { query: '', matches: [], total: 0 },
      currentIndex: -1,
      currentMatch: null,
      isActive: false,
    });
  }, []);

  return {
    ...state,
    search,
    next,
    prev,
    clear,
  };
}
