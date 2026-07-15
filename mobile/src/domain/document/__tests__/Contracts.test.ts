import type { Document, DocumentRepository } from '../DocumentRepository';
import type { ReadingState, ReadingStateRepository } from '../ReadingStateRepository';
import type { AssetService, AssetInfo } from '../AssetService';
import type { DocumentImporter, ImportResult } from '../DocumentImporter';
import type { DocumentSource } from '../DocumentSource';
import type { ExtractedDocument } from '../ExtractedDocument';

describe('Document domain contracts', () => {
  describe('Document', () => {
    it('has correct shape', () => {
      const doc: Document = {
        id: 'doc-1',
        title: 'Test',
        assetId: 'asset-1',
        metadata: { format: 'pdf' },
      };
      expect(doc.id).toBe('doc-1');
      expect(doc.title).toBe('Test');
      expect(doc.assetId).toBe('asset-1');
      expect(doc.metadata.format).toBe('pdf');
    });
  });

  describe('ReadingState', () => {
    it('has correct shape', () => {
      const state: ReadingState = {
        documentId: 'doc-1',
        profileId: 'user-1',
        page: 5,
        zoom: 1.5,
        scrollOffset: 100,
        lastViewedAt: new Date('2026-01-01'),
      };
      expect(state.documentId).toBe('doc-1');
      expect(state.page).toBe(5);
      expect(state.zoom).toBe(1.5);
    });
  });

  describe('AssetInfo', () => {
    it('has correct shape', () => {
      const info: AssetInfo = {
        exists: true,
        size: 1024,
        checksum: 'abc123',
        mimeType: 'application/pdf',
      };
      expect(info.exists).toBe(true);
      expect(info.size).toBe(1024);
    });

    it('supports minimal shape', () => {
      const info: AssetInfo = { exists: false };
      expect(info.exists).toBe(false);
      expect(info.size).toBeUndefined();
    });
  });

  describe('ImportResult', () => {
    it('has correct shape', () => {
      const extracted: ExtractedDocument = {
        textBlocks: [],
        images: [],
        tables: [],
        metadata: { format: 'pdf' },
      };
      const result: ImportResult = {
        documentId: 'doc-1',
        extracted,
      };
      expect(result.documentId).toBe('doc-1');
      expect(result.extracted.metadata.format).toBe('pdf');
    });
  });
});

describe('DocumentRepository contract', () => {
  it('can be implemented', async () => {
    const store = new Map<string, Document>();
    const repo: DocumentRepository = {
      getById: async (id) => store.get(id) ?? null,
      getByAssetId: async (assetId) => {
        for (const doc of store.values()) {
          if (doc.assetId === assetId) return doc;
        }
        return null;
      },
      save: async (doc) => { store.set(doc.id, doc); },
      delete: async (id) => { store.delete(id); },
    };

    const doc: Document = {
      id: 'doc-1',
      title: 'Test',
      assetId: 'asset-1',
      metadata: { format: 'pdf' },
    };

    await repo.save(doc);
    expect(await repo.getById('doc-1')).toEqual(doc);
    expect(await repo.getByAssetId('asset-1')).toEqual(doc);

    await repo.delete('doc-1');
    expect(await repo.getById('doc-1')).toBeNull();
  });
});

describe('ReadingStateRepository contract', () => {
  it('can be implemented', async () => {
    const store = new Map<string, ReadingState>();
    const repo: ReadingStateRepository = {
      get: async (docId, profileId) => {
        return store.get(`${docId}:${profileId}`) ?? null;
      },
      save: async (state) => {
        store.set(`${state.documentId}:${state.profileId}`, state);
      },
    };

    const state: ReadingState = {
      documentId: 'doc-1',
      profileId: 'user-1',
      page: 3,
      zoom: 1.0,
      scrollOffset: 0,
      lastViewedAt: new Date('2026-01-01'),
    };

    await repo.save(state);
    expect(await repo.get('doc-1', 'user-1')).toEqual(state);
    expect(await repo.get('doc-1', 'user-2')).toBeNull();
  });
});

describe('AssetService contract', () => {
  it('can be implemented', async () => {
    const files = new Map<string, string>();
    const service: AssetService = {
      store: async (_sourceUri, filename) => { files.set(filename, 'stored'); return filename; },
      delete: async (path) => { files.delete(path); },
      exists: async (path) => files.has(path),
      get: async (path) => path,
      hash: async (_path) => 'mock-hash',
      info: async (path) => ({ exists: files.has(path), size: 100 }),
    };

    const path = await service.store('source://file.pdf', 'doc.pdf');
    expect(path).toBe('doc.pdf');
    expect(await service.exists('doc.pdf')).toBe(true);

    await service.delete('doc.pdf');
    expect(await service.exists('doc.pdf')).toBe(false);
  });
});

describe('DocumentImporter contract', () => {
  it('can be implemented', async () => {
    const importer: DocumentImporter = {
      importDocument: async (source, title) => ({
        documentId: 'doc-1',
        extracted: {
          textBlocks: [{ content: title, startIndex: 0, endIndex: title.length }],
          images: [],
          tables: [],
          metadata: { format: source.mimeType },
        },
      }),
    };

    const source: DocumentSource = {
      mimeType: 'application/pdf',
      hash: 'hash-1',
      openRead: async () => new ArrayBuffer(0),
    };

    const result = await importer.importDocument(source, 'My Doc');
    expect(result.documentId).toBe('doc-1');
    expect(result.extracted.textBlocks).toHaveLength(1);
  });
});
