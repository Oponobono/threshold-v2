export interface SelectionRange {
  readonly start: number;
  readonly end: number;
}

export interface SelectionMetadata {
  readonly page?: number;
  readonly timestamp: Date;
}

export interface DocumentSelection {
  readonly selectionFingerprint: string;
  readonly documentId: string;
  readonly range: SelectionRange;
  readonly content: {
    readonly text?: string;
    readonly images?: readonly string[];
    readonly tables?: readonly any[];
  };
  readonly metadata: SelectionMetadata;
}
