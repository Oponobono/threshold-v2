import type { DocumentRenderer } from './DocumentRenderer';
import type { DocumentModel } from './DocumentModel';

export class RendererRegistry {
  private readonly _renderers: DocumentRenderer[] = [];

  register(renderer: DocumentRenderer): void {
    this._renderers.push(renderer);
  }

  resolve(_model: DocumentModel): DocumentRenderer {
    const renderer = this._renderers[0];
    if (!renderer) {
      throw new Error('No renderer registered');
    }
    return renderer;
  }

  getAll(): readonly DocumentRenderer[] {
    return [...this._renderers];
  }

  get size(): number {
    return this._renderers.length;
  }
}
