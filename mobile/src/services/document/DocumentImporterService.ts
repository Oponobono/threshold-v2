import type { DocumentImporter, ImportResult } from '../../domain/document/DocumentImporter';
import type { DocumentSource } from '../../domain/document/DocumentSource';
import type { DocumentExtractor } from '../../domain/document/DocumentExtractor';
import type { ExtractorRegistry } from '../../domain/document/ExtractorRegistry';
import type { AssetService } from '../../domain/document/AssetService';
import type { DocumentRepository, Document } from '../../domain/document/DocumentRepository';
import { DocumentModelBuilder } from '../../domain/document/DocumentModelBuilder';
import { DocumentCapabilities } from '../../domain/document/DocumentCapabilities';
import { AssetDocumentSource } from './AssetDocumentSource';

export class DocumentImporterService implements DocumentImporter {
  constructor(
    private readonly _extractorRegistry: ExtractorRegistry,
    private readonly _assetService: AssetService,
    private readonly _documentRepository: DocumentRepository,
  ) {}

  async importDocument(source: DocumentSource, title: string): Promise<ImportResult> {
    const extractor = this._extractorRegistry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const documentId = generateId();
    const assetId = generateId();

    const doc: Document = {
      id: documentId,
      title,
      assetId,
      metadata: extracted.metadata,
    };

    await this._documentRepository.save(doc);

    return { documentId, extracted };
  }

  async importFromUri(
    uri: string,
    mimeType: string,
    title: string,
  ): Promise<ImportResult> {
    const source = await AssetDocumentSource.fromFile(uri, mimeType);
    return this.importDocument(source, title);
  }
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
