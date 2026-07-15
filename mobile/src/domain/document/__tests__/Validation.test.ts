import type { DocumentSource } from '../DocumentSource';
import type { ExtractedDocument } from '../ExtractedDocument';
import { ExtractorRegistry } from '../ExtractorRegistry';
import { RendererRegistry } from '../RendererRegistry';
import { DocumentModelBuilder } from '../DocumentModelBuilder';
import { DocumentCapabilities } from '../DocumentCapabilities';

function createTestExtractor(): ExtractorRegistry {
  const registry = new ExtractorRegistry();
  registry.register({
    id: 'test-pdf',
    version: 1,
    supports: (s) => s.mimeType === 'application/pdf',
    extractDocument: async (source): Promise<ExtractedDocument> => {
      const size = parseInt(source.hash, 10) || 100;
      const blocks = [];
      for (let i = 0; i < size; i++) {
        blocks.push({
          content: `Section ${i + 1}. ${'Lorem ipsum dolor sit amet. '.repeat(10)}`,
          startIndex: i * 300,
          endIndex: (i + 1) * 300,
        });
      }
      return {
        textBlocks: blocks,
        images: size > 50 ? [{ id: `img-${size}`, mimeType: 'image/png', width: 800, height: 600 }] : [],
        tables: size > 100 ? [{ headers: ['Col A', 'Col B'], rows: [['1', '2'], ['3', '4']] }] : [],
        metadata: { format: 'pdf', pageCount: Math.ceil(size / 10) },
      };
    },
  });
  return registry;
}

function createTestSource(charCount: number): DocumentSource {
  return {
    mimeType: 'application/pdf',
    hash: String(charCount),
    openRead: async () => new ArrayBuffer(0),
  };
}

describe('Validation: real-world PDF scenarios', () => {
  const registry = createTestExtractor();
  const rendererRegistry = new RendererRegistry();

  it('2-page PDF: opens, builds model, minimal memory', async () => {
    const source = createTestSource(20);
    const extractor = registry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('test-2p', 'Short Document');

    expect(model.pages.length).toBeGreaterThanOrEqual(1);
    expect(model.title).toBe('Short Document');
    expect(model.capabilities.supports('Search' as any)).toBe(true);
  });

  it('50-page PDF: builds model with TOC', async () => {
    const source = createTestSource(500);
    const extractor = registry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('test-50p', 'Medium Document');

    expect(model.pages.length).toBeGreaterThan(1);
    expect(model.tableOfContents.length).toBeGreaterThanOrEqual(1);
  });

  it('300-page PDF: pagination stays reasonable', async () => {
    const source = createTestSource(3000);
    const extractor = registry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('test-300p', 'Large Document');

    expect(model.pages.length).toBeGreaterThan(10);
    expect(model.capabilities.supports('AskAI' as any)).toBe(true);
  });

  it('performance: model build completes in < 100ms', async () => {
    const source = createTestSource(1000);
    const extractor = registry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const start = performance.now();
    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('test-perf', 'Perf Test');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(model.pages).toBeDefined();
  });

  it('empty PDF: graceful degradation', async () => {
    const source = createTestSource(-1);
    const extractor = registry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('test-empty', 'Empty');

    expect(model.pages).toHaveLength(1);
    expect(model.capabilities.supports('AskAI' as any)).toBe(false);
  });
});
