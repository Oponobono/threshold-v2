import type { DocumentExtractor } from '../DocumentExtractor';
import type { DocumentSource } from '../DocumentSource';
import type { ExtractedDocument } from '../ExtractedDocument';
import { ExtractorRegistry } from '../ExtractorRegistry';

function createMockExtractor(mimeType: string, id = 'mock', version = 1): DocumentExtractor {
  return {
    id,
    version,
    supports: (source: DocumentSource) => source.mimeType === mimeType,
    extractDocument: async (_source: DocumentSource): Promise<ExtractedDocument> => ({
      textBlocks: [],
      images: [],
      tables: [],
      metadata: { format: mimeType },
    }),
  };
}

function createSource(mimeType: string): DocumentSource {
  return { mimeType, hash: 'hash-1', openRead: async () => new ArrayBuffer(0) };
}

describe('ExtractorRegistry', () => {
  it('registers and resolves an extractor', () => {
    const registry = new ExtractorRegistry();
    const extractor = createMockExtractor('application/pdf');
    registry.register(extractor);

    const resolved = registry.resolve(createSource('application/pdf'));
    expect(resolved).toBe(extractor);
  });

  it('resolves by mime type support', () => {
    const registry = new ExtractorRegistry();
    const pdfExtractor = createMockExtractor('application/pdf', 'pdf');
    const imgExtractor = createMockExtractor('image/png', 'img');
    registry.register(pdfExtractor);
    registry.register(imgExtractor);

    expect(registry.resolve(createSource('application/pdf'))).toBe(pdfExtractor);
    expect(registry.resolve(createSource('image/png'))).toBe(imgExtractor);
  });

  it('throws on unsupported source', () => {
    const registry = new ExtractorRegistry();
    registry.register(createMockExtractor('application/pdf'));

    expect(() => registry.resolve(createSource('text/plain'))).toThrow(
      "No extractor registered for mime type: 'text/plain'"
    );
  });

  it('reports has() correctly', () => {
    const registry = new ExtractorRegistry();
    registry.register(createMockExtractor('application/pdf'));

    expect(registry.has(createSource('application/pdf'))).toBe(true);
    expect(registry.has(createSource('image/png'))).toBe(false);
  });

  it('returns all registered extractors', () => {
    const registry = new ExtractorRegistry();
    const a = createMockExtractor('application/pdf', 'a');
    const b = createMockExtractor('image/png', 'b');
    registry.register(a);
    registry.register(b);

    expect(registry.getAll()).toEqual([a, b]);
  });

  it('returns correct size', () => {
    const registry = new ExtractorRegistry();
    expect(registry.size).toBe(0);
    registry.register(createMockExtractor('application/pdf'));
    expect(registry.size).toBe(1);
  });

  it('returns defensive copy from getAll', () => {
    const registry = new ExtractorRegistry();
    registry.register(createMockExtractor('application/pdf'));
    const all = registry.getAll();
    expect(all.length).toBe(1);
    expect(registry.size).toBe(1);
  });
});
