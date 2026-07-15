import type { ExtractedDocument } from '../ExtractedDocument';
import { DocumentCapabilities } from '../DocumentCapabilities';
import { DocumentModelBuilder } from '../DocumentModelBuilder';
import { DocumentAction } from '../DocumentAction';

function createExtracted(overrides?: Partial<ExtractedDocument>): ExtractedDocument {
  return {
    textBlocks: [{ content: 'Hello', startIndex: 0, endIndex: 5 }],
    images: [],
    tables: [],
    metadata: { format: 'pdf', title: 'Test' },
    ...overrides,
  };
}

function createCapabilities(actions: DocumentAction[] = [DocumentAction.Search]): DocumentCapabilities {
  return new DocumentCapabilities(actions);
}

describe('DocumentModelBuilder', () => {
  it('builds a model with documentId and title', () => {
    const builder = new DocumentModelBuilder(createExtracted(), createCapabilities());
    const model = builder.build('doc-1', 'My Document');

    expect(model.documentId).toBe('doc-1');
    expect(model.title).toBe('My Document');
  });

  it('creates a single page from extracted content', () => {
    const extracted = createExtracted();
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Test');

    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].pageIndex).toBe(0);
    expect(model.pages[0].content).toBe(extracted);
  });

  it('initializes empty table of contents', () => {
    const extracted = createExtracted({
      textBlocks: [{ content: 'hello world this is just some normal lowercase text', startIndex: 0, endIndex: 49 }],
    });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Test');

    expect(model.tableOfContents).toEqual([]);
  });

  it('passes capabilities through', () => {
    const caps = createCapabilities([DocumentAction.Search, DocumentAction.Copy]);
    const builder = new DocumentModelBuilder(createExtracted(), caps);
    const model = builder.build('doc-1', 'Test');

    expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Copy)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(false);
  });

  it('preserves extracted content reference', () => {
    const extracted = createExtracted({
      textBlocks: [
        { content: 'Line 1', startIndex: 0, endIndex: 6 },
        { content: 'Line 2', startIndex: 7, endIndex: 13 },
      ],
    });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Test');

    expect(model.pages[0].content.textBlocks).toHaveLength(2);
    expect(model.pages[0].content.textBlocks[0].content).toBe('Line 1');
  });

  it('handles empty extraction', () => {
    const extracted = createExtracted({ textBlocks: [], images: [], tables: [] });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Empty');

    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].content.textBlocks).toHaveLength(0);
  });

  it('uses default capabilities when not provided', () => {
    const builder = new DocumentModelBuilder(createExtracted());
    const model = builder.build('doc-1', 'Test');

    expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Copy)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.Highlight)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(true);
    expect(model.capabilities.supports(DocumentAction.CreateFlashcard)).toBe(true);
  });

  it('builds multiple pages for large content', () => {
    const longText = 'A'.repeat(9000);
    const extracted = createExtracted({
      textBlocks: [{ content: longText, startIndex: 0, endIndex: 9000 }],
    });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Long Doc');

    expect(model.pages.length).toBeGreaterThan(1);
    expect(model.pages[0].pageIndex).toBe(0);
    expect(model.pages[1].pageIndex).toBe(1);
  });

  it('builds TOC from numbered headings', () => {
    const extracted = createExtracted({
      textBlocks: [
        { content: '1. Introduction\nSome text here', startIndex: 0, endIndex: 28 },
        { content: '2. Methods\nMore text', startIndex: 28, endIndex: 48 },
      ],
    });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Paper');

    expect(model.tableOfContents.length).toBeGreaterThanOrEqual(2);
    expect(model.tableOfContents[0].title).toBe('1. Introduction');
    expect(model.tableOfContents[1].title).toBe('2. Methods');
  });

  it('builds default TOC for multi-page without headings', () => {
    const longText = 'Plain text without headings. '.repeat(200);
    const extracted = createExtracted({
      textBlocks: [{ content: longText, startIndex: 0, endIndex: longText.length }],
    });
    const builder = new DocumentModelBuilder(extracted, createCapabilities());
    const model = builder.build('doc-1', 'Plain');

    expect(model.tableOfContents.length).toBe(model.pages.length);
    expect(model.tableOfContents[0].title).toBe('Page 1');
  });

  it('default capabilities exclude AskAI for empty extraction', () => {
    const extracted = createExtracted({ textBlocks: [], images: [], tables: [] });
    const builder = new DocumentModelBuilder(extracted);
    const model = builder.build('doc-1', 'Empty');

    expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(false);
    expect(model.capabilities.supports(DocumentAction.CreateFlashcard)).toBe(false);
    expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
  });
});
