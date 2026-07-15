import type { DocumentSelection } from '../DocumentSelection';

describe('DocumentSelection', () => {
  const validSelection: DocumentSelection = {
    selectionFingerprint: 'abc123',
    documentId: 'doc-1',
    range: { start: 0, end: 100 },
    content: { text: 'Hello world' },
    metadata: { page: 1, timestamp: new Date('2026-01-01') },
  };

  it('creates with valid fingerprint', () => {
    expect(validSelection.selectionFingerprint).toBe('abc123');
    expect(validSelection.documentId).toBe('doc-1');
  });

  it('maintains range values', () => {
    expect(validSelection.range.start).toBe(0);
    expect(validSelection.range.end).toBe(100);
  });

  it('supports text content', () => {
    expect(validSelection.content.text).toBe('Hello world');
  });

  it('supports image content', () => {
    const withImages: DocumentSelection = {
      ...validSelection,
      selectionFingerprint: 'img1',
      content: { images: ['img-1', 'img-2'] },
    };
    expect(withImages.content.images).toEqual(['img-1', 'img-2']);
  });

  it('supports table content', () => {
    const withTables: DocumentSelection = {
      ...validSelection,
      selectionFingerprint: 'tbl1',
      content: { tables: [{ headers: ['A'], rows: [['1']] }] },
    };
    expect(withTables.content.tables).toHaveLength(1);
  });

  it('preserves metadata', () => {
    expect(validSelection.metadata.page).toBe(1);
    expect(validSelection.metadata.timestamp).toEqual(new Date('2026-01-01'));
  });
});
