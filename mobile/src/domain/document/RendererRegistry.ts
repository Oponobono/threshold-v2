import type { DocumentRenderer } from './DocumentRenderer';
import type { DocumentModel } from './DocumentModel';

export class RendererRegistry {
  private readonly _renderers: DocumentRenderer[] = [];

  register(renderer: DocumentRenderer): void {
    this._renderers.push(renderer);
  }

  resolve(model: DocumentModel): DocumentRenderer {
    if (this._renderers.length === 0) {
      throw new Error('No renderer registered');
    }

    const matched = this._renderers.find(r => r.supports?.(model));
    return matched ?? this._renderers[0];
  }

  getAll(): readonly DocumentRenderer[] {
    return [...this._renderers];
  }

  get size(): number {
    return this._renderers.length;
  }
}
