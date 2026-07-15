import type { ExtractedDocument } from '../ExtractedDocument';

describe('ExtractedDocument', () => {
  const validExtracted: ExtractedDocument = {
    textBlocks: [
      { content: 'Hello', startIndex: 0, endIndex: 5 },
      { content: 'World', startIndex: 6, endIndex: 11 },
    ],
    images: [
      { id: 'img-1', mimeType: 'image/png', width: 100, height: 200 },
    ],
    tables: [
      { headers: ['Name', 'Value'], rows: [['A', '1'], ['B', '2']] },
    ],
    metadata: { format: 'pdf', title: 'Test Doc', pageCount: 5 },
  };

  it('contains text blocks', () => {
    expect(validExtracted.textBlocks).toHaveLength(2);
    expect(validExtracted.textBlocks[0].content).toBe('Hello');
  });

  it('contains images', () => {
    expect(validExtracted.images).toHaveLength(1);
    expect(validExtracted.images[0].mimeType).toBe('image/png');
  });

  it('contains tables', () => {
    expect(validExtracted.tables).toHaveLength(1);
    expect(validExtracted.tables[0].headers).toEqual(['Name', 'Value']);
  });

  it('contains metadata', () => {
    expect(validExtracted.metadata.format).toBe('pdf');
    expect(validExtracted.metadata.title).toBe('Test Doc');
  });

  it('supports empty extraction', () => {
    const empty: ExtractedDocument = {
      textBlocks: [],
      images: [],
      tables: [],
      metadata: { format: 'txt' },
    };
    expect(empty.textBlocks).toHaveLength(0);
    expect(empty.images).toHaveLength(0);
    expect(empty.tables).toHaveLength(0);
  });

  it('supports text block with confidence (OCR)', () => {
    const ocr: ExtractedDocument = {
      textBlocks: [{ content: 'OCR text', startIndex: 0, endIndex: 8, confidence: 0.95 }],
      images: [],
      tables: [],
      metadata: { format: 'image' },
    };
    expect(ocr.textBlocks[0].confidence).toBe(0.95);
  });
});
