import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../../domain/document/ExtractedDocument';
import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import { ExtractorRegistry } from '../../../domain/document/ExtractorRegistry';
import { RendererRegistry } from '../../../domain/document/RendererRegistry';
import { DocumentModelBuilder } from '../../../domain/document/DocumentModelBuilder';
import { DocumentCapabilities } from '../../../domain/document/DocumentCapabilities';
import { DocumentAction } from '../../../domain/document/DocumentAction';

function createMockExtractor(mimeType: string): DocumentExtractor {
  return {
    id: `mock-${mimeType}`,
    version: 1,
    supports: (source) => source.mimeType === mimeType,
    extractDocument: async (source): Promise<ExtractedDocument> => ({
      textBlocks: [
        { content: '1. Introduction\nThis is the introduction.', startIndex: 0, endIndex: 39 },
        { content: '2. Methods\nThese are the methods.', startIndex: 39, endIndex: 72 },
      ],
      images: [{ id: 'img-1', mimeType: 'image/png', width: 100, height: 200 }],
      tables: [{ headers: ['A', 'B'], rows: [['1', '2']] }],
      metadata: { format: source.mimeType, title: 'Test Document', pageCount: 2 },
    }),
  };
}

function createMockSource(mimeType: string): DocumentSource {
  return {
    mimeType,
    hash: `hash-${mimeType}`,
    openRead: async () => new ArrayBuffer(0),
  };
}

describe('End-to-end pipeline', () => {
  it('completes full pipeline: Source → Extractor → ExtractedDocument → Builder → Model', async () => {
    const extractorRegistry = new ExtractorRegistry();
    extractorRegistry.register(createMockExtractor('application/pdf'));

    const source = createMockSource('application/pdf');
    const extractor = extractorRegistry.resolve(source);
    const extracted = await extractor.extractDocument(source);

    expect(extracted.textBlocks).toHaveLength(2);
    expect(extracted.images).toHaveLength(1);
    expect(extracted.tables).toHaveLength(1);

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('doc-1', 'Test Document');

    expect(model.documentId).toBe('doc-1');
    expect(model.title).toBe('Test Document');
    expect(model.pages.length).toBeGreaterThanOrEqual(1);
    expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Highlight)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(true);
  });

  it('registry resolves correct extractor by mime type', () => {
    const registry = new ExtractorRegistry();
    registry.register(createMockExtractor('application/pdf'));
    registry.register(createMockExtractor('image/png'));

    const pdfExtractor = registry.resolve(createMockSource('application/pdf'));
    const imgExtractor = registry.resolve(createMockSource('image/png'));

    expect(pdfExtractor.id).toBe('mock-application/pdf');
    expect(imgExtractor.id).toBe('mock-image/png');
  });

  it('registry throws on unsupported mime type', () => {
    const registry = new ExtractorRegistry();
    registry.register(createMockExtractor('application/pdf'));

    expect(() => registry.resolve(createMockSource('text/plain'))).toThrow(
      "No extractor registered for mime type: 'text/plain'"
    );
  });

  it('builder produces TOC from numbered headings', async () => {
    const extracted: ExtractedDocument = {
      textBlocks: [
        { content: '1. Introduction\nSome text', startIndex: 0, endIndex: 24 },
        { content: '2. Methods\nMore text', startIndex: 24, endIndex: 44 },
      ],
      images: [],
      tables: [],
      metadata: { format: 'pdf' },
    };

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('doc-1', 'Paper');

    expect(model.tableOfContents).toHaveLength(2);
    expect(model.tableOfContents[0].title).toBe('1. Introduction');
    expect(model.tableOfContents[1].title).toBe('2. Methods');
  });

  it('builder paginates large content', async () => {
    const blocks = [];
    for (let i = 0; i < 40; i++) {
      blocks.push({
        content: `Section ${i + 1}. ${'Lorem ipsum dolor sit amet '.repeat(5)}`,
        startIndex: i * 400,
        endIndex: (i + 1) * 400,
      });
    }
    const extracted: ExtractedDocument = {
      textBlocks: blocks,
      images: [],
      tables: [],
      metadata: { format: 'pdf' },
    };

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('doc-1', 'Long');

    expect(model.pages.length).toBeGreaterThan(1);
  });

  it('default capabilities include all text actions', async () => {
    const extracted: ExtractedDocument = {
      textBlocks: [{ content: 'Some text', startIndex: 0, endIndex: 9 }],
      images: [],
      tables: [],
      metadata: { format: 'pdf' },
    };

    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('doc-1', 'Test');

    expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Copy)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Highlight)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.CreateFlashcard)).toBe(true);
  });
});
