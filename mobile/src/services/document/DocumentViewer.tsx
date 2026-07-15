import { createElement, type ReactNode } from 'react';
import type { DocumentModel } from '../../domain/document/DocumentModel';
import type { RendererRegistry } from '../../domain/document/RendererRegistry';

interface DocumentViewerProps {
  model: DocumentModel;
  rendererRegistry: RendererRegistry;
  onPageChange?: (pageIndex: number) => void;
  onSelection?: (selection: import('../../domain/document/DocumentSelection').DocumentSelection) => void;
}

export function DocumentViewer({
  model,
  rendererRegistry,
  onPageChange,
  onSelection,
}: DocumentViewerProps): ReactNode {
  const renderer = rendererRegistry.resolve(model);
  const rendered = renderer.render(model) as ReactNode;

  return createElement('div', {
    'data-testid': 'document-viewer',
    'data-document-id': model.documentId,
    'data-page-count': model.pages.length,
    'data-current-page': 0,
  }, rendered);
}
