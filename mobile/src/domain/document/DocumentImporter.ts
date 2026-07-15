import type { DocumentSource } from './DocumentSource';
import type { ExtractedDocument } from './ExtractedDocument';

export interface ImportResult {
  readonly documentId: string;
  readonly extracted: ExtractedDocument;
}

export interface DocumentImporter {
  importDocument(source: DocumentSource, title: string): Promise<ImportResult>;
}
