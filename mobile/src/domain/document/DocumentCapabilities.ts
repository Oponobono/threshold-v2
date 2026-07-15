import { DocumentAction } from './DocumentAction';

export class DocumentCapabilities {
  private readonly _allowed: ReadonlySet<DocumentAction>;

  constructor(allowedActions: DocumentAction[]) {
    this._allowed = new Set(allowedActions);
  }

  supports(action: DocumentAction): boolean {
    return this._allowed.has(action);
  }

  get actions(): readonly DocumentAction[] {
    return Array.from(this._allowed);
  }
}
