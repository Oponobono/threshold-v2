import type { AssetService } from '../../../domain/document/AssetService';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import type { DocumentImporter } from '../../../domain/document/DocumentImporter';

describe('Infrastructure contracts', () => {
  it('AssetService has all required methods', () => {
    const service: AssetService = {
      store: async () => 'path',
      delete: async () => {},
      exists: async () => true,
      get: async () => '/path/to/file',
      hash: async () => 'abc123',
      info: async () => ({ exists: true, size: 100 }),
    };

    expect(service.store).toBeDefined();
    expect(service.delete).toBeDefined();
    expect(service.exists).toBeDefined();
    expect(service.get).toBeDefined();
    expect(service.hash).toBeDefined();
    expect(service.info).toBeDefined();
  });

  it('DocumentSource has correct shape', () => {
    const source: DocumentSource = {
      mimeType: 'application/pdf',
      hash: 'abc123',
      openRead: async () => new ArrayBuffer(0),
    };

    expect(source.mimeType).toBe('application/pdf');
    expect(source.hash).toBe('abc123');
  });

  it('DocumentExtractor has correct shape', () => {
    const extractor: DocumentExtractor = {
      id: 'pdf-extractor',
      version: 1,
      supports: (source: DocumentSource) => source.mimeType === 'application/pdf',
      extractDocument: async (source: DocumentSource) => ({
        textBlocks: [],
        images: [],
        tables: [],
        metadata: { format: source.mimeType },
      }),
    };

    expect(extractor.id).toBe('pdf-extractor');
    expect(extractor.version).toBe(1);
    expect(extractor.supports({ mimeType: 'application/pdf', hash: '', openRead: async () => new ArrayBuffer(0) })).toBe(true);
    expect(extractor.supports({ mimeType: 'text/plain', hash: '', openRead: async () => new ArrayBuffer(0) })).toBe(false);
  });

  it('DocumentImporter has correct shape', () => {
    const importer: DocumentImporter = {
      importDocument: async (source: DocumentSource, title: string) => ({
        documentId: 'doc-1',
        extracted: {
          textBlocks: [{ content: title, startIndex: 0, endIndex: title.length }],
          images: [],
          tables: [],
          metadata: { format: source.mimeType },
        },
      }),
    };

    expect(importer.importDocument).toBeDefined();
  });
});
