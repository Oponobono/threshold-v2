import type { ExtractorRegistry } from '../../domain/document/ExtractorRegistry';
import type { RendererRegistry } from '../../domain/document/RendererRegistry';
import type { AssetService } from '../../domain/document/AssetService';
import type { DocumentRepository } from '../../domain/document/DocumentRepository';
import type { DocumentImporter } from '../../domain/document/DocumentImporter';
import { ExtractorRegistry as ExtractorRegistryImpl } from '../../domain/document/ExtractorRegistry';
import { RendererRegistry as RendererRegistryImpl } from '../../domain/document/RendererRegistry';
import { PersistentLocalAssetService } from './PersistentLocalAssetService';
import { PdfDocumentExtractor } from './PdfDocumentExtractor';
import { NativePdfRenderer } from './NativePdfRenderer';
import { DocumentImporterService } from './DocumentImporterService';

export interface DocumentSystem {
  readonly extractorRegistry: ExtractorRegistry;
  readonly rendererRegistry: RendererRegistry;
  readonly assetService: AssetService;
  readonly importer: DocumentImporter;
}

export function createDocumentSystem(
  documentRepository: DocumentRepository,
): DocumentSystem {
  const extractorRegistry = new ExtractorRegistryImpl();
  extractorRegistry.register(new PdfDocumentExtractor());

  const rendererRegistry = new RendererRegistryImpl();
  rendererRegistry.register(new NativePdfRenderer());

  const assetService = new PersistentLocalAssetService();

  const importer = new DocumentImporterService(
    extractorRegistry,
    assetService,
    documentRepository,
  );

  return { extractorRegistry, rendererRegistry, assetService, importer };
}
