import type { TextBlock, ImageBlock, TableBlock, SourceMetadata } from './types';

export interface ExtractedDocument {
  readonly textBlocks: readonly TextBlock[];
  readonly images: readonly ImageBlock[];
  readonly tables: readonly TableBlock[];
  readonly metadata: SourceMetadata;
}
