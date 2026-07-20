import type { DocumentHighlight, HighlightColor } from '../../domain/document/DocumentHighlight';
import { HighlightRepository } from '../../services/database/repositories/HighlightRepository';
import { syncService } from '../../services/database/SyncService';

const repo = new HighlightRepository();

function generateId(): string {
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateHighlightInput {
  documentId: string;
  pageIndex: number;
  text: string;
  color: HighlightColor;
  anchorOffset: number;
  focusOffset: number;
}

export async function createHighlight(input: CreateHighlightInput): Promise<DocumentHighlight> {
  const highlight: DocumentHighlight = {
    id: generateId(),
    documentId: input.documentId,
    pageIndex: input.pageIndex,
    text: input.text,
    color: input.color,
    anchorOffset: input.anchorOffset,
    focusOffset: input.focusOffset,
    createdAt: new Date(),
  };

  await repo.save(highlight);
  await syncService.enqueueCreate('document_highlights', highlight.id, highlight);
  return highlight;
}

export async function getHighlights(documentId: string): Promise<DocumentHighlight[]> {
  return repo.getByDocument(documentId);
}

export async function deleteHighlight(id: string): Promise<void> {
  await repo.deleteById(id);
  await syncService.enqueueDelete('document_highlights', id);
}

export async function updateHighlightColor(highlight: DocumentHighlight, newColor: HighlightColor): Promise<DocumentHighlight> {
  const updated = { ...highlight, color: newColor };
  await repo.save(updated);
  await syncService.enqueueUpdate('document_highlights', updated.id, updated);
  return updated;
}
