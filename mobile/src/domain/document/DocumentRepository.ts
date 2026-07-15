import type { SourceMetadata } from './types';

export interface Document {
  readonly id: string;
  readonly title: string;
  readonly assetId: string;
  readonly metadata: SourceMetadata;
}

export interface DocumentRepository {
  getById(id: string): Promise<Document | null>;
  getByAssetId(assetId: string): Promise<Document | null>;
  save(document: Document): Promise<void>;
  delete(id: string): Promise<void>;
}
