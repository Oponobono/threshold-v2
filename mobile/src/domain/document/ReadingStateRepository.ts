export interface ReadingState {
  readonly documentId: string;
  readonly profileId: string;
  readonly page: number;
  readonly zoom: number;
  readonly scrollOffset: number;
  readonly lastViewedAt: Date;
}

export interface ReadingStateRepository {
  get(documentId: string, profileId: string): Promise<ReadingState | null>;
  save(state: ReadingState): Promise<void>;
}
