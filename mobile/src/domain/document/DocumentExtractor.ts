import type { DocumentSource } from './DocumentSource';
import type { ExtractedDocument } from './ExtractedDocument';

export interface DocumentExtractor {
  readonly id: string;
  readonly version: number;
  supports(source: DocumentSource): boolean;
  extractDocument(source: DocumentSource): Promise<ExtractedDocument>;
}
