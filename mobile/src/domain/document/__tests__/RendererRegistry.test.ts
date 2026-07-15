import type { DocumentRenderer } from '../DocumentRenderer';
import type { DocumentModel } from '../DocumentModel';
import { RendererRegistry } from '../RendererRegistry';
import { DocumentCapabilities } from '../DocumentCapabilities';

function createMockRenderer(): DocumentRenderer {
  return { render: () => null };
}

function createMockModel(): DocumentModel {
  return {
    documentId: 'doc-1',
    title: 'Test',
    pages: [],
    tableOfContents: [],
    capabilities: new DocumentCapabilities([]),
  };
}

describe('RendererRegistry', () => {
  it('registers and resolves a renderer', () => {
    const registry = new RendererRegistry();
    const renderer = createMockRenderer();
    registry.register(renderer);

    const resolved = registry.resolve(createMockModel());
    expect(resolved).toBe(renderer);
  });

  it('throws when no renderer registered', () => {
    const registry = new RendererRegistry();
    expect(() => registry.resolve(createMockModel())).toThrow('No renderer registered');
  });

  it('returns all registered renderers', () => {
    const registry = new RendererRegistry();
    const a = createMockRenderer();
    const b = createMockRenderer();
    registry.register(a);
    registry.register(b);

    expect(registry.getAll()).toEqual([a, b]);
  });

  it('returns correct size', () => {
    const registry = new RendererRegistry();
    expect(registry.size).toBe(0);
    registry.register(createMockRenderer());
    expect(registry.size).toBe(1);
  });
});
