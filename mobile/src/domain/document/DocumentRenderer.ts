import type { MutableRefObject } from 'react';
import type { DocumentModel } from './DocumentModel';

export type OnPageChange = (pageIndex: number) => void;
export type OnDocumentReady = (totalPages: number) => void;
export type OnTextSelection = (event: { documentId: string; pageIndex: number; blockIndex: number; text: string; startIndex: number; endIndex: number }) => void;
export type OnSearchResult = (total: number, current: number) => void;
export type ScrollToPageRef = MutableRefObject<((page: number) => void) | null>;

export interface DocumentRenderer {
  supports?(model: DocumentModel): boolean;
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
    onSelection?: OnTextSelection,
    highlightedBlockId?: string,
    searchRef?: MutableRefObject<any>,
    onSearchResult?: OnSearchResult,
    highlightsRef?: MutableRefObject<any>,
    onHighlightTapped?: (id: string) => void,
  ): unknown;
}
