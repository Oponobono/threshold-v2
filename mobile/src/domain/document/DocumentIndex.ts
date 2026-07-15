export interface IndexPosition {
  readonly token: string;
  readonly blockIndex: number;
  readonly offset: number;
}

export interface DocumentIndex {
  readonly documentId: string;
  readonly tokens: readonly string[];
  readonly positions: readonly IndexPosition[];
}
