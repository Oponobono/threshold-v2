import type { MutableRefObject } from 'react';
import type { DocumentModel } from './DocumentModel';

export type OnPageChange = (pageIndex: number) => void;
export type OnDocumentReady = (totalPages: number) => void;
export type ScrollToPageRef = MutableRefObject<((page: number) => void) | null>;

export interface DocumentRenderer {
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
  ): unknown;
}
