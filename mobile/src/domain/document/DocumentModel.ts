import type { ExtractedDocument } from './ExtractedDocument';
import type { DocumentCapabilities } from './DocumentCapabilities';

export interface DocumentPage {
  readonly pageIndex: number;
  readonly content: ExtractedDocument;
}

export interface DocumentTocEntry {
  readonly title: string;
  readonly pageIndex: number;
}

export interface DocumentModel {
  readonly documentId: string;
  readonly title: string;
  readonly pages: readonly DocumentPage[];
  readonly tableOfContents: readonly DocumentTocEntry[];
  readonly capabilities: DocumentCapabilities;
}
