import type { DocumentExtractor } from './DocumentExtractor';
import type { DocumentSource } from './DocumentSource';

export class ExtractorRegistry {
  private readonly _extractors: DocumentExtractor[] = [];

  register(extractor: DocumentExtractor): void {
    this._extractors.push(extractor);
  }

  resolve(source: DocumentSource): DocumentExtractor {
    const extractor = this._extractors.find(e => e.supports(source));
    if (!extractor) {
      throw new Error(`No extractor registered for mime type: '${source.mimeType}'`);
    }
    return extractor;
  }

  has(source: DocumentSource): boolean {
    return this._extractors.some(e => e.supports(source));
  }

  getAll(): readonly DocumentExtractor[] {
    return [...this._extractors];
  }

  get size(): number {
    return this._extractors.length;
  }
}
