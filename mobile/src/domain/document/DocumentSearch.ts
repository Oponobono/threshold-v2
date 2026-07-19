export interface SearchQuery {
  readonly text: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
}

export interface SearchMatch {
  readonly blockId: string | undefined;
  readonly pageIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly snippet: string;
}

export interface SearchResult {
  readonly query: string;
  readonly matches: readonly SearchMatch[];
  readonly total: number;
}
